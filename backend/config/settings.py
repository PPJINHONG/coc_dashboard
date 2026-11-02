import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# 실제 설정은 .env에서 Compose를 통해 전달합니다.
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
DEBUG = False
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,backend").split(",")
    if host.strip()
]

# 기본 페이지를 제공하는 core 앱을 등록합니다.
# 슬라이스1(세션 로그인·회원정보)에 필요한 Django 기본 인증/세션 앱을 추가합니다.
INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "core",
    "reporting",
    "database_admin",
    "invites",
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

# core/templates/ 안의 HTML 파일을 읽습니다.
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

# 개발 중에만 로그인 없이 운영 현황을 조회합니다. 데이터 저장은 관리자만 가능합니다. false로 바꾸면 기존 로그인을 복구합니다.
DEVELOPMENT_AUTH_BYPASS = os.environ.get("DEVELOPMENT_AUTH_BYPASS", "false").lower() == "true"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# 게시판 첨부 이미지 저장 위치입니다. 파일은 /api/board/images/<id>/ 로만 제공합니다.
MEDIA_ROOT = BASE_DIR / "media"
