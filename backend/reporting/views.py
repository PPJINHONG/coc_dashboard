from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import registry
from .models import ChangeLog, Region, Service, StaffMember
from .months import month_label, parse_month, request_month
from .permissions import OperationsAdministrator, ReportingPermission, can_manage
from .serializers import ChangeLogSerializer, RegionSerializer, ServiceSerializer, StaffMemberSerializer
from .services import bump, check_revision, lock_state, record_log
from .history import capture_history, visible_history


@method_decorator(csrf_protect, name='dispatch')
class ReportingView(APIView):
    permission_classes = [ReportingPermission]


class AdminDataView(ReportingView):
    """DB 관리(/api/db-admin/)의 운영 데이터 변경 API 기반 클래스. 실제 활성 관리자만 사용합니다."""

    permission_classes = [OperationsAdministrator]


@method_decorator(ensure_csrf_cookie, name='dispatch')
class AppConfigView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'development_mode': settings.DEVELOPMENT_AUTH_BYPASS})


class BootstrapView(ReportingView):
    def get(self, request):
        return Response({
            'regions': RegionSerializer(Region.objects.all(), many=True).data,
            'services': ServiceSerializer(Service.objects.all(), many=True).data,
            'staff_members': StaffMemberSerializer(StaffMember.objects.all(), many=True).data,
            'can_manage': can_manage(request),
            'development_mode': settings.DEVELOPMENT_AUTH_BYPASS,
        })


class SnapshotView(ReportingView):
    """모든 기능의 기준 월 데이터를 한 번에 돌려줍니다. 기능 목록은 각 앱의 feature.py에서 모읍니다.

    `?month=YYYY-MM`으로 월을 고르며, 없으면 이번 달입니다. 월 구분이 없는 기능(운영 인력)은 항상 전체 행입니다.
    """

    @transaction.atomic
    def get(self, request):
        month = request_month(request)
        state = lock_state()
        payload = {'revision': state.revision, 'updated_at': state.updated_at, 'month': month_label(month),
                   'totals': registry.totals(month),
                   'logs': visible_history(request.user, limit=50)}
        for key, section in registry.sections().items():
            payload[key] = section.serializer(section.rows(month), many=True, context={'request': request}).data
        return Response(payload)


class LogsView(ReportingView):
    def get(self, request):
        if not request.user.is_authenticated or not request.user.is_active:
            raise PermissionDenied('로그인한 활성 사용자만 변경 이력을 조회할 수 있습니다.')
        catalog_rows = visible_history(request.user, {'month': request.query_params.get('month')})
        rows = (visible_history(request.user, request.query_params)
                if request.query_params.get('region') or request.query_params.get('actor') else catalog_rows)
        tabs, actors, regions = {}, {}, {}
        for row in catalog_rows:
            tab = tabs.setdefault(row['section'], {'id': row['section'], 'count': 0, 'latest_at': row['created_at']})
            tab['count'] += 1
            actors[row['actor_key']] = {'id': row['actor_key'], 'name': row['actor_name']}
            regions.update({item['id']: item for item in row['regions']})
        if request.query_params.get('section'):
            rows = [row for row in rows if row['section'] == request.query_params['section']]
        try:
            offset = max(0, int(request.query_params.get('offset', 0)))
        except (ValueError, TypeError) as exc:
            raise ValidationError('페이지 값이 올바르지 않습니다.') from exc
        page_size = 30
        return Response({'results': rows[offset:offset + page_size], 'count': len(rows),
                         'next_offset': offset + page_size if offset + page_size < len(rows) else None,
                         'tabs': list(tabs.values()), 'actors': sorted(actors.values(), key=lambda item: item['name']),
                         'regions': sorted(regions.values(), key=lambda item: item['region_name'])})


