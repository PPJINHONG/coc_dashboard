# 기본 애플리케이션 구조

## frontend: React + TypeScript

```text
frontend/
├─ src/
│  ├─ App.tsx        기본 화면
│  ├─ main.tsx       React 시작점
│  └─ styles.css     화면 스타일
├─ index.html        React를 넣을 HTML
├─ tsconfig.json     TypeScript 기본 설정
├─ vite.config.ts    React 빌드 설정
├─ package.json      패키지 버전과 명령
├─ package-lock.json 설치 잠금 파일
├─ nginx.conf        빌드 결과 제공
└─ Dockerfile        Node 빌드 → Nginx 실행
```

`App.tsx`에서 기본 화면을, `styles.css`에서 스타일을 수정합니다.

`npm run build`는 TypeScript 타입 검사 후 Vite 빌드를 수행합니다. 실행 컨테이너에는 Nginx와 빌드 파일만 들어 있으므로 Node 명령은 실행 컨테이너에서 사용할 수 없습니다.

브라우저: http://localhost:8080

## backend: Django

```text
backend/
├─ config/
│  ├─ settings.py    Django/DB 기본 설정
│  ├─ urls.py        페이지, API, Swagger 주소 연결
│  └─ wsgi.py        Gunicorn 진입점
├─ core/
│  ├─ apps.py        앱 정의
│  ├─ views.py       기본 페이지와 DRF test 조회 API
│  ├─ serializers.py API 응답 구조 정의
│  └─ templates/core/home.html
├─ manage.py         Django 관리 명령
├─ requirements.txt 실행 패키지와 문서 도구
└─ Dockerfile        설치와 Gunicorn 실행
```

`/backend/`로 접속하면 view가 HTML 템플릿을 표시합니다. core/templates/core/home.html에서 기본 화면을 수정합니다.

브라우저: http://localhost:8080/backend/

Django·psycopg·Gunicorn으로 앱을 실행하고, Django REST Framework(DRF)로 API를 작성합니다. drf-spectacular가 OpenAPI와 Swagger UI를 제공합니다.

기본 설정을 확인하려면 다음을 실행합니다.

```bash
docker compose exec backend python manage.py check
```

루트 .env는 공통 환경설정 파일이며 backend/config/는 Django 설정 패키지입니다.

## db: PostgreSQL

DB 이름/사용자/비밀번호는 .env에서 지정합니다. Django 연결 대상은 내부 호스트 `db`, 포트 `5432`입니다.

`db/init/01-test.sql`에 기본 `test` 테이블과 샘플 데이터를 정의하고, `db/queries/test.sql`로 조회합니다. `GET /api/test/`에서도 같은 테이블을 조회해 JSON으로 반환합니다. 적용 방법과 응답은 [DB 가이드](database.md)를 참고하세요.

## 단일 접속 주소와 API

Nginx가 React 파일을 제공하고 `/backend/`와 `/api/` 요청을 내부 Django 서버로 전달합니다. 브라우저에서 API를 호출할 때는 `fetch('/api/test/')`처럼 상대 경로를 사용합니다.

| 메서드/경로 | 결과 |
| --- | --- |
| GET / | React 화면 |
| GET /backend/ | Django 기본 페이지 |
| GET /api/ | Swagger 문서로 이동 |
| GET /api/docs/ | Swagger UI |
| GET /api/schema/ | OpenAPI 명세 |
| GET /api/test/ | test 테이블의 id/message JSON |

조회 API는 GET으로 데이터를 반환하고 HEAD/OPTIONS 요청도 처리합니다. POST/PUT/DELETE는 HTTP 405로 거부합니다. DB 조회 실패 시 상세 오류는 서버 로그에 기록하고 HTTP 503과 오류 메시지를 반환합니다.

API 문서 작성과 사용법은 [API와 Swagger 가이드](api.md)를 참고하세요.
