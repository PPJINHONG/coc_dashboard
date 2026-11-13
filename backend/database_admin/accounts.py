"""DB 관리 > 기능별 설정 > 사용자·권한: 계정 추가·수정·삭제와 계정별 행동 이력."""

from django.contrib.auth import get_user_model, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Max, Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.defaults import DEFAULT_USERNAMES
from core.models import UserActivity
from core.roles import COUNTRIES, ROLE_ADMIN, ROLE_GROUP_LEAD, ROLES, apply_role, managed_countries, online_sessions, user_role
from core.signals import username_changed
from reporting.services import bump, lock_state

from .services import log_change
from .views import AdminView, payload


class AccountSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='first_name', max_length=150)
    password = serializers.CharField(write_only=True, required=False, min_length=8, max_length=128, trim_whitespace=False)
    # 관리자·옵저버(읽기 전용)·사용자. 보내지 않으면 기존 is_staff 방식과 같이 동작합니다.
    role = serializers.ChoiceField(choices=ROLES, required=False)
    # 그룹장(group_lead)의 관리 국가. 그룹장일 때 하나 이상 필요하며 다른 권한에서는 무시합니다.
    managed_countries = serializers.ListField(child=serializers.ChoiceField(choices=COUNTRIES), required=False, allow_empty=True)
    is_online = serializers.SerializerMethodField()
    active_sessions = serializers.SerializerMethodField()
    last_activity = serializers.SerializerMethodField()

    class Meta:
        model = get_user_model()
        fields = ['id', 'name', 'username', 'email', 'role', 'managed_countries', 'is_staff', 'is_active', 'password', 'date_joined', 'last_login',
                  'is_online', 'active_sessions', 'last_activity']
        read_only_fields = ['id', 'email', 'date_joined', 'last_login']
        extra_kwargs = {'username': {'validators': []}}

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['role'] = user_role(instance)
        data['managed_countries'] = managed_countries(instance)
        return data

    def get_active_sessions(self, obj):
        sessions = self.context.get('sessions')
        return (sessions if sessions is not None else online_sessions()).get(obj.pk, 0)

    def get_is_online(self, obj):
        return self.get_active_sessions(obj) > 0

    def get_last_activity(self, obj):
        latest = self.context.get('latest_activity')
        if latest is not None:
            value = latest.get(obj.pk)
        else:
            value = UserActivity.objects.filter(user=obj).values_list('created_at', flat=True).first()
        return value.isoformat() if value else None

    def validate_username(self, value):
        value = value.strip().lower()
        # 기본 계정(admin·kr·eu·na·readonly)만 @ 없는 아이디를 유지할 수 있습니다.
        if not (self.instance and self.instance.username == value and value in DEFAULT_USERNAMES):
            serializers.EmailField(max_length=150).run_validation(value)
        users = get_user_model().objects.filter(Q(username__iexact=value) | Q(email__iexact=value))
        if self.instance:
            users = users.exclude(pk=self.instance.pk)
        if users.exists():
            raise serializers.ValidationError('이미 사용 중인 이메일 아이디입니다.')
        return value

    def validate(self, attrs):
        if 'role' in attrs:
            attrs['is_staff'] = attrs['role'] == ROLE_ADMIN
        role = attrs.get('role', user_role(self.instance) if self.instance else None)
        countries = attrs.get('managed_countries', managed_countries(self.instance) if self.instance else [])
        if role == ROLE_GROUP_LEAD and not countries:
            raise serializers.ValidationError({'managed_countries': '그룹장은 관리 국가를 하나 이상 고르세요.'})
        if 'managed_countries' in attrs and 'role' not in attrs and self.instance is not None:
            # 관리 국가만 바꿔도 현재 권한으로 다시 저장합니다.
            attrs['role'] = role
        if self.instance is None and not attrs.get('password'):
            raise serializers.ValidationError({'password': '새 계정의 비밀번호를 입력하세요.'})
        if self.instance and self.instance.pk == self.context['request'].user.pk:
            if attrs.get('is_active') is False or attrs.get('is_staff') is False:
                raise serializers.ValidationError('현재 로그인한 관리자의 활성 상태와 관리자 권한은 해제할 수 없습니다.')
        if self.instance and self.instance.is_superuser and (attrs.get('is_active') is False or attrs.get('is_staff') is False):
            raise serializers.ValidationError('최고 관리자 계정의 활성 상태와 권한은 유지해야 합니다.')
        if 'password' in attrs:
            candidate = get_user_model()(username=attrs.get('username', getattr(self.instance, 'username', '')), first_name=attrs.get('first_name', getattr(self.instance, 'first_name', '')))
            try:
                validate_password(attrs['password'], candidate)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({'password': exc.messages}) from exc
        return attrs

    def create(self, values):
        password = values.pop('password')
        role = values.pop('role', None)
        countries = values.pop('managed_countries', [])
        user = get_user_model().objects.create_user(**values, email=values['username'], password=password)
        if role:
            apply_role(user, role, countries)
        return user

    def update(self, instance, values):
        password = values.pop('password', None)
        role = values.pop('role', None)
        countries = values.pop('managed_countries', None)
        if countries is None:
            countries = managed_countries(instance)
        old_username = instance.username
        for key, value in values.items():
            setattr(instance, key, value)
        instance.email = instance.username
        if password is not None:
            instance.set_password(password)
        instance.save()
        if role:
            apply_role(instance, role, countries)
        if old_username != instance.username:
            # 본인 수정·삭제 판단이 끊기지 않도록 작성자 아이디를 저장하는 기능(리전 이슈 등)이 새 아이디로 바꿉니다.
            username_changed.send(sender=type(instance), old_username=old_username, new_username=instance.username)
        if password is not None and instance.pk == self.context['request'].user.pk:
            update_session_auth_hash(self.context['request'], instance)
        return instance


