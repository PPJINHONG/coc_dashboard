from django.conf import settings
from django.db import models


class DashboardPanel(models.Model):
    """대시보드 패널(사용자별).

    사용자가 직접 넣은 값(values) 또는 함수식(func_expr)으로 원본 데이터를 만들고,
    변환 수식(formula)을 적용한 결과를 viz_type 형태로 화면에 그립니다.
    수식 계산은 화면에서 하고, 서버는 문법만 검사합니다(expr.py).
    width/height 는 24칸 격자 기준 칸 수, position 은 표시 순서입니다.
    예전 core 앱에서 옮겨 왔으므로 테이블 이름(core_dashboardpanel)은 그대로 둡니다.
    """

    VIZ_CHOICES = [
        ("stat", "숫자"),
        ("timeseries", "시계열"),
        ("bar", "막대"),
        ("gauge", "게이지"),
        ("table", "표"),
    ]
    SOURCE_CHOICES = [("manual", "직접 입력"), ("function", "함수식")]

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="dashboard_panels",
    )
    title = models.CharField(max_length=100)
    description = models.CharField(max_length=300, blank=True, default="")
    viz_type = models.CharField(max_length=20, choices=VIZ_CHOICES, default="timeseries")
    source = models.CharField(max_length=10, choices=SOURCE_CHOICES, default="manual")
    # 직접 입력: [{"label": "월", "value": 12.5}, ...]
    values = models.JSONField(default=list, blank=True)
    # 함수식: t 를 func_from 부터 func_to 까지 func_step 간격으로 넣어 계산
    func_expr = models.CharField(max_length=200, blank=True, default="")
    func_from = models.FloatField(default=0)
    func_to = models.FloatField(default=10)
    func_step = models.FloatField(default=1)
    # 변환 수식: x(원본 값) 등을 받아 표시 값을 계산. 비우면 원본 그대로
    formula = models.CharField(max_length=200, blank=True, default="")
    # 단위·소수 자리·최소/최대·계산 방식·색·임계값
    options = models.JSONField(default=dict, blank=True)
    width = models.PositiveSmallIntegerField(default=12)
    height = models.PositiveSmallIntegerField(default=8)
    position = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "core_dashboardpanel"
        ordering = ["position", "id"]

    def __str__(self):
        return f"panel#{self.pk} {self.title}"
