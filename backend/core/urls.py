from django.urls import path

from . import views

# config/urls.py 에서 path("api/", include("core.urls")) 로 연결되므로
# 여기서는 "api/" 접두어 없이 경로만 정의합니다.
urlpatterns = [
    path("auth/csrf/", views.CsrfView.as_view(), name="auth-csrf"),
    path("auth/login/", views.LoginView.as_view(), name="auth-login"),
    path("auth/logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("me/", views.MeView.as_view(), name="me"),
    # 게시판 슬라이스
    path("board/posts/", views.PostListCreateView.as_view(), name="board-post-list"),
    path("board/posts/<int:pk>/", views.PostDetailView.as_view(), name="board-post-detail"),
    path(
        "board/posts/<int:pk>/comments/",
        views.CommentCreateView.as_view(),
        name="board-comment-create",
    ),
    path(
        "board/comments/<int:pk>/",
        views.CommentDetailView.as_view(),
        name="board-comment-detail",
    ),
    path("board/images/", views.ImageUploadView.as_view(), name="board-image-upload"),
    path("board/images/<int:pk>/", views.ImageServeView.as_view(), name="board-image-serve"),
    # 대시보드 슬라이스
    path("dashboard/panels/", views.DashboardPanelListCreateView.as_view(), name="dashboard-panel-list"),
    path(
        "dashboard/panels/reorder/",
        views.DashboardPanelReorderView.as_view(),
        name="dashboard-panel-reorder",
    ),
    path(
        "dashboard/panels/<int:pk>/",
        views.DashboardPanelDetailView.as_view(),
        name="dashboard-panel-detail",
    ),
]
