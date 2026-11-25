from reporting.registry import Feature, History

from .models import RegionalHandover, RegionalHandoverImage


REGION_NAMES = {"KR": "한국 (KR)", "EU": "유럽 (EU)", "NA": "미국 (NA)"}


def history_scope(row, snapshots):
    country = row.get("region")
    if not country and row.get("handover_id"):
        handover = snapshots.get(RegionalHandover._meta.label_lower, {}).get(str(row["handover_id"]), {})
        country = handover.get("region")
    if country not in REGION_NAMES:
        return {"regions": [], "countries": []}
    return {
        "regions": [{"id": country, "region_name": REGION_NAMES[country], "country_code": country}],
        "countries": [country],
    }


def totals(month):
    rows = RegionalHandover.objects.all()
    return {
        "regional_handovers": rows.count(),
        "regional_handovers_active": rows.exclude(status=RegionalHandover.STATUS_COMPLETED).count(),
    }


FEATURE = Feature(
    tabs=("regional_handovers",),
    tables={
        "ops_regional_handovers": "권역별 핸드오버",
        "ops_regional_handover_images": "핸드오버 이미지",
    },
    totals=totals,
    histories=(
        History(
            key="regional_handovers",
            models=(RegionalHandover, RegionalHandoverImage),
            scope=history_scope,
        ),
    ),
)
