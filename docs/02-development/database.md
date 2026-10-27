# 데이터가 들어 있고 조회되는지 확인하기

[문서 목록](../README.md) · [쉬운 용어 사전](../01-start/glossary.md)

**DB에 예제 데이터가 있는지 확인하거나 조회 오류를 해결할 때** 읽습니다. 먼저 [실행 안내](docker-compose.md)에 따라 프로젝트를 켜야 합니다.

## 1. 현재 어떤 데이터가 있나요?

DB는 데이터를 보관하는 곳이고, 테이블은 그 안에 있는 표입니다. 현재 `test`라는 표를 사용합니다.

| 항목 | 의미 | 예 |
| --- | --- | --- |
| `id` | 자동으로 붙는 번호 | `1` |
| `message` | 저장된 문구. 같은 문구는 중복 저장하지 않음 | `Hello PostgreSQL` |

번호의 코드상 자료형은 `INTEGER`이고 문구는 `TEXT`입니다. 현재 예제에는 `Hello PostgreSQL`이라는 문구 한 건을 넣습니다. 번호는 이미 사용한 이력에 따라 달라질 수 있습니다.

## 2. 가장 쉬운 확인: 브라우저 열기

http://localhost:8080/api/test/ 에 접속합니다.

예제 데이터가 있다면 다음과 비슷한 결과가 나옵니다.

```json
{
  "results": [
    { "id": 1, "message": "Hello PostgreSQL" }
  ]
}
```

`results`는 조회 결과 목록이라는 뜻입니다. `"results": []`이면 조회에는 성공했지만 현재 저장된 행이 없다는 뜻입니다.

## 3. 처음에는 데이터가 어떻게 만들어지나요?

`db/init/01-test.sql`에 표와 예제 데이터를 만드는 명령이 있습니다. DB를 처음 켜고 데이터 저장 공간이 비어 있을 때 이 파일이 자동 실행됩니다.

**이미 데이터 저장 공간이 있다면 파일을 수정해도 자동으로 다시 실행되지 않습니다.** Git으로 최신 코드를 받았다고 DB 내용까지 바뀌는 것도 아닙니다. [PostgreSQL 공식 이미지 설명](https://hub.docker.com/_/postgres)

## 4. 기존 DB에 현재 예제 SQL 적용

예제 표가 없거나 예제 문구를 다시 넣어야 할 때 사용합니다. 프로젝트 최상위에서 실행합니다.

```bash
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < db/init/01-test.sql
```

길어 보이지만 **실행 중인 DB에 접속해서 `01-test.sql` 파일을 실행하라**는 뜻입니다. 사용자 이름과 DB 이름은 컨테이너 설정에서 읽으므로 실제 비밀번호를 명령에 적지 않습니다. 오류가 생기면 중간에 멈추도록 되어 있습니다.

현재 예제 파일은 같은 이름의 표나 문구가 있으면 다시 만들거나 중복 추가하지 않습니다. 따라서 이 파일은 다시 실행해도 기존 데이터를 삭제하지 않습니다. 다만 이미 있는 표의 구조를 새 구조로 고쳐 주는 기능은 아닙니다. 다른 SQL 파일도 항상 안전한 것은 아니므로 내용을 확인합니다.

## 5. 터미널에서 직접 조회

브라우저를 거치지 않고 DB만 확인하려면 다음을 실행합니다.

```bash
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < db/queries/test.sql
```

번호와 `Hello PostgreSQL` 문구가 표 형태로 나오면 조회된 것입니다.

## 6. 데이터 조회가 안 될 때

브라우저에서 503이 나오면 서버가 DB 데이터를 읽지 못했다는 뜻입니다. 먼저 실행 기록을 확인합니다.

```bash
docker compose logs --tail=100 backend db
```

| 확인할 것 | 조치 |
| --- | --- |
| DB가 아직 준비 중인가? | 잠시 후 새로고침 |
| `test` 표가 없다는 기록인가? | 4단계의 현재 예제 SQL 적용 |
| 사용자·비밀번호가 맞지 않는가? | `.env`와 기존 DB 설정 확인 |
| DB 컨테이너가 꺼졌는가? | [실행 안내](docker-compose.md)에서 상태 확인 |

DB 데이터는 `coc-dashboard_postgres_data`라는 Docker 볼륨에 보관됩니다. 연결 오류를 해결하려고 볼륨을 삭제하지 않습니다.

## 7. 실제 기능의 DB 구조를 바꾸기 전

새 열 추가, 표 이름 변경, 기존 데이터 이동은 단순한 코드 병합과 별개입니다. 기존 DB에 적용할 방법과 순서를 두 사람이 먼저 정해야 합니다. SQL 파일로 관리할지 Django의 구조 변경 기록 기능으로 관리할지는 아직 합의된 것으로 취급하지 않습니다.

## 8. 프로토타입 기능이 쓰는 표 (Django 마이그레이션)

로그인·게시판·대시보드 프로토타입은 **Django 마이그레이션**으로 표를 만들도록 제안해 구현했습니다. 이 방식을 계속 쓸지는 PR 리뷰에서 함께 정합니다. `db/init`의 SQL 파일은 바꾸지 않았습니다.

| 표 | 만드는 곳 | 내용 |
| --- | --- | --- |
| `auth_user` 등 | Django 기본 앱 (`auth`, `sessions`, `contenttypes`) | 사용자, 로그인 세션 |
| `core_post` | `backend/core/migrations/0001_initial.py` | 게시글 (작성자, 제목, 내용, 작성·수정 시각) |
| `core_comment` | 위와 같음 | 댓글 (글, 작성자, 내용) |
| `core_postimage` | 위와 같음 | 첨부 이미지 (올린 사람, 글, 파일 경로). 실제 파일은 `backend/media/`에 저장 |
| `core_dashboardpanel` | `backend/core/migrations/0002_dashboardpanel.py` | 대시보드 패널 (소유자, 제목, 시각화 유형, 입력 값·함수식·변환 수식, 표시 옵션, 크기, 순서). 값·옵션은 JSON 열에 저장 |

코드를 받은 뒤 서버를 다시 빌드하고, 프로젝트 최상위에서 표를 만듭니다.

```bash
docker compose up --build -d
docker compose exec -T backend python manage.py migrate --noinput
```

로그인 확인용 데모 계정이 필요하면 다음을 실행합니다. 이미 있으면 다시 만들지 않습니다.

```bash
docker compose exec -T backend python manage.py seed_demo_user
```

데모 계정은 개발용입니다. 운영 환경에서는 실행하지 않습니다.

API로 데이터를 요청하는 자세한 방법은 [API 사용법](api.md)을 참고하세요.
