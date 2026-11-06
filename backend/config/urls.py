from importlib.util import find_spec

from django.urls import include, path
from django.views.generic import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from features import discover as discover_features


def feature_routes(module, prefix):
    """기능 앱의 urls.py는 /api/, admin_urls.py는 /api/db-admin/ 아래에 자동으로 연결합니다."""
    return [path(prefix, include(f"{app}.{module}")) for app in discover_features() if find_spec(f"{app}.{module}")]


urlpatterns = [
    path("backend/", RedirectView.as_view(pattern_name="api-docs", permanent=False)),
    path("api/", RedirectView.as_view(pattern_name="api-docs", permanent=False)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="api-docs"),
    # 공통 앱
    path("api/", include("core.urls")),
    path("api/", include("invites.urls")),
    path("api/", include("reporting.urls")),
    path("api/db-admin/", include("reporting.admin_urls")),
    path("api/db-admin/", include("database_admin.urls")),
    # 기능 앱(backend/features/*)
    *feature_routes("urls", "api/"),
    *feature_routes("admin_urls", "api/db-admin/"),
]
