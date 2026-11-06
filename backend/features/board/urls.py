from django.urls import path

from . import views

# /api/ 아래에 자동 연결됩니다.
urlpatterns = [
    path("board/posts/", views.PostListCreateView.as_view(), name="board-post-list"),
    path("board/posts/<int:pk>/", views.PostDetailView.as_view(), name="board-post-detail"),
    path("board/posts/<int:pk>/comments/", views.CommentCreateView.as_view(), name="board-comment-create"),
    path("board/comments/<int:pk>/", views.CommentDetailView.as_view(), name="board-comment-detail"),
    path("board/images/", views.ImageUploadView.as_view(), name="board-image-upload"),
    path("board/images/<int:pk>/", views.ImageServeView.as_view(), name="board-image-serve"),
]
