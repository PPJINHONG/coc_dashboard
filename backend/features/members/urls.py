from django.urls import path

from .views import MembersView, MemberView

urlpatterns = [
    path('members/', MembersView.as_view()),
    path('members/<int:pk>/', MemberView.as_view()),
]
