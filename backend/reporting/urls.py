from django.urls import path
from . import views
from .navigation import NavigationPreferenceView

urlpatterns = [
    path('navigation/preferences/', NavigationPreferenceView.as_view()),
    path('app-config/', views.AppConfigView.as_view()),
    path('operations/bootstrap/', views.BootstrapView.as_view()),
    path('operations/current/', views.SnapshotView.as_view()),
    path('operations/logs/', views.LogsView.as_view()),
]
