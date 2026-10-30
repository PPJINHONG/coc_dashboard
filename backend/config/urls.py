from django.urls import include, path
from django.views.generic import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


urlpatterns = [
    path("backend/", RedirectView.as_view(pattern_name="api-docs", permanent=False)),
    path("api/", RedirectView.as_view(pattern_name="api-docs", permanent=False)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="api-docs"),
    # 슬라이스1: 세션 로그인·회원정보 API (core/urls.py)
    path("api/", include("core.urls")),
    path("api/", include("reporting.urls")),
    path("api/db-admin/", include("database_admin.urls")),
]
