"""기준 월(period_month) 도구.

기능별 데이터(인프라 자원·운영 작업)는 월마다 따로 저장합니다. 운영 인력은 월 구분이 없습니다.
기준 월은 그 달 1일 날짜(DATE)로 저장하고, API에서는 `YYYY-MM` 문자열로 주고받습니다.
월을 보내지 않으면 이번 달(서버 시간대 Asia/Seoul)로 처리합니다.
"""

from datetime import date

from django.utils import timezone
from rest_framework.exceptions import ValidationError


def current_month():
    return timezone.localdate().replace(day=1)


def parse_month(value):
    """`YYYY-MM`(또는 그 달 1일 `YYYY-MM-01`)을 그 달 1일 날짜로 바꿉니다. 비어 있으면 이번 달입니다."""
    if value is None or value == '':
        return current_month()
    if isinstance(value, date):
        return value.replace(day=1)
    text = str(value).strip()
    try:
        if len(text) == 7:
            year, month = text.split('-')
            return date(int(year), int(month), 1)
        parsed = date.fromisoformat(text)
    except ValueError as exc:
        raise ValidationError({'month': ['기준 월은 YYYY-MM 형식으로 보내세요.']}) from exc
    if parsed.day != 1:
        raise ValidationError({'month': ['기준 월은 YYYY-MM 형식으로 보내세요.']})
    return parsed


def request_month(request):
    """조회는 주소의 `?month=`, 저장은 본문의 `month`에서 기준 월을 읽습니다."""
    value = request.query_params.get('month')
    if value is None and isinstance(request.data, dict):
        value = request.data.get('month')
    return parse_month(value)


def month_label(value):
    return value.strftime('%Y-%m') if value else None
