from django.urls import path

from . import views


urlpatterns = [
    path("operations/regional_requests/", views.RegionalRequestListCreateView.as_view()),
    path("operations/regional_requests/images/", views.ImageUploadView.as_view()),
    path("operations/regional_requests/images/<int:pk>/", views.ImageServeView.as_view()),
    path("operations/regional_requests/<int:pk>/", views.RegionalRequestDetailView.as_view()),
]
