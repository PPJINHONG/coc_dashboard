from django.urls import path

from . import views
from .calendar_views import StaffOptionsView, CalendarView, CalendarEventView, ResponsibilityView, StaffTrendView
from .choice_views import StaffChoicesView

# /api/ 아래에 자동 연결됩니다. 관리자·팀장·그룹장이 운영 인력 탭에서 편집합니다.
urlpatterns = [
    path('operations/staff/', views.StaffEditView.as_view()),
    path('operations/staff/options/', StaffOptionsView.as_view()),
    path('operations/staff/choices/', StaffChoicesView.as_view()),
    path('operations/staff/choices/<int:pk>/', StaffChoicesView.as_view()),
    path('operations/staff/calendar/', CalendarView.as_view()),
    path('operations/staff/calendar/<int:pk>/', CalendarEventView.as_view()),
    path('operations/staff/responsibilities/', ResponsibilityView.as_view()),
    path('operations/staff/trend/', StaffTrendView.as_view()),
]
