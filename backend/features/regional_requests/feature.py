from reporting.registry import Feature, History

from .models import RegionalRequest, RegionalRequestImage


def history_scope(row, snapshots):
    country = row.get('region')
    if not country and row.get('request_id'):
        ticket = snapshots.get(RegionalRequest._meta.label_lower, {}).get(str(row['request_id']), {})
        country = ticket.get('region')
    if country not in RegionalRequest.ASSIGNEE_REGION_CHOICES:
        return {'regions': [], 'countries': []}
    names = {'KR': '한국 (KR)', 'NA': '미국 (NA)', 'EU': '유럽 (EU)'}
    return {'regions': [{'id': country, 'region_name': names[country], 'country_code': country}], 'countries': [country]}


def totals(month):
    return {"regional_requests": RegionalRequest.objects.filter(period_month=month).count()}


FEATURE = Feature(
    tabs=("regional_requests",),
    tables={
        "ops_regional_requests": "권역별 요청작업",
        "ops_regional_request_images": "요청작업 이미지",
    },
    totals=totals,
    histories=(History(key='regional_requests', models=(RegionalRequest, RegionalRequestImage), scope=history_scope),),
)
