import re

from django.db import connection
from psycopg import sql
from rest_framework.exceptions import NotFound

TABLE_LABELS = {
    'auth_user': '사용자·아이디·권한',
    'ops_regions': '공통 리전', 'ops_services': '인프라 서비스',
    'ops_staff_members': '인력 기준정보', 'infra_resources': '인프라 자원·호스트 수량',
    'ops_staff_assignments': '운영 인력 배치', 'ops_work_summaries': '운영 작업',
    'ops_regional_issues': '리전 이슈·조치', 'ops_issue_comments': '이슈 댓글',
    'user_activity_logs': '사용자 행동 이력',
}
SENSITIVE = re.compile(r'password|passwd|secret|token|session|api_key|credential', re.I)


def table_list():
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT c.relname, c.relkind, obj_description(c.oid, 'pg_class'),
                   (SELECT count(*) FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped)
            FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY(%s)
            ORDER BY c.relname
        """, [list(TABLE_LABELS)])
        return [dict(label=TABLE_LABELS[name], name=name, kind='table' if kind in ('r', 'p') else 'view', comment=comment or '', column_count=count,
                     protected=True) for name, kind, comment, count in cursor.fetchall()]


def table_meta(name):
    table = next((item for item in table_list() if item['name'] == name), None)
    if table is None:
        raise NotFound('테이블을 찾을 수 없습니다.')
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT a.attname, format_type(a.atttypid, a.atttypmod), NOT a.attnotnull,
                   pg_get_expr(d.adbin, d.adrelid), col_description(a.attrelid, a.attnum),
                   a.attidentity, a.attgenerated, t.typname,
                   COALESCE(bt.typname, t.typname), t.typtype,
                   CASE WHEN t.typtype = 'd' THEN tn.nspname || '.' || t.typname END
            FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            JOIN pg_type t ON t.oid = a.atttypid JOIN pg_namespace tn ON tn.oid = t.typnamespace
            LEFT JOIN pg_type bt ON bt.oid = t.typbasetype
            LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
            WHERE n.nspname = 'public' AND c.relname = %s AND a.attnum > 0 AND NOT a.attisdropped
            ORDER BY a.attnum
        """, [name])
        columns = []
        for column, data_type, nullable, default, comment, identity, generated, native_type, base_type, kind, domain in cursor.fetchall():
            sensitive = bool(SENSITIVE.search(column))
            columns.append(dict(name=column, data_type=data_type, nullable=nullable, default=None if sensitive else default,
                                comment=comment or '', identity=bool(identity), generated=bool(generated), base_type=base_type,
                                domain=domain, sensitive=sensitive,
                                editable=False))
        cursor.execute("""
            SELECT con.conname, con.contype, pg_get_constraintdef(con.oid)
            FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = %s ORDER BY con.conname
        """, [name])
        constraints = [dict(name=row[0], type=row[1], definition=row[2]) for row in cursor.fetchall()]
        cursor.execute("""
            SELECT a.attname FROM pg_index i
            JOIN pg_class c ON c.oid = i.indrelid JOIN pg_namespace n ON n.oid = c.relnamespace
            CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, position)
            JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
            WHERE n.nspname = 'public' AND c.relname = %s AND i.indisprimary ORDER BY k.position
        """, [name])
        primary_key = [row[0] for row in cursor.fetchall()]
    writable = False
    return {**table, 'columns': columns, 'constraints': constraints, 'primary_key': primary_key,
            'can_edit_rows': writable and bool(primary_key) and not any(SENSITIVE.search(key) for key in primary_key),
            'can_insert_rows': writable and bool(primary_key) and not any(SENSITIVE.search(key) for key in primary_key)}


def relation(name):
    return sql.Identifier('public', name)


def redacted_expression(meta, alias='t'):
    hidden = [column['name'] for column in meta['columns'] if column['sensitive']]
    result = sql.SQL('to_jsonb({}) - {}::text[]').format(sql.Identifier(alias), sql.Literal(hidden))
    # JS 숫자 정밀도 제한으로 bigint·numeric 원본 값이 바뀌지 않도록 문자열로 전달합니다.
    for column in meta['columns']:
        if column['base_type'] in ('int8', 'numeric') and not column['sensitive']:
            result += sql.SQL(' || jsonb_build_object({}, {}::text)').format(sql.Literal(column['name']), sql.Identifier(alias, column['name']))
    return sql.SQL('({})').format(result)

