"""로그인·회원가입·내 정보 응답 형식."""

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from rest_framework import serializers


# 이메일 아이디로 세션 로그인합니다. 기존 계정도 로그인할 수 있도록 입력 형식은 제한하지 않습니다.
class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_username(self, value):
        return value.lower()


class AccountSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name", max_length=150, allow_blank=False)
    username = serializers.CharField(max_length=150, allow_blank=False)
    # 관리자(admin)·옵저버(observer, 읽기 전용)·사용자(user). 변경은 DB 관리의 사용자·권한에서만 합니다.
    role = serializers.SerializerMethodField()

    class Meta:
        model = get_user_model()
        fields = ("id", "name", "username", "email", "date_joined", "is_staff", "role")
        read_only_fields = ("id", "email", "date_joined", "is_staff", "role")

    def get_role(self, obj):
        from .roles import user_role

        return user_role(obj) if obj.pk else None

    def validate_username(self, value):
        value = value.lower()
        # 요청한 관리자 아이디는 일반 이메일 검사에서 제외하되, 신규 가입에는 허용하지 않습니다.
        existing_admin = (
            self.instance is not None
            and self.instance.is_superuser
            and self.instance.username == value == "admin"
        )
        if not existing_admin:
            serializers.EmailField(max_length=150).run_validation(value)
        users = get_user_model().objects.filter(Q(username__iexact=value) | Q(email__iexact=value))
        if self.instance is not None:
            users = users.exclude(pk=self.instance.pk)
        if users.exists():
            raise serializers.ValidationError("이미 사용 중인 이메일 아이디입니다.")
        return value

    def validate(self, attrs):
        password = attrs.get("password")
        changing_username = self.instance is not None and attrs.get("username", self.instance.username) != self.instance.username
        if self.instance is not None and (changing_username or password is not None):
            if not self.instance.check_password(attrs.get("current_password", "")):
                raise serializers.ValidationError({"current_password": ["현재 비밀번호가 올바르지 않습니다."]})
        if password is not None:
            candidate = get_user_model()(
                username=attrs.get("username", getattr(self.instance, "username", "")),
                first_name=attrs.get("first_name", getattr(self.instance, "first_name", "")),
            )
            candidate.email = candidate.username
            try:
                validate_password(password, user=candidate)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs


class RegisterSerializer(AccountSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)

    class Meta(AccountSerializer.Meta):
        fields = AccountSerializer.Meta.fields + ("password",)

    def create(self, validated_data):
        return get_user_model().objects.create_user(
            **validated_data, email=validated_data["username"]
        )


class MeSerializer(AccountSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128, required=False)
    current_password = serializers.CharField(write_only=True, trim_whitespace=False, required=False)

    class Meta(AccountSerializer.Meta):
        fields = AccountSerializer.Meta.fields + ("password", "current_password")

    def update(self, instance, validated_data):
        validated_data.pop("current_password", None)
        password = validated_data.pop("password", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if "username" in validated_data:
            instance.email = instance.username
        if password is not None:
            instance.set_password(password)
        instance.save()
        return instance
