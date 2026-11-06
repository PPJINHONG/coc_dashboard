from django.urls import path

from . import views
from .accounts import AccountActivitiesView, AccountsView, AccountView

# config/urls.py가 /api/db-admin/ 아래에 연결합니다. 공통데이터·기능별 저장 경로는
# reporting/admin_urls.py, 기능 전용 관리 경로는 각 기능 앱의 admin_urls.py에 있습니다.
urlpatterns = [
    path('', views.CatalogView.as_view()),
    path('accounts/', AccountsView.as_view()),
    path('accounts/<int:pk>/', AccountView.as_view()),
    path('accounts/<int:pk>/activities/', AccountActivitiesView.as_view()),
    path('changes/', views.ChangesView.as_view()),
    path('tables/<str:table>/', views.TableView.as_view()),
    path('tables/<str:table>/rows/', views.RowsView.as_view()),
]
