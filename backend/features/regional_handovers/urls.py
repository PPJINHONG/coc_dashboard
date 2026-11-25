from django.urls import path

from . import views


urlpatterns = [
    path("operations/regional_handovers/", views.RegionalHandoverListCreateView.as_view()),
    path("operations/regional_handovers/images/", views.ImageUploadView.as_view()),
    path("operations/regional_handovers/images/<int:pk>/", views.ImageServeView.as_view()),
    path("operations/regional_handovers/<int:pk>/", views.RegionalHandoverDetailView.as_view()),
]
