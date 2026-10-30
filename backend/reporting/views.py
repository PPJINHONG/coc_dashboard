from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, BasePermission, SAFE_METHODS
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ChangeLog, IssueComment, Region, Service, StaffMember, RegionalIssue
from .serializers import ChangeLogSerializer, CommentSerializer, RegionSerializer, ServiceSerializer, StaffMemberSerializer
from .services import SECTIONS, actor, bump, check_revision, lock_state, record_log, section_rows, totals


def can_manage(request):
    return bool(request.user.is_authenticated and request.user.is_active and request.user.is_staff)


class ReportingPermission(BasePermission):
    def has_permission(self, request, view):
        if request.method not in SAFE_METHODS:
            return can_manage(request)
        return settings.DEVELOPMENT_AUTH_BYPASS or request.user.is_authenticated


@method_decorator(csrf_protect, name='dispatch')
class ReportingView(APIView):
    permission_classes = [ReportingPermission]


class OperationsAdministrator(BasePermission):
    message = '데이터 변경은 DB 관리에서 로그인한 관리자만 할 수 있습니다.'

    def has_permission(self, request, view):
        return can_manage(request)


class AdminDataView(ReportingView):
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
    @transaction.atomic
    def get(self, request):
        state = lock_state()
        payload = {'revision': state.revision, 'updated_at': state.updated_at, 'totals': totals(),
                   'logs': ChangeLogSerializer(ChangeLog.objects.all()[:50], many=True).data if can_manage(request) else []}
        for key, (_, serializer, _) in SECTIONS.items():
            payload[key] = serializer(section_rows(key), many=True).data
        return Response(payload)


class SectionView(AdminDataView):
    @transaction.atomic
    def put(self, request, section):
        if section not in SECTIONS:
            raise ValidationError('알 수 없는 기능입니다.')
        state = lock_state()
        check_revision(state, request.data.get('revision'))
        rows = request.data.get('rows')
        if not isinstance(rows, list) or len(rows) > 500:
            raise ValidationError({'rows': ['행은 500개 이하의 목록으로 보내세요.']})
        model, serializer_class, unique_fields = SECTIONS[section]
        serializer = serializer_class(data=rows, many=True)
        if not serializer.is_valid():
            errors = []
            row_errors = serializer.errors.items() if isinstance(serializer.errors, dict) else enumerate(serializer.errors)
            for index, fields in row_errors:
                for messages in (fields.values() if isinstance(fields, dict) else [fields]):
                    values = messages if isinstance(messages, list) else [messages]
                    errors.append(f"{index + 1}행: {' '.join(str(message) for message in values)}")
            raise ValidationError({'rows': errors})
        before = serializer_class(section_rows(section), many=True).data
        existing = {row.pk: row for row in model.objects.all()}
        seen_ids, seen_keys = set(), set()
        for index, values in enumerate(serializer.validated_data):
            pk = values.get('id')
            if pk is not None and (pk not in existing or pk in seen_ids):
                raise ValidationError({'rows': [f'{index + 1}행의 번호가 중복되거나 존재하지 않습니다.']})
            if pk is not None:
                seen_ids.add(pk)
            if section != 'issues':
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
                    if pk is not None:
                        row = existing[pk]
                        for key, value in values.items():
                            setattr(row, key, value)
                        row.save()
                    elif section == 'issues':
                        row = model.objects.create(**values)
                    else:
                        lookup = {key: values.get(key, model._meta.get_field(key).get_default()) for key in unique_fields}
                        row, _ = model.objects.update_or_create(**lookup, defaults=values)
                    saved_ids.append(row.pk)
                model.objects.exclude(pk__in=saved_ids).delete()
        except ProtectedError as exc:
            raise ValidationError('댓글 등 연결된 데이터가 있습니다. 해당 데이터를 먼저 삭제하세요.') from exc
        except IntegrityError as exc:
            raise ValidationError({'rows': ['중복 항목 또는 유효하지 않은 수량이 있습니다. 입력값을 확인하세요.']}) from exc
        bump(state)
        after = serializer_class(section_rows(section), many=True).data
        record_log(request, section, 'update', f'{len(saved_ids)}개 행 저장', before={'rows': before}, after={'rows': after})
        return Response({'revision': state.revision, 'rows': after})


class MasterDataView(AdminDataView):
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


class CommentsView(AdminDataView):
    @transaction.atomic
    def post(self, request, pk):
        state = lock_state()
        check_revision(state, request.data.get('revision'))
        issue = get_object_or_404(RegionalIssue, pk=pk)
        content = request.data.get('content')
        if not isinstance(content, str) or not content.strip() or len(content) > 5000:
            raise ValidationError({'content': ['댓글은 1~5000자로 입력하세요.']})
        identity = actor(request)
        comment = IssueComment.objects.create(issue=issue, content=content.strip(), author_name=identity['actor_name'], author_username=identity['actor_username'])
        bump(state)
        record_log(request, 'issues', 'comment', f'이슈 #{issue.pk} 댓글 추가')
        return Response(CommentSerializer(comment).data, status=201)


class LogsView(AdminDataView):
    def get(self, request):
        logs = ChangeLog.objects.all()
        if request.query_params.get('section'):
            logs = logs.filter(section=request.query_params['section'])
        return Response(ChangeLogSerializer(logs[:200], many=True).data)
