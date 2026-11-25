"""관리자 전용 회원 계정 API와 행동 이력."""

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Max, Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.models import UserActivity
from core.roles import ROLE_ADMIN, ROLE_USER, ROLES, apply_role, can_manage_account, is_admin, online_sessions, record_activity, user_role
from core.security import INITIAL_PASSWORD, invalidate_user_sessions, must_change_password, set_password_change_required
from core.serializers import normalize_name, validate_account_email, validate_account_name
from core.signals import username_changed
from reporting.services import bump, lock_state, record_log

from .services import log_change
from .views import AdminView, payload


class AccountSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name", max_length=150)
    username = serializers.CharField(read_only=True)
    email = serializers.EmailField(max_length=254)
    role = serializers.ChoiceField(choices=ROLES, required=False, default=ROLE_USER)
    managed_countries = serializers.SerializerMethodField()
    is_staff = serializers.BooleanField(read_only=True)
    is_online = serializers.SerializerMethodField()
    active_sessions = serializers.SerializerMethodField()
    last_activity = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    must_change_password = serializers.SerializerMethodField()

    class Meta:
        model = get_user_model()
        fields = [
            "id", "name", "username", "email", "role", "managed_countries", "is_staff", "is_active",
            "date_joined", "last_login", "is_online", "active_sessions", "last_activity", "can_edit",
            "must_change_password",
        ]
        read_only_fields = ["id", "username", "managed_countries", "is_staff", "date_joined", "last_login", "must_change_password"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["role"] = user_role(instance)
        return data

    def get_managed_countries(self, obj):
        return []

    def get_active_sessions(self, obj):
        sessions = self.context.get("sessions")
        return (sessions if sessions is not None else online_sessions()).get(obj.pk, 0)

    def get_can_edit(self, obj):
        request = self.context.get("request")
        return bool(request and can_manage_account(request.user, obj))

    def get_is_online(self, obj):
        return self.get_active_sessions(obj) > 0

    def get_last_activity(self, obj):
        latest = self.context.get("latest_activity")
        value = latest.get(obj.pk) if latest is not None else UserActivity.objects.filter(user=obj).values_list("created_at", flat=True).first()
        return value.isoformat() if value else None

    def get_must_change_password(self, obj):
        return must_change_password(obj)

    def validate_name(self, value):
        return validate_account_name(value, self.instance)

    def validate_email(self, value):
        return validate_account_email(value, self.instance)

    def validate(self, attrs):
        actor = self.context["request"].user
        if self.instance and not can_manage_account(actor, self.instance):
            raise serializers.ValidationError("현재 로그인한 관리자 또는 최고 관리자 계정은 변경할 수 없습니다.")
        role = attrs.get("role", user_role(self.instance) if self.instance else ROLE_USER)
        if role not in (ROLE_ADMIN, ROLE_USER):
            raise serializers.ValidationError({"role": "역할은 관리자 또는 책임 중에서 선택하세요."})
        if self.instance and self.instance.is_superuser and (role != ROLE_ADMIN or attrs.get("is_active") is False):
            raise serializers.ValidationError("최고 관리자 계정의 상태와 권한은 유지해야 합니다.")
        return attrs

    def create(self, values):
        role = values.pop("role", ROLE_USER)
        name = values.pop("first_name")
        email = values.pop("email")
        user = get_user_model().objects.create_user(
            username=name,
            first_name=name,
            email=email,
            password=INITIAL_PASSWORD,
            is_active=values.pop("is_active", True),
        )
        apply_role(user, role)
        set_password_change_required(user, True)
        return user

    def update(self, instance, values):
        role = values.pop("role", None)
        old_username = instance.username
        if "first_name" in values:
            name = values.pop("first_name")
            instance.first_name = name
            instance.username = name
        if "email" in values:
            instance.email = values.pop("email")
        for key, value in values.items():
            setattr(instance, key, value)
        instance.save()
        if role is not None:
            apply_role(instance, role)
        if old_username != instance.username:
            username_changed.send(sender=type(instance), old_username=old_username, new_username=instance.username)
        return instance


def account_context(request):
    latest = dict(UserActivity.objects.filter(user__isnull=False).values("user").annotate(latest=Max("created_at")).values_list("user", "latest"))
    return {"request": request, "sessions": online_sessions(), "latest_activity": latest}


def audit_data(data):
    return {key: data[key] for key in ("id", "name", "username", "email", "role", "is_staff", "is_active", "must_change_password")}


class AccountsView(AdminView):
    def get(self, request):
        return Response(AccountSerializer(get_user_model().objects.order_by("first_name", "id"), many=True, context=account_context(request)).data)

    @transaction.atomic
    def post(self, request):
        state = lock_state()
        serializer = AccountSerializer(data=payload(request), context={"request": request})
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save()
        except IntegrityError as exc:
            raise ValidationError("이미 사용 중인 이름 또는 이메일입니다.") from exc
        bump(state)
        log_change(request, "insert", "auth_user", {"changes": serializer.data})
        after = audit_data(serializer.data)
        record_activity(request, "create", "회원 등록 · 초기 비밀번호 설정", "account", serializer.instance.pk, after=after)
        record_log(request, "members", "create", "회원 등록", after=after)
        return Response(serializer.data, status=201)


class AccountView(AdminView):
    @transaction.atomic
    def patch(self, request, pk):
        state = lock_state()
        instance = get_object_or_404(get_user_model().objects.select_for_update(), pk=pk)
        before = AccountSerializer(instance, context=account_context(request)).data
        serializer = AccountSerializer(instance, data=payload(request), partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save()
        except IntegrityError as exc:
            raise ValidationError("이미 사용 중인 이름 또는 이메일입니다.") from exc
        bump(state)
        after = audit_data(serializer.data)
        log_change(request, "update", "auth_user", {"before": before, "changes": serializer.data})
        record_activity(request, "update", "회원 정보 수정", "account", instance.pk, before=audit_data(before), after=after)
        record_log(request, "members", "update", "회원 정보 수정", before=audit_data(before), after=after)
        return Response(serializer.data)

    @transaction.atomic
    def delete(self, request, pk):
        state = lock_state()
        instance = get_object_or_404(get_user_model().objects.select_for_update(), pk=pk)
        if not can_manage_account(request.user, instance):
            raise ValidationError("현재 로그인한 관리자와 최고 관리자 계정은 삭제할 수 없습니다.")
        confirm_name = str(payload(request).get("confirm_name", payload(request).get("confirm_username", "")))
        if normalize_name(confirm_name).casefold() != instance.username.casefold():
            raise ValidationError("삭제할 회원의 이름을 확인하세요.")
        before = AccountSerializer(instance, context=account_context(request)).data
        target_id = instance.pk
        instance.delete()
        bump(state)
        log_change(request, "delete", "auth_user", {"before": before})
        record_activity(request, "delete", "회원 삭제", "account", target_id, before=audit_data(before))
        record_log(request, "members", "delete", "회원 삭제", before=audit_data(before))
        return Response(status=204)


class AccountPasswordResetView(AdminView):
    @transaction.atomic
    def post(self, request, pk):
        state = lock_state()
        instance = get_object_or_404(get_user_model().objects.select_for_update(), pk=pk)
        if not can_manage_account(request.user, instance):
            raise ValidationError("현재 로그인한 관리자와 최고 관리자 비밀번호는 초기화할 수 없습니다.")
        was_required = must_change_password(instance)
        instance.set_password(INITIAL_PASSWORD)
        instance.save(update_fields=["password"])
        set_password_change_required(instance, True)
        invalidate_user_sessions(instance)
        bump(state)
        summary = f"회원 비밀번호 초기화: {instance.first_name}"
        log_change(request, "update", "auth_user", {"user_id": instance.pk, "password_reset": True})
        record_activity(request, "update", summary, "account", instance.pk, before={"must_change_password": was_required}, after={"must_change_password": True, "password_reset": True})
        record_log(request, "members", "update", summary, before={"id": instance.pk, "must_change_password": was_required}, after={"id": instance.pk, "must_change_password": True, "password_reset": True})
        return Response({"id": instance.pk, "must_change_password": True})


class AccountActivitiesView(AdminView):
    def get(self, request, pk):
        user = get_object_or_404(get_user_model(), pk=pk)
        rows = UserActivity.objects.filter(Q(user=user) | Q(user__isnull=True, username__iexact=user.username))
        action = request.query_params.get("action")
        if action:
            rows = rows.filter(action=action)
        fields = ("id", "action", "target_type", "target_id", "summary", "before_data", "after_data", "changes", "ip_address", "created_at")
        return Response({
            "account": AccountSerializer(user, context=account_context(request)).data,
            "activities": list(rows.values(*fields)[:300]),
        })
