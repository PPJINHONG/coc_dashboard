# API와 Swagger 문서

## 접속 경로

모든 경로는 http://localhost:8080 에서 접근합니다.

| 경로 | 역할 |
| --- | --- |
| / | React 화면 |
| /backend/ | Django 기본 HTML 페이지 |
| /api/ | /api/docs/로 이동 |
| /api/docs/ | Swagger UI: API 목록과 요청/응답 확인 |
| /api/schema/ | OpenAPI 명세 |
| /api/test/ | test 테이블 조회 API |

Nginx가 /backend/와 /api/ 요청을 Django로 전달합니다. /api는 API 및 문서 경로로 사용합니다.

## Swagger UI 사용

1. http://localhost:8080/api/docs/ 에 접속합니다.
2. GET /api/test/ 항목을 펼칩니다.
3. Try it out → Execute를 누릅니다.
4. 응답 코드와 JSON을 확인합니다.

Swagger UI의 JS/CSS는 CDN에서 읽으므로 브라우저의 인터넷 연결이 필요합니다.

## 조회 API 응답

```json
{
  "results": [
    { "id": 1, "message": "Hello PostgreSQL" }
  ]
}
```

GET은 데이터를 반환하며 HEAD/OPTIONS도 지원합니다. POST/PUT/DELETE는 HTTP 405로 거부합니다. DB 조회 실패 시 HTTP 503과 error 메시지를 반환하고 상세 오류는 backend 로그에 기록합니다.

## 코드 구조

| 파일 | 역할 |
| --- | --- |
| backend/core/views.py | DRF APIView와 실제 SQL 조회 |
| backend/core/serializers.py | id/message, results, error 응답 구조 |
| backend/config/urls.py | 페이지, API, schema, docs 주소 |
| backend/config/settings.py | DRF와 drf-spectacular 설정 |

APIView의 get 메서드 위에 extend_schema로 요약과 응답 Serializer를 지정합니다. drf-spectacular는 이를 OpenAPI 명세로 생성하고 Swagger UI에 표시합니다. [공식 문서](https://drf-spectacular.readthedocs.io/en/stable/readme.html)

현재 조회 API는 로그인 없이 접근하는 설정입니다. Django 인증 앱을 사용하지 않는 구성에 맞춰 DRF의 UNAUTHENTICATED_USER를 None으로 지정했습니다. [DRF 설정 설명](https://www.django-rest-framework.org/api-guide/settings/)

## 스키마 검증

```bash
docker compose exec backend python manage.py spectacular --validate --fail-on-warn
```

프론트에서 조회할 때는 fetch('/api/test/')처럼 같은 출처의 상대 경로를 사용합니다.
