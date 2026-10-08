from django.urls import path
from django.views.generic import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from core.views import TestListView, home

urlpatterns = [
    path("backend/", home, name="home"),
    path("api/", RedirectView.as_view(pattern_name="api-docs", permanent=False)),
    path("api/test/", TestListView.as_view(), name="test-list"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="api-docs"),
]
