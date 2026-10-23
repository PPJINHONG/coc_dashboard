from django.urls import path

from . import views

# config/urls.py 에서 path("api/", include("core.urls")) 로 연결되므로
# 여기서는 "api/" 접두어 없이 경로만 정의합니다.
urlpatterns = [
    path("auth/csrf/", views.CsrfView.as_view(), name="auth-csrf"),
    path("auth/login/", views.LoginView.as_view(), name="auth-login"),
    path("auth/logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("me/", views.MeView.as_view(), name="me"),
]
