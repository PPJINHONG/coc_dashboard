#!/bin/sh
set -eu

# init SQL에서 만든 빈 DB도, 기존 DB도 같은 Django 구조 변경 기록으로 관리합니다.
python manage.py migrate --fake-initial --noinput
exec "$@"
