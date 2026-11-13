"""운영 인력 탭에서 바로 편집하는 API (PUT /api/operations/staff/).

권한 규칙
- 관리자·팀장: 모든 국가(KR·EU·NA)의 운영 인력을 편집합니다.
- 그룹장: 관리 국가의 운영 인력만 편집하며, 국가도 관리 국가로만 고를 수 있습니다.
- 사용자·옵저버: 403.
편집 범위(편집 가능한 국가)의 행 전체를 보내면, 보낸 목록에서 빠진 범위 안의 행은 삭제합니다.
범위 밖 행(다른 국가)은 보내지 않아도 그대로 둡니다. 성명은 이름으로 입력하며 새 행은 인력 공통데이터를 새로 만듭니다.
모든 변경은 운영 변경 이력(ChangeLog)과 사용자 행동 이력(UserActivity)에 남깁니다.
"""

from django.db import IntegrityError, transaction
from django.db.models import Q
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
from reporting.history import capture_history

from .models import StaffAssignment, StaffResponsibility
from .serializers import EDIT_FIELDS, SELF_FIELDS, StaffEditSerializer, StaffSerializer
from .permissions import can_manage_person, can_edit_person, can_view_grade, editor_level, title_level, owns_profile

MAX_ROWS = 500


def validate_permissions(user, values, person=None):
    managing = can_manage_person(user, person) if person else bool(staff_edit_countries(user))
    if not managing:
        if not person or not owns_profile(user, person):
            raise PermissionDenied('운영 인력 수정 권한이 없습니다.')
        if set(values) - SELF_FIELDS - {'id'}:
            raise PermissionDenied('본인은 일반 개인정보만 수정할 수 있습니다.')
    else:
        if values.get('country_code', person.country_code if person else None) not in staff_edit_countries(user):
            raise PermissionDenied('관리 권역의 인력만 등록·수정할 수 있습니다.')
        if title_level(values.get('job_title', '')) > editor_level(user):
            raise PermissionDenied('본인보다 상위 직책을 선택할 수 없습니다.')
    if 'grade' in values and not can_view_grade(user):
        raise PermissionDenied('등급은 관리자와 팀장만 관리할 수 있습니다.')
    if 'account' in values:
        if not can_view_grade(user):
            raise PermissionDenied('회원 계정 연결은 관리자와 팀장만 변경할 수 있습니다.')
        if values['account'] and not values['account'].is_active:
            raise ValidationError('활성 회원 계정만 연결할 수 있습니다.')


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
    def post(self, request):
        return self.save_person(request)

    @transaction.atomic
    def patch(self, request):
        return self.save_person(request)

    def save_person(self, request):
        if not isinstance(request.data, dict):
            raise ValidationError('객체 형식으로 요청하세요.')
        raw = request.data.get('person')
        if not isinstance(raw, dict):
            raise ValidationError('인력 정보를 객체 형식으로 보내세요.')
        pk = raw.get('id')
        if pk is not None and type(pk) is not int:
            raise ValidationError('수정할 인력을 확인하세요.')
        if (request.method == 'PATCH') != (pk is not None):
            raise ValidationError('수정할 인력을 지정하거나 새 인력으로 등록하세요.')
        if pk is None and not staff_edit_countries(request.user):
            raise PermissionDenied('운영 인력 등록 권한이 없습니다.')
        state = lock_state()
        capture_history(request, 'staff')
        check_revision(state, request.data.get('revision'))
        person = StaffAssignment.objects.select_for_update().select_related('staff').filter(pk=pk).first() if pk else None
        if pk and (not person or not can_edit_person(request.user, person)):
            raise PermissionDenied('이 인력을 수정할 권한이 없습니다.')
        serializer = StaffEditSerializer(person, data=raw, partial=person is not None)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data.copy()
        values.pop('id', None)
        validate_permissions(request.user, values, person)
        name = values.pop('staff_name', person.staff.staff_name if person else '').strip()
        if 'account' in values and values['account'] and (not person or person.account_id != values['account'].pk):
            name = values['account'].first_name or name
        before = None
        try:
            if pk is None:
                member = StaffMember.objects.create(staff_name=name)
                person = StaffAssignment.objects.create(staff=member, **values)
                name = person.staff.staff_name
            else:
                before = dict(StaffSerializer(person, context={'request': request}).data)
                old_country = person.country_code
                for key, value in values.items():
                    setattr(person, key, value)
                person.save()
                person.staff.staff_name = name
                person.staff.save(update_fields=['staff_name'])
                if old_country != person.country_code:
                    for responsibility in StaffResponsibility.objects.exclude(country_code=person.country_code).filter(Q(site_representative=person) | Q(group_lead=person)):
                        if responsibility.site_representative_id == person.pk:
                            responsibility.site_representative = None
                        if responsibility.group_lead_id == person.pk:
                            responsibility.group_lead = None
                        responsibility.save()
        except IntegrityError as exc:
            raise ValidationError('이미 연결된 회원이거나 유효하지 않은 입력입니다.') from exc
        bump(state)
        after = dict(StaffSerializer(person, context={'request': request}).data)
        action = 'create' if pk is None else 'update'
        summary = f'운영 인력 {name} {"등록" if pk is None else "수정"}'
        record_log(request, 'staff', action, summary, before=before, after=after)
        record_activity(request, action, summary, 'staff', str(person.pk), before=before, after=after)
        return Response({'revision': state.revision, 'person': after}, status=201 if pk is None else 200)

    @transaction.atomic
    def put(self, request):
        countries = staff_edit_countries(request.user)
        if not countries:
            raise PermissionDenied('운영 인력은 관리자·팀장·그룹장만 편집할 수 있습니다.')
        if not isinstance(request.data, dict):
            raise ValidationError('객체 형식으로 요청하세요.')
        state = lock_state()
        capture_history(request, 'staff')
        check_revision(state, request.data.get('revision'))
        rows = request.data.get('rows')
        if not isinstance(rows, list) or len(rows) > MAX_ROWS:
            raise ValidationError({'rows': [f'행은 {MAX_ROWS}개 이하의 목록으로 보내세요.']})
        serializer = StaffEditSerializer(data=rows, many=True)
        if not serializer.is_valid():
            raise ValidationError({'rows': row_errors(serializer)})
        scope = StaffAssignment.objects.select_for_update().select_related('staff').filter(country_code__in=countries)
        existing = {row.pk: row for row in scope if can_manage_person(request.user, row)}
        before = StaffSerializer(list(existing.values()), many=True).data
        seen = set()
        for index, values in enumerate(serializer.validated_data):
            if title_level(values.get('job_title', '')) > editor_level(request.user):
                raise PermissionDenied('본인보다 상위 직책을 선택할 수 없습니다.')
            pk = values.get('id')
            if pk is not None and (pk not in existing or pk in seen):
                raise ValidationError({'rows': [f'{index + 1}행은 편집할 수 없는 행이거나 번호가 중복됩니다.']})
            if values['country_code'] not in countries:
                raise ValidationError({'rows': [f"{index + 1}행: 국가는 {'·'.join(countries)} 중에서만 고를 수 있습니다."]})
            if not values['staff_name'].strip():
                raise ValidationError({'rows': [f'{index + 1}행: 성명을 입력하세요.']})
            validate_permissions(request.user, values, existing.get(pk))
            if pk is not None:
                seen.add(pk)
        saved = []
        for values in serializer.validated_data:
            values = values.copy()
            pk = values.pop('id', None)
            name = values.pop('staff_name').strip()
            if pk is None:
                member = StaffMember.objects.create(staff_name=name)
                row = StaffAssignment.objects.create(staff=member, **{key: values[key] for key in EDIT_FIELDS if key in values})
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
            if row.calendar_events.exists():
                raise ValidationError('캘린더가 연결된 인력은 삭제할 수 없습니다. 회사 퇴사일을 입력하세요.')
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
