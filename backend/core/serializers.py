from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from rest_framework import serializers


# API 응답 구조를 정의하면 Swagger에도 같은 구조가 표시됩니다.
class ErrorSerializer(serializers.Serializer):
    error = serializers.CharField()


# 이메일 아이디로 세션 로그인합니다. 기존 계정도 로그인할 수 있도록 입력 형식은 제한하지 않습니다.
class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_username(self, value):
        return value.lower()


class AccountSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name", max_length=150, allow_blank=False)
    username = serializers.CharField(max_length=150, allow_blank=False)

    class Meta:
        model = get_user_model()
        fields = ("id", "name", "username", "email", "date_joined", "is_staff")
        read_only_fields = ("id", "email", "date_joined", "is_staff")

    def validate_username(self, value):
        value = value.lower()
        # 요청한 관리자 아이디는 일반 이메일 검사에서 제외하되, 신규 가입에는 허용하지 않습니다.
        existing_admin = (
            self.instance is not None
            and self.instance.is_superuser
            and self.instance.username == value == "admin@admin"
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


# === 게시판 슬라이스 ===

from .models import Comment, Post, PostImage  # noqa: E402


class PostImageSerializer(serializers.ModelSerializer):
    """첨부 이미지: 파일은 /api/board/images/<id>/ 로만 제공합니다."""

    url = serializers.SerializerMethodField()

    class Meta:
        model = PostImage
        fields = ("id", "url")

    def get_url(self, obj):
        return f"/api/board/images/{obj.id}/"


class CommentSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source="author.username", read_only=True)
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ("id", "content", "author", "created_at", "updated_at", "is_mine")

    def get_is_mine(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and obj.author_id == request.user.id)


class CommentWriteSerializer(serializers.Serializer):
    """댓글 생성/수정 입력. 공백만이면 거부합니다."""

    content = serializers.CharField(trim_whitespace=True, allow_blank=False)


class PostListSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source="author.username", read_only=True)
    comment_count = serializers.IntegerField(read_only=True)
    image_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Post
        fields = (
            "id",
            "title",
            "author",
            "created_at",
            "updated_at",
            "comment_count",
            "image_count",
        )


class PostDetailSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source="author.username", read_only=True)
    is_mine = serializers.SerializerMethodField()
    images = PostImageSerializer(many=True, read_only=True)
    comments = CommentSerializer(many=True, read_only=True)

    class Meta:
        model = Post
        fields = (
            "id",
            "title",
            "content",
            "author",
            "created_at",
            "updated_at",
            "is_mine",
            "images",
            "comments",
        )

    def get_is_mine(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and obj.author_id == request.user.id)


class PostWriteSerializer(serializers.Serializer):
    """글 생성/수정 입력. title/content 공백만이면 400, image_ids 로 첨부 교체."""

    title = serializers.CharField(max_length=200, trim_whitespace=True, allow_blank=False)
    content = serializers.CharField(trim_whitespace=True, allow_blank=False)
    image_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=True
    )


# === 대시보드 슬라이스 ===

import math  # noqa: E402

from .dashboard_expr import FORMULA_VARS, FUNCTION_VARS, ExprError, validate_expression  # noqa: E402
from .models import DashboardPanel  # noqa: E402

MAX_VALUES = 200
MAX_LABEL_LENGTH = 30
MAX_FUNCTION_POINTS = 500
MAX_THRESHOLDS = 10
PANEL_MIN_WIDTH, PANEL_MAX_WIDTH = 3, 24
PANEL_MIN_HEIGHT, PANEL_MAX_HEIGHT = 3, 20

UNITS = {"none", "percent", "ms", "s", "bytes", "count", "krw", "custom"}
COLORS = {"blue", "green", "purple", "orange", "red", "yellow"}
REDUCERS = {"last", "first", "sum", "avg", "min", "max", "count"}
DEFAULT_OPTIONS = {
    "unit": "none",
    "unit_suffix": "",
    "decimals": None,
    "min": None,
    "max": None,
    "reduce": "last",
    "color": "blue",
    "thresholds": [],
}


def _is_number(value):
    # JSON true/false 는 파이썬에서 int 로 취급되므로 따로 막습니다.
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _optional_number(options, key, errors):
    value = options[key]
    if value is not None and not _is_number(value):
        errors.append(f"{key}는 숫자이거나 비어 있어야 합니다.")


