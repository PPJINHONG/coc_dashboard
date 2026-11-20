from rest_framework import serializers

from core.regional_time import REGION_ZONES, regional_instant
from core.roles import is_admin
from reporting.serializers import month_field

from .models import RegionalNotice


class RegionalNoticeSerializer(serializers.ModelSerializer):
    month = month_field()
    region_name = serializers.CharField(read_only=True)
    country_code = serializers.ChoiceField(choices=tuple(REGION_ZONES), required=False)
    scheduled_local = serializers.CharField(write_only=True, required=False)
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = RegionalNotice
        fields = [
            "id", "month", "region", "region_name", "country_code", "scheduled_at", "scheduled_local",
            "title", "content", "category", "author", "can_edit", "updated_at",
        ]
        read_only_fields = ["id", "month", "region_name", "author", "can_edit", "updated_at"]
        extra_kwargs = {
            "region": {"allow_null": False},
            "scheduled_at": {"required": False},
            "title": {"allow_blank": False},
            "content": {"allow_blank": False},
            "category": {"allow_blank": False},
        }

    def get_can_edit(self, obj):
        request = self.context.get("request")
        return bool(request and is_admin(request.user))

    def validate(self, data):
        for field in ("title", "content", "category"):
            value = data.get(field)
            if isinstance(value, str):
                data[field] = value.strip()
        region = data.get("region")
        country = data.get("country_code")
        if region:
            if region.country_code not in REGION_ZONES or (country and country != region.country_code):
                raise serializers.ValidationError({"region": "선택한 권역과 리전을 확인하세요."})
            country = region.country_code
            data["country_code"] = None
        elif country:
            if self.instance and self.instance.region_id and country == self.instance.country:
                data["country_code"] = None
            else:
                data["region"] = None
        elif self.instance:
            country = self.instance.country
        else:
            raise serializers.ValidationError({"country_code": "권역을 선택하세요."})

        local = data.pop("scheduled_local", None)
        if local is not None:
            if "scheduled_at" in data:
                raise serializers.ValidationError({"scheduled_local": "일정은 하나의 형식으로 입력하세요."})
            data["scheduled_at"] = regional_instant(local, country, "scheduled_local", getattr(self.instance, "scheduled_at", None))
        elif not self.instance and "scheduled_at" not in data:
            raise serializers.ValidationError({"scheduled_local": "작업 일정을 입력하세요."})
        return data

    def to_representation(self, instance):
        values = super().to_representation(instance)
        values["country_code"] = instance.country
        return values