class SectionView(AdminDataView):
    """기능별 기준 월 데이터 전체를 한 번에 저장합니다. 보낸 목록에서 빠진 행은 삭제합니다.

    월별 기능은 본문 `month`(YYYY-MM, 없으면 이번 달)의 행만 바꾸고 다른 달 행은 건드리지 않습니다.
    """

    @transaction.atomic
    def put(self, request, section):
        definition = registry.sections().get(section)
        if definition is None:
            raise ValidationError('알 수 없는 기능입니다.')
        month = request_month(request) if definition.monthly else None
        state = lock_state()
        check_revision(state, request.data.get('revision'))
        capture_history(request, section)
        rows = request.data.get('rows')
        if not isinstance(rows, list) or len(rows) > 500:
            raise ValidationError({'rows': ['행은 500개 이하의 목록으로 보내세요.']})
        model, serializer_class, unique_fields = definition.model, definition.serializer, definition.unique_fields
        serializer = serializer_class(data=rows, many=True)
        if not serializer.is_valid():
            errors = []
            row_errors = serializer.errors.items() if isinstance(serializer.errors, dict) else enumerate(serializer.errors)
            for index, fields in row_errors:
                for messages in (fields.values() if isinstance(fields, dict) else [fields]):
                    values = messages if isinstance(messages, list) else [messages]
                    errors.append(f"{index + 1}행: {' '.join(str(message) for message in values)}")
            raise ValidationError({'rows': errors})
        before = serializer_class(definition.rows(month), many=True).data
        existing = {row.pk: row for row in definition.scoped(month)}
        seen_ids, seen_keys = set(), set()
        for index, values in enumerate(serializer.validated_data):
            pk = values.get('id')
            if pk is not None and (pk not in existing or pk in seen_ids):
                raise ValidationError({'rows': [f'{index + 1}행의 번호가 중복되거나 존재하지 않습니다.']})
            if pk is not None:
                seen_ids.add(pk)
            if unique_fields:
                key_values = []
                for field in unique_fields:
                    value = values.get(field, model._meta.get_field(field).get_default())
                    key_values.append(str(getattr(value, 'pk', value)))
                key = tuple(key_values)
                if key in seen_keys:
                    raise ValidationError({'rows': [f'{index + 1}행의 리전·분류 조합이 중복됩니다.']})
                seen_keys.add(key)
        saved_ids = []
        try:
            with transaction.atomic():
                for values in serializer.validated_data:
                    values = values.copy()
                    pk = values.pop('id', None)
                    if month is not None:
                        values['period_month'] = month
                    if pk is not None:
                        row = existing[pk]
                        for key, value in values.items():
                            setattr(row, key, value)
                        row.save()
                    elif not unique_fields:
                        row = model.objects.create(**values)
                    else:
                        lookup = {key: values.get(key, model._meta.get_field(key).get_default()) for key in unique_fields}
                        if month is not None:
                            lookup['period_month'] = month
                        row, _ = model.objects.update_or_create(**lookup, defaults=values)
                    saved_ids.append(row.pk)
                definition.scoped(month).exclude(pk__in=saved_ids).delete()
        except ProtectedError as exc:
            raise ValidationError('댓글 등 연결된 데이터가 있습니다. 해당 데이터를 먼저 삭제하세요.') from exc
        except IntegrityError as exc:
            raise ValidationError({'rows': ['중복 항목 또는 유효하지 않은 수량이 있습니다. 입력값을 확인하세요.']}) from exc
        bump(state)
        after = serializer_class(definition.rows(month), many=True).data
        summary = f'{month_label(month)} {len(saved_ids)}개 행 저장' if month else f'{len(saved_ids)}개 행 저장'
        record_log(request, section, 'update', summary, before={'rows': before}, after={'rows': after}, month=month)
        return Response({'revision': state.revision, 'month': month_label(month), 'rows': after})


class MasterDataView(AdminDataView):
    """리전·서비스·인력 공통데이터 추가·수정·삭제."""

    models = {'regions': (Region, RegionSerializer), 'services': (Service, ServiceSerializer), 'staff-members': (StaffMember, StaffMemberSerializer)}

    def get_instance(self, model, pk):
        if pk is None:
            return None
        if model in (Region, StaffMember):
            try:
                pk = int(pk)
            except (TypeError, ValueError) as exc:
                raise ValidationError('공통데이터 식별자가 변경되었습니다. 새로고침한 뒤 다시 시도하세요.') from exc
        return get_object_or_404(model, pk=pk)

    @transaction.atomic
    def post(self, request, collection):
        return self.save(request, collection)

    @transaction.atomic
    def delete(self, request, collection, pk):
        if not can_manage(request):
            raise PermissionDenied('공통데이터는 관리자만 삭제할 수 있습니다.')
        if collection not in self.models:
            raise ValidationError('알 수 없는 공통데이터입니다.')
        state = lock_state()
        model, serializer = self.models[collection]
        capture_history(request, collection)
        instance = self.get_instance(model, pk)
        before = serializer(instance).data
        try:
            instance.delete()
        except ProtectedError as exc:
            raise ValidationError('사용 중인 공통데이터입니다. 연결된 데이터를 먼저 변경하거나 삭제하세요.') from exc
        bump(state)
        record_log(request, collection, 'delete', '공통데이터 삭제', before=before)
        return Response(status=204)

    @transaction.atomic
    def patch(self, request, collection, pk):
        return self.save(request, collection, pk)

    def save(self, request, collection, pk=None):
        if collection not in self.models:
            raise ValidationError('알 수 없는 공통데이터입니다.')
        if not can_manage(request):
            raise PermissionDenied('리전·서비스 공통데이터는 관리자만 수정할 수 있습니다.')
        state = lock_state()
        model, serializer_class = self.models[collection]
        capture_history(request, collection)
        instance = self.get_instance(model, pk)
        if instance is not None and model._meta.pk.name in request.data and str(request.data[model._meta.pk.name]) != str(instance.pk):
            raise ValidationError('기존 공통데이터의 코드는 변경할 수 없습니다.')
        before = serializer_class(instance).data if instance else {}
        serializer = serializer_class(instance, data=request.data, partial=instance is not None)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                saved = serializer.save()
        except IntegrityError as exc:
            raise ValidationError('동일한 코드 또는 이름이 이미 존재합니다.') from exc
        bump(state)
        record_log(request, collection, 'update' if instance else 'create', '공통데이터 수정' if instance else '공통데이터 추가', before=before, after=serializer_class(saved).data)
        return Response(serializer.data, status=200 if instance else 201)
