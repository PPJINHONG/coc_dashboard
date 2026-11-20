from django.db import models

from reporting.models import CurrentRow, Region, month_first_day_check


class RegionalNotice(CurrentRow):
    # Older notices retain their selected master region. New notices select a country directly.
    region = models.ForeignKey(Region, null=True, blank=True, on_delete=models.PROTECT)
    country_code = models.CharField(max_length=2, null=True, blank=True)

    @property
    def country(self):
        return self.country_code or self.region.country_code

    @property
    def region_name(self):
        return self.region.region_name if self.region_id else self.country_code

    scheduled_at = models.DateTimeField(db_index=True, db_comment="작업 일정(KST)")
    title = models.CharField(max_length=200)
    content = models.TextField()
    category = models.CharField(max_length=80)
    author = models.CharField(max_length=100)

    class Meta:
        db_table = "ops_regional_notices"
        db_table_comment = "월별 권역 작업공지"
        ordering = ["scheduled_at", "region__region_name", "id"]
        constraints = [
            month_first_day_check("regional_notice_month_first_day"),
            models.CheckConstraint(
                condition=(models.Q(region__isnull=False, country_code__isnull=True)
                           | models.Q(region__isnull=True, country_code__isnull=False, country_code__in=["KR", "EU", "NA"])),
                name="regional_notice_valid_country",
            ),
        ]
