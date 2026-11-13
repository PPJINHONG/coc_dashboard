"""운영 인력 탭에서 바로 편집하는 API (PUT /api/operations/staff/).

권한 규칙
- 관리자·팀장: 모든 국가(KR·EU·NA)의 운영 인력을 편집합니다.
- 그룹장: 관리 국가의 운영 인력만 편집하며, 국가도 관리 국가로만 고를 수 있습니다.
- 사용자·옵저버: 403.
편집 범위(편집 가능한 국가)의 행 전체를 보내면, 보낸 목록에서 빠진 범위 안의 행은 삭제합니다.
범위 밖 행(다른 국가)은 보내지 않아도 그대로 둡니다. 성명은 이름으로 입력하며 새 행은 인력 공통데이터를 새로 만듭니다.
모든 변경은 운영 변경 이력(ChangeLog)과 사용자 행동 이력(UserActivity)에 남깁니다.
"""

from django.db import transaction
from django.db.models.deletion import ProtectedError
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.roles import record_activity, staff_edit_countries
from reporting.models import StaffMember
from reporting.services import bump, check_revision, lock_state, record_log

from .models import StaffAssignment
from .serializers import EDIT_FIELDS, StaffEditSerializer, StaffSerializer

MAX_ROWS = 500


def row_errors(serializer):
    errors = []
    items = serializer.errors.items() if isinstance(serializer.errors, dict) else enumerate(serializer.errors)
    for index, fields in items:
        for messages in (fields.values() if isinstance(fields, dict) else [fields]):
            values = messages if isinstance(messages, list) else [messages]
            errors.append(f"{index + 1}행: {' '.join(str(message) for message in values)}")
    return errors


@method_decorator(csrf_protect, name='dispatch')
class StaffEditView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def put(self, request):
        countries = staff_edit_countries(request.user)
        if not countries:
            raise PermissionDenied('운영 인력은 관리자·팀장·그룹장만 편집할 수 있습니다.')
        if not isinstance(request.data, dict):
            raise ValidationError('객체 형식으로 요청하세요.')
        state = lock_state()
        check_revision(state, request.data.get('revision'))
        rows = request.data.get('rows')
        if not isinstance(rows, list) or len(rows) > MAX_ROWS:
            raise ValidationError({'rows': [f'행은 {MAX_ROWS}개 이하의 목록으로 보내세요.']})
        serializer = StaffEditSerializer(data=rows, many=True)
        if not serializer.is_valid():
            raise ValidationError({'rows': row_errors(serializer)})
        scope = StaffAssignment.objects.select_for_update().select_related('staff').filter(country_code__in=countries)
        existing = {row.pk: row for row in scope}
        before = StaffSerializer(list(existing.values()), many=True).data
        seen = set()
        for index, values in enumerate(serializer.validated_data):
            pk = values.get('id')
            if pk is not None and (pk not in existing or pk in seen):
                raise ValidationError({'rows': [f'{index + 1}행은 편집할 수 없는 행이거나 번호가 중복됩니다.']})
            if values['country_code'] not in countries:
                raise ValidationError({'rows': [f"{index + 1}행: 국가는 {'·'.join(countries)} 중에서만 고를 수 있습니다."]})
            if not values['staff_name'].strip():
                raise ValidationError({'rows': [f'{index + 1}행: 성명을 입력하세요.']})
            if pk is not None:
                seen.add(pk)
        saved = []
        for values in serializer.validated_data:
            values = values.copy()
            pk = values.pop('id', None)
            name = values.pop('staff_name').strip()
            if pk is None:
                member = StaffMember.objects.create(staff_name=name)
                row = StaffAssignment.objects.create(staff=member, **{key: values.get(key, '') for key in EDIT_FIELDS})
            else:
                row = existing[pk]
                if row.staff.staff_name != name:
                    # 같은 사람의 이름 수정은 공통데이터(인력) 이름을 바꿔 이슈 담당자 표시도 함께 바뀝니다.
                    row.staff.staff_name = name
                    row.staff.save(update_fields=['staff_name'])
                for key in EDIT_FIELDS:
                    if key in values:
                        setattr(row, key, values[key])
                row.save()
            saved.append(row.pk)
        removed = [row for pk, row in existing.items() if pk not in saved]
        for row in removed:
            member = row.staff
            row.delete()
            try:
                # 다른 곳(이슈 담당자 등)에서 쓰지 않는 인력 공통데이터만 함께 지웁니다.
                with transaction.atomic():
                    member.delete()
            except ProtectedError:
                pass
        bump(state)
        after_rows = StaffAssignment.objects.select_related('staff').filter(country_code__in=countries)
        after = StaffSerializer(after_rows, many=True, context={'request': request}).data
        scope_label = '·'.join(countries)
        summary = f'운영 인력 {scope_label} {len(saved)}명 저장, {len(removed)}명 삭제'
        record_log(request, 'staff', 'update', summary, before={'rows': before}, after={'rows': after})
        record_activity(request, 'update', summary, 'staff', scope_label,
                        before={'rows': before}, after={'rows': [dict(row) for row in after]})
        return Response({'revision': state.revision, 'rows': after})
