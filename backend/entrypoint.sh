#!/bin/sh
set -eu

# init SQL에서 만든 빈 DB도, 기존 DB도 같은 Django 구조 변경 기록으로 관리합니다.
python manage.py migrate --fake-initial --noinput
# 기본 관리자 admin/admin이 없을 때만 만듭니다. 기존 계정·비밀번호는 바꾸지 않습니다.
python manage.py ensure_admin
exec "$@"
