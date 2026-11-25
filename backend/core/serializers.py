"""이름 로그인·회원가입·내 정보·비밀번호 변경 응답 형식."""

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from rest_framework import serializers

from .security import must_change_password


def normalize_name(value):
    return " ".join(str(value).split())


def validate_account_name(value, instance=None):
    value = normalize_name(value)
    if not value:
        raise serializers.ValidationError("이름을 입력하세요.")
    users = get_user_model().objects.filter(Q(username__iexact=value) | Q(first_name__iexact=value))
    if instance is not None:
        users = users.exclude(pk=instance.pk)
    if users.exists():
        raise serializers.ValidationError("이미 로그인 이름으로 사용 중입니다.")
    return value


def validate_account_email(value, instance=None):
    value = str(value).strip().lower()
    serializers.EmailField(max_length=254).run_validation(value)
    users = get_user_model().objects.filter(email__iexact=value)
    if instance is not None:
        users = users.exclude(pk=instance.pk)
    if users.exists():
        raise serializers.ValidationError("이미 사용 중인 이메일입니다.")
    return value


def validate_account_password(value, *, name=""):
    candidate = get_user_model()(username=name, first_name=name)
    try:
        validate_password(value, user=candidate)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(list(exc.messages)) from exc
    return value


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_username(self, value):
        value = normalize_name(value)
        if not value:
            raise serializers.ValidationError("로그인 이름을 입력하세요.")
        return value


class AccountSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name", max_length=150, allow_blank=False)
    username = serializers.CharField(read_only=True)
    email = serializers.EmailField(max_length=254)
    role = serializers.SerializerMethodField()
    managed_countries = serializers.SerializerMethodField()
    staff_edit_countries = serializers.SerializerMethodField()
    must_change_password = serializers.SerializerMethodField()

    class Meta:
        model = get_user_model()
        fields = (
            "id", "name", "username", "email", "date_joined", "is_staff", "role",
            "managed_countries", "staff_edit_countries", "must_change_password",
        )
        read_only_fields = (
            "id", "username", "date_joined", "is_staff", "role", "managed_countries",
            "staff_edit_countries", "must_change_password",
        )

    def get_role(self, obj):
        from .roles import user_role
        return user_role(obj) if obj.pk else None

    def get_managed_countries(self, obj):
        return []

    def get_staff_edit_countries(self, obj):
        from .roles import staff_edit_countries
        return staff_edit_countries(obj) if obj.pk else []

    def get_must_change_password(self, obj):
        return must_change_password(obj)

    def validate_name(self, value):
        return validate_account_name(value, self.instance)

    def validate_email(self, value):
        return validate_account_email(value, self.instance)


class RegisterSerializer(AccountSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)

    class Meta(AccountSerializer.Meta):
        fields = AccountSerializer.Meta.fields + ("password",)

    def validate_password(self, value):
        name = normalize_name(self.initial_data.get("name", ""))
        return validate_account_password(value, name=name)

    def create(self, validated_data):
        password = validated_data.pop("password")
        name = validated_data.pop("first_name")
        email = validated_data.pop("email")
        return get_user_model().objects.create_user(
            username=name,
            first_name=name,
            email=email,
            password=password,
            is_staff=False,
            is_superuser=False,
        )


class MeSerializer(AccountSerializer):
    pass


class PasswordChangeSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "비밀번호 확인이 일치하지 않습니다."})
        attrs["password"] = validate_account_password(attrs["password"], name=self.context["request"].user.first_name)
        return attrs
