from django.urls import path

from .views import ResourceDetailView, ResourceListCreateView, ResourceTrendView

urlpatterns = [
    path("operations/resources/", ResourceListCreateView.as_view()),
    path("operations/resources/<int:pk>/", ResourceDetailView.as_view()),
    path("operations/resources/trend/", ResourceTrendView.as_view()),
]
