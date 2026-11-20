from reporting.models import Region
from reporting.registry import Feature, History

from .models import RegionalNotice


def history_scope(row, snapshots):
    country = row.get("country_code")
    if country:
        region = {"id": country, "region_name": country, "country_code": country}
    else:
        region = Region.objects.filter(pk=row.get("region_id")).values("id", "region_name", "country_code").first()
    return {"regions": [region], "countries": [region["country_code"]]} if region else {"regions": [], "countries": []}


def totals(month):
    return {"regional_notices": RegionalNotice.objects.filter(period_month=month).count()}


FEATURE = Feature(
    tabs=("regional_notices",),
    tables={"ops_regional_notices": "권역별 작업공지"},
    histories=(History(key="regional_notices", models=(RegionalNotice,), scope=history_scope),),
    totals=totals,
)
