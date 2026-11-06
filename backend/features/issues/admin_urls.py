from django.urls import path

from . import admin_views

# /api/db-admin/ 아래에 자동 연결됩니다. 실제 활성 관리자만 사용합니다.
urlpatterns = [
    path('issues/<int:pk>/comments/', admin_views.CommentsView.as_view()),
    path('comments/', admin_views.AdminCommentsView.as_view()),
    path('comments/<int:pk>/', admin_views.AdminCommentsView.as_view()),
]
