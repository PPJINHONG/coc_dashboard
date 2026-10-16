# 데이터를 요청하고 결과 확인하기

[문서 목록](../README.md) · [쉬운 용어 사전](../01-start/glossary.md)

**화면에서 사용할 데이터를 확인하거나 서버의 조회 기능을 수정할 때** 읽습니다. API는 프로그램이 서버에 데이터를 달라고 요청하는 창구입니다.

## 1. 먼저 요청해 보기

[프로젝트를 실행한 뒤](docker-compose.md) http://localhost:8080/api/docs/ 에 접속합니다. 이 화면을 Swagger UI라고 합니다. API 목록을 보고 실제 요청도 보내는 도구입니다.

1. **GET /api/test/** 항목을 펼칩니다.
2. **Try it out**을 누릅니다. 요청할 준비를 하는 버튼입니다.
3. **Execute**를 누릅니다. 실제로 서버에 요청합니다.
4. 아래에 나온 응답 번호와 결과를 확인합니다.

`GET`은 데이터를 읽어 달라는 요청입니다. 이 화면의 일부 파일은 인터넷에서 가져오므로 브라우저에 인터넷 연결이 필요합니다.

## 2. 결과 읽는 방법

정상적인 조회 결과의 예입니다.

```json
{
  "results": [
    { "id": 1, "message": "Hello PostgreSQL" }
  ]
}
```

- `results`: 조회된 데이터 목록입니다.
- `id`: 해당 데이터의 번호입니다. 실제 번호는 달라질 수 있습니다.
- `message`: 저장된 문구입니다.
- `results`가 빈 목록 `[]`이면 데이터가 없는 것입니다.

이처럼 항목 이름과 값을 짝지어 적는 형식을 JSON이라고 합니다.

| 응답 번호 | 쉬운 뜻 | 할 일 |
| --- | --- | --- |
| `200` | 요청을 정상 처리함 | 반환된 데이터 확인 |
| `405` | 이 주소에서 허용하지 않는 요청 방식 | 조회는 GET으로 요청 |
| `503` | 서버가 지금 DB 데이터를 읽을 수 없음 | [DB 안내](database.md)와 실행 기록 확인 |

현재 `/api/test/`는 읽기 기능입니다. POST·PUT·DELETE처럼 추가·수정·삭제에 쓰는 요청은 거절합니다. HEAD·OPTIONS라는 확인용 요청도 지원합니다. 로그인 없이 조회하도록 구현되어 있으며, 이후 인증·권한과 쓰기 기능의 범위는 별도로 합의해야 합니다.

## 3. 자주 쓰는 주소

앞에 `http://localhost:8080`을 붙여 접속합니다.

| 경로 | 용도 |
| --- | --- |
| `/` | 기본 화면 |
| `/backend/` | Django 기본 페이지 |
| `/api/` | API 안내 화면으로 이동 |
| `/api/docs/` | 사람이 읽고 실행해 보는 API 안내 화면 |
| `/api/schema/` | 다른 프로그램이 읽는 API 설명 데이터 |
| `/api/test/` | 현재 예제 데이터 조회 |

## 4. 화면 코드에서 요청하기

화면 코드에서는 `fetch('/api/test/')`로 지금 접속한 사이트에 데이터를 요청할 수 있습니다. Nginx가 이 요청을 내부 서버로 전달합니다. 브라우저 코드에 DB 비밀번호나 Docker 내부 주소를 넣지 않습니다.

터미널에서 결과만 확인하려면 다음을 실행합니다.

```bash
curl http://localhost:8080/api/test/
```

## 5. API를 수정할 때 보는 파일

| 파일 | 역할 |
| --- | --- |
| `backend/core/views.py` | 요청을 받고 DB를 조회한 뒤 응답하는 처리 |
| `backend/core/serializers.py` | 응답에 어떤 항목을 넣을지 정하는 코드 |
| `backend/config/urls.py` | 주소와 처리 코드를 연결 |
| `backend/config/settings.py` | API 도구와 서버의 설정 |

현재 `views.py`의 `TestListView`가 조회를 처리합니다. 응답 형식을 정하는 코드는 Serializer라고 부릅니다. `get` 위의 `extend_schema`는 API 안내 화면에 보여줄 설명과 응답 형식을 지정합니다. 이 정보를 설명 데이터로 만드는 도구는 `drf-spectacular`입니다.

주소, 요청 항목, 응답 항목을 바꿀 때는 상대방에게 먼저 알려 화면과 서버를 함께 맞춥니다. [도구 공식 문서](https://drf-spectacular.readthedocs.io/en/stable/readme.html)

## 6. 설명 데이터에 오류가 없는지 검사

API 코드를 수정한 뒤, 서버 컨테이너가 실행 중인 상태에서 프로젝트 최상위에서 실행합니다.

```bash
docker compose exec backend python manage.py spectacular --validate --fail-on-warn
```

API 설명 데이터를 만들면서 형식을 검사하고 경고가 있으면 실패로 처리합니다. 성공해도 실제 조회 기능까지 검사한 것은 아니므로 1단계처럼 직접 요청해 봅니다.

DB 조회 실패 시 응답에는 `error` 항목이 나오고 자세한 오류는 서버 실행 기록에 남습니다. 현재 로그인 관련 세부 설정은 `UNAUTHENTICATED_USER = None`을 사용합니다. [DRF 설정 설명](https://www.django-rest-framework.org/api-guide/settings/)
