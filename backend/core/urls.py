from django.urls import path

from . import views

# config/urls.py가 /api/ 아래에 연결합니다.
urlpatterns = [
    path("auth/csrf/", views.CsrfView.as_view(), name="auth-csrf"),
    path("auth/login/", views.LoginView.as_view(), name="auth-login"),
    path("auth/register/", views.RegisterView.as_view(), name="auth-register"),
    path("auth/logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("auth/password/", views.PasswordChangeView.as_view(), name="auth-password"),
    path("me/", views.MeView.as_view(), name="me"),
]