def normalize_options(raw):
    """옵션을 검사하고 빠진 항목은 기본값으로 채워 돌려줍니다. 틀리면 ValidationError."""
    if not isinstance(raw, dict):
        raise serializers.ValidationError("옵션은 객체여야 합니다.")
    unknown = sorted(set(raw) - set(DEFAULT_OPTIONS))
    if unknown:
        raise serializers.ValidationError(f"알 수 없는 옵션입니다: {', '.join(unknown)}")
    options = {**DEFAULT_OPTIONS, **raw}
    errors = []
    if options["unit"] not in UNITS:
        errors.append("단위(unit) 값이 올바르지 않습니다.")
    if not isinstance(options["unit_suffix"], str) or len(options["unit_suffix"]) > 10:
        errors.append("사용자 단위(unit_suffix)는 10자 이하 문자열이어야 합니다.")
    decimals = options["decimals"]
    if decimals is not None and (not isinstance(decimals, int) or isinstance(decimals, bool) or not 0 <= decimals <= 6):
        errors.append("소수 자리(decimals)는 0~6 또는 비어 있어야 합니다.")
    _optional_number(options, "min", errors)
    _optional_number(options, "max", errors)
    if _is_number(options["min"]) and _is_number(options["max"]) and options["min"] >= options["max"]:
        errors.append("최소값은 최대값보다 작아야 합니다.")
    if options["reduce"] not in REDUCERS:
        errors.append("계산 방식(reduce) 값이 올바르지 않습니다.")
    if options["color"] not in COLORS:
        errors.append("색(color) 값이 올바르지 않습니다.")
    thresholds = options["thresholds"]
    if not isinstance(thresholds, list) or len(thresholds) > MAX_THRESHOLDS:
        errors.append(f"임계값(thresholds)은 {MAX_THRESHOLDS}개 이하 목록이어야 합니다.")
    else:
        for step in thresholds:
            if not (isinstance(step, dict) and set(step) == {"value", "color"} and _is_number(step["value"]) and step["color"] in COLORS):
                errors.append("임계값은 {value: 숫자, color: 색} 형식이어야 합니다.")
                break
        else:
            options["thresholds"] = sorted(thresholds, key=lambda s: s["value"])
    if errors:
        raise serializers.ValidationError(errors)
    return options


class DashboardPanelSerializer(serializers.ModelSerializer):
    """패널 조회·생성·수정. PATCH 에서 options 를 보내면 옵션 전체를 교체합니다."""

    title = serializers.CharField(max_length=100, trim_whitespace=True, allow_blank=False)
    description = serializers.CharField(max_length=300, trim_whitespace=True, allow_blank=True, required=False)
    func_expr = serializers.CharField(max_length=200, trim_whitespace=True, allow_blank=True, required=False)
    formula = serializers.CharField(max_length=200, trim_whitespace=True, allow_blank=True, required=False)
    width = serializers.IntegerField(min_value=PANEL_MIN_WIDTH, max_value=PANEL_MAX_WIDTH, required=False)
    height = serializers.IntegerField(min_value=PANEL_MIN_HEIGHT, max_value=PANEL_MAX_HEIGHT, required=False)

    class Meta:
        model = DashboardPanel
        fields = (
            "id",
            "title",
            "description",
            "viz_type",
            "source",
            "values",
            "func_expr",
            "func_from",
            "func_to",
            "func_step",
            "formula",
            "options",
            "width",
            "height",
            "position",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("position", "created_at", "updated_at")

    def validate_values(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("값 목록은 배열이어야 합니다.")
        if len(value) > MAX_VALUES:
            raise serializers.ValidationError(f"값은 {MAX_VALUES}개까지 입력할 수 있습니다.")
        rows = []
        for idx, row in enumerate(value, start=1):
            if not isinstance(row, dict) or set(row) - {"label", "value"} or "value" not in row:
                raise serializers.ValidationError(f"{idx}번째 값은 {{label, value}} 형식이어야 합니다.")
            if not _is_number(row["value"]):
                raise serializers.ValidationError(f"{idx}번째 값이 숫자가 아닙니다.")
            label = row.get("label", "")
            if not isinstance(label, str) or len(label) > MAX_LABEL_LENGTH:
                raise serializers.ValidationError(f"{idx}번째 라벨은 {MAX_LABEL_LENGTH}자 이하 문자열이어야 합니다.")
            rows.append({"label": label.strip(), "value": row["value"]})
        return rows

    def validate_formula(self, value):
        if value:
            try:
                validate_expression(value, FORMULA_VARS)
            except ExprError as exc:
                raise serializers.ValidationError(str(exc))
        return value

    def validate_func_expr(self, value):
        if value:
            try:
                validate_expression(value, FUNCTION_VARS)
            except ExprError as exc:
                raise serializers.ValidationError(str(exc))
        return value

    def validate_options(self, value):
        return normalize_options(value)

    def validate(self, attrs):
        instance = self.instance

        def current(key):
            if key in attrs:
                return attrs[key]
            return getattr(instance, key) if instance is not None else DashboardPanel._meta.get_field(key).default

        if current("source") == "function":
            if not current("func_expr"):
                raise serializers.ValidationError({"func_expr": ["함수식을 입력해 주세요."]})
            start, end, step = current("func_from"), current("func_to"), current("func_step")
            for key, num in (("func_from", start), ("func_to", end), ("func_step", step)):
                if not math.isfinite(num):
                    raise serializers.ValidationError({key: ["유한한 숫자를 입력해 주세요."]})
            if step <= 0:
                raise serializers.ValidationError({"func_step": ["간격은 0보다 커야 합니다."]})
            if end < start:
                raise serializers.ValidationError({"func_to": ["끝 값은 시작 값보다 크거나 같아야 합니다."]})
            if math.floor((end - start) / step + 1e-9) + 1 > MAX_FUNCTION_POINTS:
                raise serializers.ValidationError(
                    {"func_step": [f"점이 {MAX_FUNCTION_POINTS}개를 넘습니다. 간격을 늘리거나 범위를 줄여 주세요."]}
                )
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # 예전 데이터나 빈 옵션도 화면이 같은 모양으로 받도록 기본값을 채웁니다.
        data["options"] = {**DEFAULT_OPTIONS, **(instance.options or {})}
        return data


class PanelReorderSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=True)
