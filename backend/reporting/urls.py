from django.urls import path

from . import views
from .navigation import NavigationPreferenceView

# config/urls.py가 /api/ 아래에 연결합니다. 기능별 API는 각 기능 앱의 urls.py에 있습니다.
urlpatterns = [
    path('navigation/preferences/', NavigationPreferenceView.as_view()),
    path('app-config/', views.AppConfigView.as_view()),
    path('operations/bootstrap/', views.BootstrapView.as_view()),
    path('operations/current/', views.SnapshotView.as_view()),
    path('operations/logs/', views.LogsView.as_view()),
]
