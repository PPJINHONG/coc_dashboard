from django.urls import path
from . import views
from .navigation import NavigationPreferenceView
from .user_views import IssueCommentCreateView, IssueCommentDetailView, IssueCreateView, IssueDetailView

urlpatterns = [
    path('navigation/preferences/', NavigationPreferenceView.as_view()),
    path('app-config/', views.AppConfigView.as_view()),
    path('operations/bootstrap/', views.BootstrapView.as_view()),
    path('operations/current/', views.SnapshotView.as_view()),
    path('operations/logs/', views.LogsView.as_view()),
    # 리전 이슈 사용자 작성: 관리자 전체, 사용자 본인 것만, 옵저버 조회 전용
    path('operations/issues/', IssueCreateView.as_view()),
    path('operations/issues/<int:pk>/', IssueDetailView.as_view()),
    path('operations/issues/<int:pk>/comments/', IssueCommentCreateView.as_view()),
    path('operations/issue-comments/<int:pk>/', IssueCommentDetailView.as_view()),
]