def account_context(request):
    latest = dict(UserActivity.objects.filter(user__isnull=False).values('user').annotate(latest=Max('created_at')).values_list('user', 'latest'))
    return {'request': request, 'sessions': online_sessions(), 'latest_activity': latest}


class AccountsView(AdminView):
    def get(self, request):
        return Response(AccountSerializer(get_user_model().objects.order_by('id'), many=True, context=account_context(request)).data)

    @transaction.atomic
    def post(self, request):
        state = lock_state()
        serializer = AccountSerializer(data=payload(request), context={'request': request})
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError as exc:
            raise ValidationError('이미 사용 중인 아이디입니다.') from exc
        bump(state)
        log_change(request, 'insert', 'auth_user', {'changes': serializer.data})
        return Response(serializer.data, status=201)


class AccountView(AdminView):
    @transaction.atomic
    def patch(self, request, pk):
        state = lock_state()
        instance = get_object_or_404(get_user_model().objects.select_for_update(), pk=pk)
        before = AccountSerializer(instance).data
        serializer = AccountSerializer(instance, data=payload(request), partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError as exc:
            raise ValidationError('이미 사용 중인 아이디입니다.') from exc
        bump(state)
        log_change(request, 'update', 'auth_user', {'before': before, 'changes': serializer.data, 'password_changed': 'password' in request.data})
        return Response(serializer.data)

    @transaction.atomic
    def delete(self, request, pk):
        state = lock_state()
        instance = get_object_or_404(get_user_model().objects.select_for_update(), pk=pk)
        if instance.pk == request.user.pk or instance.is_superuser:
            raise ValidationError('현재 로그인한 계정과 최고 관리자 계정은 삭제할 수 없습니다.')
        if str(payload(request).get('confirm_username', '')) != instance.username:
            raise ValidationError('삭제할 계정의 이메일 아이디를 확인하세요.')
        before = AccountSerializer(instance).data
        instance.delete()
        bump(state)
        log_change(request, 'delete', 'auth_user', {'before': before})
        return Response(status=204)


class AccountActivitiesView(AdminView):
    """계정별 행동 이력(최근 300건). 수정은 변경 항목의 이전 값·새 값, 삭제는 지운 원본을 포함합니다."""

    def get(self, request, pk):
        user = get_object_or_404(get_user_model(), pk=pk)
        rows = UserActivity.objects.filter(Q(user=user) | Q(user__isnull=True, username__iexact=user.username))
        action = request.query_params.get('action')
        if action:
            rows = rows.filter(action=action)
        fields = ('id', 'action', 'target_type', 'target_id', 'summary', 'before_data', 'after_data', 'changes', 'ip_address', 'created_at')
        return Response({
            'account': AccountSerializer(user, context=account_context(request)).data,
            'activities': list(rows.values(*fields)[:300]),
        })
