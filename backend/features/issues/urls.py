from django.urls import path

from . import views

# /api/ 아래에 자동 연결됩니다. 관리자·사용자가 작성하고 옵저버는 조회만 합니다.
urlpatterns = [
    path('operations/issues/', views.IssueCreateView.as_view()),
    path('operations/issues/<int:pk>/', views.IssueDetailView.as_view()),
    path('operations/issues/<int:pk>/comments/', views.IssueCommentCreateView.as_view()),
    path('operations/issue-comments/<int:pk>/', views.IssueCommentDetailView.as_view()),
]
