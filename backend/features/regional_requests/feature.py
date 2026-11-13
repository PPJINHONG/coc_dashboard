from reporting.registry import Feature

from .models import RegionalRequest


def totals(month):
    return {"regional_requests": RegionalRequest.objects.filter(period_month=month).count()}


FEATURE = Feature(
    tabs=("regional_requests",),
    tables={
        "ops_regional_requests": "권역별 요청작업",
        "ops_regional_request_images": "요청작업 이미지",
    },
    totals=totals,
)
