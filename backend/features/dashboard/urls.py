from django.urls import path

from . import views

# /api/ 아래에 자동 연결됩니다.
urlpatterns = [
    path("dashboard/panels/", views.DashboardPanelListCreateView.as_view(), name="dashboard-panel-list"),
    path("dashboard/panels/reorder/", views.DashboardPanelReorderView.as_view(), name="dashboard-panel-reorder"),
    path("dashboard/panels/<int:pk>/", views.DashboardPanelDetailView.as_view(), name="dashboard-panel-detail"),
]
