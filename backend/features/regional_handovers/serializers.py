import re
from html.parser import HTMLParser

import nh3
from rest_framework import serializers

from core.roles import can_write, is_admin

from .models import RegionalHandover, RegionalHandoverImage


IMAGE_PATH = re.compile(r"^/api/operations/regional_handovers/images/(\d+)/$")
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

    def inspect_image(self, attrs):
        src = dict(attrs).get("src", "")
        match = IMAGE_PATH.fullmatch(src)
        if match:
            self.image_ids.append(int(match.group(1)))
        else:
            self.invalid_image = True

    def handle_starttag(self, tag, attrs):
        if tag == "img":
            self.inspect_image(attrs)

    def handle_startendtag(self, tag, attrs):
        if tag == "img":
            self.inspect_image(attrs)


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
        raise serializers.ValidationError("이 핸드오버에 업로드한 이미지만 본문에 넣을 수 있습니다.")
    if not "".join(inspector.text).strip() and not inspector.image_ids:
        raise serializers.ValidationError("내용을 입력하세요.")
    if len(cleaned) > 100_000:
        raise serializers.ValidationError("내용은 100,000자를 넘을 수 없습니다.")
    return cleaned, list(dict.fromkeys(inspector.image_ids))


class RegionalHandoverImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = RegionalHandoverImage
        fields = ["id", "url", "original_name"]

    def get_url(self, obj):
        return f"/api/operations/regional_handovers/images/{obj.pk}/"


class RegionalHandoverSerializer(serializers.ModelSerializer):
    region_label = serializers.CharField(source="get_region_display", read_only=True)
    priority_label = serializers.CharField(source="get_priority_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    images = RegionalHandoverImageSerializer(many=True, read_only=True)
    can_edit = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = RegionalHandover
        fields = [
            "id", "region", "region_label", "priority", "priority_label", "status", "status_label",
            "category", "category_label", "title", "content_html", "author_name", "images",
            "can_edit", "can_delete", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "region_label", "priority_label", "status_label", "category_label", "author_name",
            "images", "can_edit", "can_delete", "created_at", "updated_at",
        ]
        extra_kwargs = {"title": {"allow_blank": False}, "content_html": {"allow_blank": False}}

    def get_can_edit(self, obj):
        request = self.context.get("request")
        return bool(request and (is_admin(request.user) or (can_write(request.user) and obj.author_id == request.user.pk)))

    def get_can_delete(self, obj):
        request = self.context.get("request")
        return bool(request and is_admin(request.user))

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("제목을 입력하세요.")
        return value

    def validate_content_html(self, value):
        cleaned, image_ids = sanitize_content(value)
        self.context["content_image_ids"] = image_ids
        return cleaned
