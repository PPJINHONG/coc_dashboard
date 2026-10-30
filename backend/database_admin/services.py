import json
from contextlib import contextmanager

from django.db import DatabaseError, connection, transaction
from psycopg import sql
from rest_framework.exceptions import ValidationError

from .catalog import redacted_expression, relation
from .models import DatabaseChangeLog

@contextmanager
def database_operation():
    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("SELECT set_config('lock_timeout', '3s', true), set_config('statement_timeout', '15s', true)")
            yield
            with connection.cursor() as cursor:
                cursor.execute('SET CONSTRAINTS ALL IMMEDIATE')
    except DatabaseError as exc:
        code = getattr(exc.__cause__, 'sqlstate', '')
        messages = {
            '23503': '다른 데이터가 참조 중이거나 참조 대상이 없습니다. 관련 데이터를 먼저 확인하세요.',
            '23505': '같은 기본키 또는 고유 값이 이미 존재합니다.',
            '23514': 'DB 제약조건에 맞지 않습니다. 수량·상태·날짜를 확인하세요.',
            '23502': '필수 열이 비어 있습니다. 값을 입력하거나 열의 기본값을 확인하세요.',
            '55P03': '다른 작업이 테이블을 사용 중입니다. 잠시 후 다시 시도하세요.',
            '57014': '조회·변경 시간이 초과되었습니다. 범위를 줄여 다시 시도하세요.',
        }
        raise ValidationError(messages.get(code, '자료형·값·제약조건이 맞지 않아 반영하지 않았습니다.')) from exc


def log_change(request, action, table, details, sql_text=''):
    return DatabaseChangeLog.objects.create(action=action, table_name=table, actor_username=request.user.username, details=details, sql_text=sql_text)


def get_rows(meta, query):
    try:
        limit = min(max(int(query.get('limit', 50)), 1), 200)
        offset = max(int(query.get('offset', 0)), 0)
    except (TypeError, ValueError) as exc:
        raise ValidationError('페이지 값이 올바르지 않습니다.') from exc
    search = str(query.get('search', '')).strip()
    if len(search) > 200:
        raise ValidationError('검색어는 200자 이하로 입력하세요.')
    columns = [column['name'] for column in meta['columns'] if not column['sensitive']]
    safe_keys = [key for key in meta['primary_key'] if key in columns]
    sort = query.get('sort') or next(iter(safe_keys or columns), None)
    if sort is not None and sort not in columns:
        raise ValidationError('정렬할 수 없는 열입니다.')
    direction = sql.SQL('DESC' if query.get('direction') == 'desc' else 'ASC')
    ordering = sql.SQL(', ').join(sql.SQL('{} {} NULLS LAST').format(sql.Identifier(key), direction) for key in dict.fromkeys([sort, *safe_keys]) if key is not None) if sort else sql.SQL('1')
    searchable = [column['name'] for column in meta['columns'] if not column['sensitive']]
    where, params = sql.SQL('TRUE'), []
    if search:
        where = sql.SQL(' OR ').join(sql.SQL('{}::text ILIKE %s').format(sql.Identifier(key)) for key in searchable) if searchable else sql.SQL('FALSE')
        params = [f'%{search}%' for key in searchable]
    version = sql.SQL("t.xmin::text || ':' || t.ctid::text") if meta['kind'] == 'table' else sql.SQL("''")
    with database_operation(), connection.cursor() as cursor:
        cursor.execute(sql.SQL('SELECT count(*) FROM {} WHERE {}').format(relation(meta['name']), where), params)
        count = cursor.fetchone()[0]
        cursor.execute(sql.SQL('SELECT {}, {} FROM {} AS t WHERE {} ORDER BY {} LIMIT %s OFFSET %s').format(redacted_expression(meta), version, relation(meta['name']), where, ordering), [*params, limit, offset])
        rows = []
        for data, xmin in cursor.fetchall():
            data = json.loads(data) if isinstance(data, str) else data
            rows.append({'values': data, 'token': None})
    return {'rows': rows, 'total': count, 'limit': limit, 'offset': offset}

