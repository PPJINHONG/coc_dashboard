from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from rest_framework import serializers


REGION_ZONES = {"KR": "Asia/Seoul", "EU": "Europe/Berlin", "NA": "America/Los_Angeles"}


def regional_instant(value, country, field, original=None):
    """Resolve a wall time in its region, retaining the original occurrence when editing."""
    zone = ZoneInfo(REGION_ZONES[country])
    try:
        local = datetime.fromisoformat(value)
        if local.tzinfo is not None:
            raise ValueError
    except (TypeError, ValueError) as exc:
        raise serializers.ValidationError({field: "해당 권역의 날짜와 시간을 입력하세요."}) from exc
    if original and original.astimezone(zone).strftime("%Y-%m-%dT%H:%M") == value:
        return original
    instant = local.replace(tzinfo=zone, fold=0).astimezone(timezone.utc)
    if instant.astimezone(zone).replace(tzinfo=None) != local:
        raise serializers.ValidationError({field: "서머타임 전환으로 존재하지 않는 현지 시각입니다."})
    return instant
