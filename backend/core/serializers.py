from django.contrib.auth import get_user_model
from rest_framework import serializers


# API 응답 구조를 정의하면 Swagger에도 같은 구조가 표시됩니다.
class TestRowSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    message = serializers.CharField()


class TestListSerializer(serializers.Serializer):
    results = TestRowSerializer(many=True)


class ErrorSerializer(serializers.Serializer):
    error = serializers.CharField()


# 슬라이스1: 세션 로그인 입력 검증
class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


# 슬라이스1: 회원 정보 조회/수정 (username·date_joined는 읽기전용)
class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ("username", "first_name", "last_name", "email", "date_joined")
        read_only_fields = ("username", "date_joined")


# === 게시판 슬라이스 ===

from .models import Comment, Post, PostImage  # noqa: E402


class PostImageSerializer(serializers.ModelSerializer):
    """첨부 이미지: 파일은 /api/board/images/<id>/ 로만 제공합니다."""

    url = serializers.SerializerMethodField()

    class Meta:
        model = PostImage
        fields = ("id", "url")

    def get_url(self, obj):
        return f"/api/board/images/{obj.id}/"


class CommentSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source="author.username", read_only=True)
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ("id", "content", "author", "created_at", "updated_at", "is_mine")

    def get_is_mine(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and obj.author_id == request.user.id)


class CommentWriteSerializer(serializers.Serializer):
    """댓글 생성/수정 입력. 공백만이면 거부합니다."""

    content = serializers.CharField(trim_whitespace=True, allow_blank=False)


class PostListSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source="author.username", read_only=True)
    comment_count = serializers.IntegerField(read_only=True)
    image_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Post
        fields = (
            "id",
            "title",
            "author",
            "created_at",
            "updated_at",
            "comment_count",
            "image_count",
        )


class PostDetailSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source="author.username", read_only=True)
    is_mine = serializers.SerializerMethodField()
    images = PostImageSerializer(many=True, read_only=True)
    comments = CommentSerializer(many=True, read_only=True)

    class Meta:
        model = Post
        fields = (
            "id",
            "title",
            "content",
            "author",
            "created_at",
            "updated_at",
            "is_mine",
            "images",
            "comments",
        )

    def get_is_mine(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and obj.author_id == request.user.id)


class PostWriteSerializer(serializers.Serializer):
    """글 생성/수정 입력. title/content 공백만이면 400, image_ids 로 첨부 교체."""

    title = serializers.CharField(max_length=200, trim_whitespace=True, allow_blank=False)
    content = serializers.CharField(trim_whitespace=True, allow_blank=False)
    image_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=True
    )
