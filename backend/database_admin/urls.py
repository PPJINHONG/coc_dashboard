from django.urls import path

from . import views
from reporting.views import SectionView, MasterDataView, CommentsView
from .feature_views import AccountsView, AccountView, AdminCommentsView

urlpatterns = [
    path('sections/<str:section>/', SectionView.as_view()),
    path('common/<str:collection>/', MasterDataView.as_view()),
    path('common/<str:collection>/<str:pk>/', MasterDataView.as_view()),
    path('issues/<int:pk>/comments/', CommentsView.as_view()),
    path('', views.CatalogView.as_view()),
    path('accounts/', AccountsView.as_view()),
    path('accounts/<int:pk>/', AccountView.as_view()),
    path('comments/', AdminCommentsView.as_view()),
    path('comments/<int:pk>/', AdminCommentsView.as_view()),
    path('changes/', views.ChangesView.as_view()),
    path('tables/<str:table>/', views.TableView.as_view()),
    path('tables/<str:table>/rows/', views.RowsView.as_view()),
]
