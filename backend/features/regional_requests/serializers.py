import re
from datetime import datetime, timedelta, timezone as datetime_timezone
from html.parser import HTMLParser

import nh3
from django.utils import timezone
from rest_framework import serializers

from core.roles import can_write, is_admin

from .models import RegionalRequest, RegionalRequestImage


TIMEZONES = {
    "UTC": datetime_timezone.utc,
    "KST": datetime_timezone(timedelta(hours=9), "KST"),
    "CET": datetime_timezone(timedelta(hours=1), "CET"),
}
IMAGE_PATH = re.compile(r"^/api/operations/regional_requests/images/(\d+)/$")
ALLOWED_TAGS = {
    "p", "br", "strong", "em", "s", "code", "pre", "blockquote",
    "h2", "h3", "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td", "img",
}
ALLOWED_ATTRIBUTES = {
    "img": {"src", "alt", "title"},
    "th": {"colspan", "rowspan"},
    "td": {"colspan", "rowspan"},
}


class _ContentInspector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.image_ids = []
        self.invalid_image = False

    def handle_data(self, data):
        self.text.append(data)

    def handle_starttag(self, tag, attrs):
        if tag != "img":
            return
        src = dict(attrs).get("src", "")
        match = IMAGE_PATH.fullmatch(src)
        if match:
            self.image_ids.append(int(match.group(1)))
        else:
            self.invalid_image = True


def sanitize_content(value):
    cleaned = nh3.clean(
        value or "",
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        url_schemes=set(),
        strip_comments=True,
    ).strip()
    inspector = _ContentInspector()
    inspector.feed(cleaned)
    if inspector.invalid_image:
        raise serializers.ValidationError("업로드한 요청작업 이미지만 본문에 넣을 수 있습니다.")
    if not "".join(inspector.text).strip() and not inspector.image_ids:
        raise serializers.ValidationError("내용을 입력하세요.")
    if len(cleaned) > 100_000:
        raise serializers.ValidationError("내용은 100,000자를 넘을 수 없습니다.")
    return cleaned, list(dict.fromkeys(inspector.image_ids))


def parse_local(value, timezone_code, field_name):
    try:
        parsed = datetime.fromisoformat(value)
    except (TypeError, ValueError) as exc:
        raise serializers.ValidationError({field_name: "날짜와 시간을 확인하세요."}) from exc
    if parsed.tzinfo is not None:
        raise serializers.ValidationError({field_name: "화면에서 선택한 현지 시간 형식으로 입력하세요."})
    return parsed.replace(tzinfo=TIMEZONES[timezone_code]).astimezone(datetime_timezone.utc)


def local_value(value, timezone_code):
    if value is None:
        return None
    return timezone.localtime(value, TIMEZONES[timezone_code]).strftime("%Y-%m-%dT%H:%M")


class RegionalRequestImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = RegionalRequestImage
        fields = ["id", "url", "original_name"]

    def get_url(self, obj):
        return f"/api/operations/regional_requests/images/{obj.pk}/"


class RegionalRequestSerializer(serializers.ModelSerializer):
    month = serializers.SerializerMethodField()
    region_name = serializers.CharField(source="get_region_display", read_only=True)
    schedule_start_local = serializers.CharField(write_only=True, required=False)
    schedule_end_local = serializers.CharField(write_only=True, required=False)
    schedule_start_display = serializers.SerializerMethodField()
    schedule_end_display = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    timezone_label = serializers.CharField(source="get_schedule_timezone_display", read_only=True)
    images = RegionalRequestImageSerializer(many=True, read_only=True)
    can_edit_content = serializers.SerializerMethodField()
    can_update_assignment = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = RegionalRequest
        fields = [
            "id", "month", "region", "region_name", "title", "content_html", "requester",
            "requested_at", "schedule_timezone", "timezone_label", "schedule_start", "schedule_end",
            "schedule_start_local", "schedule_end_local", "schedule_start_display", "schedule_end_display",
            "status", "status_label", "assignee_regions", "assignee_name", "author_name",
            "images", "can_edit_content", "can_update_assignment", "can_delete", "updated_at",
        ]
        read_only_fields = [
            "id", "requested_at", "schedule_start", "schedule_end", "author_name", "updated_at",
        ]
        extra_kwargs = {
            "title": {"allow_blank": False},
            "requester": {"allow_blank": False},
        }

    def get_month(self, obj):
        return obj.period_month.strftime("%Y-%m")

    def get_schedule_start_display(self, obj):
        return local_value(obj.schedule_start, obj.schedule_timezone)

    def get_schedule_end_display(self, obj):
        return local_value(obj.schedule_end, obj.schedule_timezone)

    def get_can_edit_content(self, obj):
        request = self.context.get("request")
        return bool(request and (is_admin(request.user) or (can_write(request.user) and obj.author_id == request.user.pk)))

    def get_can_update_assignment(self, obj):
        request = self.context.get("request")
        return bool(request and can_write(request.user))

    def get_can_delete(self, obj):
        request = self.context.get("request")
        return bool(request and is_admin(request.user))

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("제목을 입력하세요.")
        return value

    def validate_requester(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Requester를 입력하세요.")
        return value

    def validate_content_html(self, value):
        cleaned, image_ids = sanitize_content(value)
        self.context["content_image_ids"] = image_ids
        return cleaned

    def validate_assignee_regions(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("담당 권역은 목록으로 입력하세요.")
        unique = list(dict.fromkeys(value))
        invalid = [item for item in unique if item not in RegionalRequest.ASSIGNEE_REGION_CHOICES]
        if invalid:
            raise serializers.ValidationError("담당 권역은 KR, NA, EU 중에서 선택하세요.")
        return unique

    def validate_assignee_name(self, value):
        return value.strip()

    def validate(self, attrs):
        timezone_code = attrs.get("schedule_timezone") or getattr(self.instance, "schedule_timezone", None)
        if timezone_code not in TIMEZONES:
            raise serializers.ValidationError({"schedule_timezone": "시간대를 선택하세요."})

        start_local = attrs.pop("schedule_start_local", None)
        end_local = attrs.pop("schedule_end_local", None)
        if self.instance is None and (start_local is None or end_local is None):
            raise serializers.ValidationError({"schedule_start_local": "작업 시작과 종료 시간을 입력하세요."})
        if (start_local is None) != (end_local is None):
            raise serializers.ValidationError({"schedule_start_local": "작업 시작과 종료 시간을 함께 입력하세요."})
        if start_local is not None:
            attrs["schedule_start"] = parse_local(start_local, timezone_code, "schedule_start_local")
            attrs["schedule_end"] = parse_local(end_local, timezone_code, "schedule_end_local")

        start = attrs.get("schedule_start") or getattr(self.instance, "schedule_start", None)
        end = attrs.get("schedule_end") or getattr(self.instance, "schedule_end", None)
        if start and end and end <= start:
            raise serializers.ValidationError({"schedule_end_local": "종료 시간은 시작 시간보다 늦어야 합니다."})
        return attrs
