"""게시판 슬라이스 모델.

Post(글), Comment(댓글), PostImage(첨부 이미지)를 정의합니다.
글/이미지가 삭제되면 post_delete 시그널로 디스크의 실제 파일도 지웁니다.
"""

from django.conf import settings
from django.db import models


class Post(models.Model):
    """게시글."""

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="posts",
    )
    title = models.CharField(max_length=200)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class Comment(models.Model):
    """게시글 댓글."""

    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"comment#{self.pk} on post#{self.post_id}"


class PostImage(models.Model):
    """게시글 첨부 이미지.

    업로드 시점에는 post 가 null(미첨부)일 수 있고, 글에 첨부되면 채워집니다.
    글이 삭제되면 cascade 로 함께 삭제됩니다.
    """

    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="uploaded_images",
    )
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="images",
        null=True,
        blank=True,
    )
    file = models.ImageField(upload_to="board/%Y/%m/")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"image#{self.pk} ({self.file.name})"


# === 대시보드 슬라이스 ===


class DashboardPanel(models.Model):
    """대시보드 패널(사용자별).

    사용자가 직접 넣은 값(values) 또는 함수식(func_expr)으로 원본 데이터를 만들고,
    변환 수식(formula)을 적용한 결과를 viz_type 형태로 화면에 그립니다.
    수식 계산은 화면에서 하고, 서버는 문법만 검사합니다(core/dashboard_expr.py).
    width/height 는 24칸 격자 기준 칸 수, position 은 표시 순서입니다.
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
        ordering = ["position", "id"]

    def __str__(self):
        return f"panel#{self.pk} {self.title}"
