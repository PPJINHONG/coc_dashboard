"""게시판 모델: 글(Post)·댓글(Comment)·첨부 이미지(PostImage).

예전 core 앱에서 옮겨 왔으므로 테이블 이름(core_*)은 그대로 둡니다.
글·이미지가 삭제되면 signals.py가 디스크의 실제 파일도 지웁니다.
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
        db_table = "core_post"
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
        db_table = "core_comment"
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

    class Meta:
        db_table = "core_postimage"

    def __str__(self):
        return f"image#{self.pk} ({self.file.name})"
