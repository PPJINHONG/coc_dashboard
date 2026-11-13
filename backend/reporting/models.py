"""운영 공통 모델: 리전·서비스·인력 공통데이터, 동시 수정 버전, 변경 이력, 개인 화면 설정.

기능별 테이블(인프라 자원·운영 작업·리전 이슈는 월별, 운영 인력은 현재값)은 backend/features/<기능>/models.py에 있습니다.
"""

from django.db import models
from django.db.models import Case, Q, Value, When

from .months import current_month

# 전체 리전(내수·유럽·북미)은 국가 코드에서 DB가 자동 계산합니다. 아직 화면·API에서는 사용하지 않습니다.
GLOBAL_REGION_EXPRESSION = Case(
    When(country_code__in=['KR', 'CN'], then=Value('내수')),
    When(country_code='EU', then=Value('유럽')),
    When(country_code='NA', then=Value('북미')),
    default=None,
)


class Region(models.Model):
    region_name = models.CharField(max_length=80, unique=True)
    country_code = models.CharField(max_length=10, default='KR', db_default='KR')
    global_region = models.GeneratedField(
        expression=GLOBAL_REGION_EXPRESSION,
        output_field=models.CharField(max_length=10, null=True),
        db_persist=True,
    )

    class Meta:
        db_table = 'ops_regions'
        db_table_comment = '리전 공통데이터'
        ordering = ['region_name', 'id']


class Service(models.Model):
    service_code = models.CharField(max_length=40, primary_key=True)
    service_name = models.CharField(max_length=80, unique=True)

    class Meta:
        db_table = 'ops_services'
        db_table_comment = '인프라 서비스 공통데이터'
        ordering = ['service_code']


class StaffMember(models.Model):
    staff_name = models.CharField(max_length=100)

    class Meta:
        db_table = 'ops_staff_members'
        db_table_comment = '운영 인력 공통데이터'
        ordering = ['staff_name', 'id']


class DataState(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    revision = models.PositiveIntegerField(default=0, db_default=0)
    updated_at = models.DateTimeField(auto_now=True, db_default=models.functions.Now())

    class Meta:
        db_table = 'ops_data_state'
        db_table_comment = '운영 데이터 동시 수정 버전'
        constraints = [models.CheckConstraint(condition=Q(id=1), name='single_operations_state')]


class CurrentRow(models.Model):
    """기능 앱의 리전별 월별 테이블이 상속하는 공통 열(기준 월·리전·수정 시각).

    기준 월은 그 달 1일 날짜입니다. 1일만 허용하는 검사 제약은 각 모델 Meta에 둡니다(month_first_day_check).
    """

    period_month = models.DateField(default=current_month, db_index=True, db_comment='기준 월(그 달 1일)')
    region = models.ForeignKey(Region, on_delete=models.PROTECT)
    updated_at = models.DateTimeField(auto_now=True, db_default=models.functions.Now())

    class Meta:
        abstract = True


def month_first_day_check(name):
    return models.CheckConstraint(condition=Q(period_month__day=1), name=name)


class ChangeLog(models.Model):
    section = models.CharField(max_length=30)
    # 월별 기능 데이터의 기준 월. 공통데이터·운영 인력 변경은 비워 둡니다.
    period_month = models.DateField(null=True, blank=True, db_index=True, db_comment='변경한 데이터의 기준 월(그 달 1일)')
    action = models.CharField(max_length=30)
    actor_name = models.CharField(max_length=150)
    actor_username = models.CharField(max_length=150, blank=True, default='', db_default='')
    summary = models.CharField(max_length=300)
    before_data = models.JSONField(default=dict, db_default={})
    after_data = models.JSONField(default=dict, db_default={})
    created_at = models.DateTimeField(auto_now_add=True, db_default=models.functions.Now())

    class Meta:
        db_table = 'ops_change_logs'
        db_table_comment = '운영 데이터 변경 이력'
        ordering = ['-created_at', '-id']


class NavigationPreference(models.Model):
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE, null=True, blank=True)
    browser_key = models.UUIDField(unique=True, null=True, blank=True)
    hidden_tabs = models.JSONField(default=list, db_default=[])
    sidebar_collapsed = models.BooleanField(default=False, db_default=False)
    updated_at = models.DateTimeField(auto_now=True, db_default=models.functions.Now())

    class Meta:
        db_table = 'ui_navigation_preferences'
        db_table_comment = '사용자·브라우저별 탭 표시와 사이드바 설정'
        constraints = [models.CheckConstraint(
            condition=(Q(user__isnull=False, browser_key__isnull=True) | Q(user__isnull=True, browser_key__isnull=False)),
            name='navigation_preference_single_owner',
        )]
