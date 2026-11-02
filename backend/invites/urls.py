from django.urls import path

from . import views

# config/urls.py 에서 path("api/", include("invites.urls")) 로 연결합니다.
urlpatterns = [
    path("auth/invites/<str:token>/", views.InviteCheckView.as_view(), name="invite-check"),
    path("invites/", views.InviteListCreateView.as_view(), name="invite-list"),
    path("invites/options/", views.InviteOptionsView.as_view(), name="invite-options"),
    path("invites/<int:pk>/revoke/", views.InviteRevokeView.as_view(), name="invite-revoke"),
]
