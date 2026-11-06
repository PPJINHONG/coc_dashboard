import os
from pathlib import Path

from features import discover as discover_features

BASE_DIR = Path(__file__).resolve().parent.parent

# 실제 설정은 .env에서 Compose를 통해 전달합니다.
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
DEBUG = False
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,backend").split(",")
    if host.strip()
]

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    # 공통 앱: 로그인·권한(core), 운영 공통데이터(reporting), DB 관리(database_admin), 초대(invites)
    "core",
    "reporting",
    "database_admin",
    "invites",
    # 기능 앱: backend/features/<이름>/apps.py가 있으면 자동으로 등록합니다.
    *discover_features(),
    "rest_framework",
    "drf_spectacular",
]

# 세션 인증 기반 API 설정입니다.
REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
}
SPECTACULAR_SETTINGS = {
    "TITLE": "COC Dashboard API",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
}
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
]
# Nginx(localhost:8080) 뒤에서 CSRF Origin 검사를 통과시키기 위한 신뢰 출처입니다.
# 접속 포트가 다를 때만 DJANGO_CSRF_TRUSTED_ORIGINS(쉼표 구분)로 바꿉니다.
CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "DJANGO_CSRF_TRUSTED_ORIGINS", "http://localhost:8080,http://127.0.0.1:8080"
    ).split(",")
    if origin.strip()
]
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

# Swagger 화면(/api/docs/) 템플릿을 읽습니다.
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "APP_DIRS": True,
    }
]

# PostgreSQL 기본 연결 설정입니다.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ["POSTGRES_DB"],
        "USER": os.environ["POSTGRES_USER"],
        "PASSWORD": os.environ["POSTGRES_PASSWORD"],
        "HOST": "db",
        "PORT": "5432",
    }
}
LANGUAGE_CODE = "ko-kr"
TIME_ZONE = "Asia/Seoul"
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# true면 로그인 없이 운영 현황을 조회합니다(개발용). 데이터 저장은 항상 실제 관리자만 가능합니다.
DEVELOPMENT_AUTH_BYPASS = os.environ.get("DEVELOPMENT_AUTH_BYPASS", "false").lower() == "true"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# 게시판(features/board) 첨부 이미지 저장 위치입니다. 파일은 /api/board/images/<id>/ 로만 제공합니다.
MEDIA_ROOT = BASE_DIR / "media"
