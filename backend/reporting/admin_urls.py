from django.urls import path

from . import views
from .restoration import RestorePreviewView, RestoreView

# config/urls.py가 /api/db-admin/ 아래에 연결합니다. 실제 활성 관리자만 사용합니다.
urlpatterns = [
    path('logs/<int:pk>/restore-preview/', RestorePreviewView.as_view()),
    path('logs/<int:pk>/restore/', RestoreView.as_view()),
    path('sections/<str:section>/', views.SectionView.as_view()),
    path('common/<str:collection>/', views.MasterDataView.as_view()),
    path('common/<str:collection>/<str:pk>/', views.MasterDataView.as_view()),
]
