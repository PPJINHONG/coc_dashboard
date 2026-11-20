from django.urls import path

from . import views


urlpatterns = [
    path("operations/regional_notices/", views.RegionalNoticeListCreateView.as_view()),
    path("operations/regional_notices/<int:pk>/", views.RegionalNoticeDetailView.as_view()),
]
