from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from .catalog import table_list, table_meta
from .models import DatabaseChangeLog
from .services import get_rows


class DatabaseAdministrator(BasePermission):
    message = 'DB 관리 기능은 로그인한 관리자만 사용할 수 있습니다.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user.is_authenticated and user.is_active and user.is_staff)


def payload(request):
    if not isinstance(request.data, dict):
        raise ValidationError('객체 형식으로 요청하세요.')
    return request.data


@method_decorator(csrf_protect, name='dispatch')
class AdminView(APIView):
    permission_classes = [DatabaseAdministrator]

    def handle_exception(self, exc):
        response = super().handle_exception(exc)
        if response.status_code == 400 and isinstance(response.data, list):
            response.data = {'detail': ' '.join(str(message) for message in response.data)}
        return response


class CatalogView(AdminView):
    def get(self, request):
        return Response({'tables': table_list()})


class TableView(AdminView):
    def get(self, request, table):
        return Response(table_meta(table))


class RowsView(AdminView):
    def get(self, request, table):
        return Response(get_rows(table_meta(table), request.query_params))


class ChangesView(AdminView):
    def get(self, request):
        logs = DatabaseChangeLog.objects.all()
        if request.query_params.get('table'):
            logs = logs.filter(table_name=request.query_params['table'])
        return Response(list(logs.values('id', 'action', 'table_name', 'actor_username', 'details', 'sql_text', 'created_at')[:100]))
