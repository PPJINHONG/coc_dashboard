from django.urls import path

from . import views

# /api/ 아래에 자동 연결됩니다. 관리자·팀장·그룹장이 운영 인력 탭에서 편집합니다.
urlpatterns = [
    path('operations/staff/', views.StaffEditView.as_view()),
]
