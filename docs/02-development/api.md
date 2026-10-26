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

DB 조회 실패 시 응답에는 `error` 항목이 나오고 자세한 오류는 서버 실행 기록에 남습니다. 로그인은 Django 세션 방식(`SessionAuthentication`)을 사용합니다. [DRF 설정 설명](https://www.django-rest-framework.org/api-guide/settings/)

## 7. 로그인·회원 정보·게시판·대시보드 API (프로토타입)

모두 `/api/` 아래에 있고 `backend/core/urls.py`에서 연결합니다. `/api/auth/csrf/`·`/api/auth/login/`·`/api/auth/logout/`을 제외한 주소는 로그인해야 쓸 수 있으며, 로그인하지 않으면 `403`을 돌려줍니다.

| 경로 | 요청 방식 | 용도 |
| --- | --- | --- |
| `/api/auth/csrf/` | GET | 쓰기 요청에 필요한 `csrftoken` 쿠키 발급 (`204`) |
| `/api/auth/login/` | POST | `{username, password}`로 로그인. 실패 시 `401` |
| `/api/auth/logout/` | POST | 로그아웃 (`204`) |
| `/api/me/` | GET, PATCH | 내 정보 조회·수정. 이름·이메일만 수정 가능 |
| `/api/board/posts/` | GET, POST | 글 목록(최신순)·작성. 제목·내용이 비면 `400` |
| `/api/board/posts/{id}/` | GET, PATCH, DELETE | 글 상세·수정·삭제. 수정·삭제는 작성자만 (`403`) |
| `/api/board/posts/{id}/comments/` | POST | 댓글 작성 |
| `/api/board/comments/{id}/` | PATCH, DELETE | 댓글 수정·삭제. 작성자만 |
| `/api/board/images/` | POST | 이미지 업로드(파일 항목 이름 `file`). png·jpeg·gif·webp, 5MB 이하 |
| `/api/board/images/{id}/` | GET | 업로드한 이미지 보기 |
| `/api/dashboard/panels/` | GET, POST | 내 대시보드 패널 목록(표시 순서)·추가 |
| `/api/dashboard/panels/{id}/` | GET, PATCH, DELETE | 패널 조회·수정·삭제. PATCH는 바꿀 항목만 보내도 됨. 남의 패널은 `404` |
| `/api/dashboard/panels/reorder/` | POST | `{ids: [...]}`로 내 패널 순서 변경. 내 패널 id를 빠짐없이 한 번씩 보내야 함 |

- 글을 쓸 때 `image_ids`에 미리 올린 이미지 번호를 넣으면 첨부됩니다. 글 하나에 5장까지이고, 내가 올린 이미지만 붙일 수 있습니다.
- POST·PATCH·DELETE 요청은 `csrftoken` 쿠키 값을 `X-CSRFToken` 헤더에 넣어야 합니다. 화면 코드(`frontend/src/api/client.ts`)가 자동으로 처리합니다.
- Nginx 기본 설정은 요청 크기를 1MB로 제한합니다. 그래서 화면이 이미지를 900KB 이하로 줄인 뒤 올립니다.
- 업로드한 이미지는 서버 컨테이너 안(`backend/media/`)에 저장됩니다. 컨테이너를 다시 만들면 지워질 수 있습니다. 계속 보관하는 방법은 아직 정하지 않았습니다.
- 브라우저 접속 주소가 `http://localhost:8080`이 아니면 로그인이 `403`으로 막힐 수 있습니다. 이때는 [설정 안내](configuration.md)의 `DJANGO_CSRF_TRUSTED_ORIGINS`를 확인합니다.

### 대시보드 패널 항목

패널은 로그인한 사용자별로 저장됩니다. 화면이 원본 데이터를 만들고 변환 수식을 계산해 그래프로 그리며, 서버는 저장 전에 값과 수식 문법만 검사합니다.

| 항목 | 설명 |
| --- | --- |
| `title`, `description` | 제목(100자), 설명(300자, 선택) |
| `viz_type` | `timeseries`(시계열), `bar`(막대), `stat`(숫자), `gauge`(게이지), `table`(표) |
| `source` | `manual`이면 `values`, `function`이면 `func_expr`로 원본 데이터를 만듭니다 |
| `values` | `[{label, value}]` 최대 200개. 라벨은 30자 이하, 값은 숫자 |
| `func_expr`, `func_from`, `func_to`, `func_step` | 변수 `t`를 시작부터 끝까지 간격만큼 넣어 계산하는 함수식. 점은 최대 500개 |
| `formula` | 변환 수식(선택). 변수 `x`(원본 값), `i`(순번), `n`(개수), `t`(라벨 숫자), `prev`(이전 값), `sum`·`avg`·`min`·`max`(원본 통계) |
| `options` | `unit`, `unit_suffix`, `decimals`, `min`, `max`, `reduce`(숫자·게이지 대표값), `color`, `thresholds`. PATCH로 보내면 옵션 전체를 바꿉니다 |
| `width`, `height` | 24칸 격자 기준 너비 3~24칸, 높이 3~20칸 |

- 수식에는 `+ - * / % ^`, 괄호, `abs round floor ceil sqrt log log10 exp sin cos tan pow min max clamp` 함수, 상수 `pi`·`e`를 쓸 수 있습니다. 문법이 틀리면 `400`과 함께 어느 부분이 틀렸는지 한국어로 알려 줍니다.
- 수식 문법은 `backend/core/dashboard_expr.py`(검사)와 `frontend/src/dashboard/expr.ts`(계산) 두 곳에 있습니다. 바꿀 때는 두 파일을 함께 고칩니다.
