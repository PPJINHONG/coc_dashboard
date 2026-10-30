# API 확인

`http://localhost:8080/api/docs/`에서 API 문서를 열 수 있습니다. 현재 운영 데이터는 **GET /api/operations/current/**, 기준정보는 **GET /api/operations/bootstrap/**에서 확인합니다.

기능별 저장 요청에는 CSRF 토큰과 최신 `revision`을 포함합니다. 운영 데이터는 로그인 후 조회하며 모든 데이터 편집과 관리자 설정에는 실제 활성 관리자 세션이 필요합니다. 현재 `DEVELOPMENT_AUTH_BYPASS=false`를 사용합니다. 상세 주소는 아래 운영 최신값 API와 [관리자 DB 관리](database-admin.md)를 참고하세요.

| 주소 | 용도 |
| --- | --- |
| `/` | 운영 현황 화면 |
| `/api/docs/` | API 문서 |
| `/api/schema/` | OpenAPI 설명 데이터 |
| `/api/operations/current/` | 현재 운영 데이터·합계 |
| `/api/operations/bootstrap/` | 공통 기준정보 |

```bash
curl http://localhost:8080/api/operations/current/
```

`200`은 정상, `400`은 입력 오류, `403`은 인증·권한·CSRF 오류, `409`는 다른 저장으로 인한 동시 수정 충돌입니다. 과거 연결 확인용 API는 제거했습니다.

## 6. 설명 데이터에 오류가 없는지 검사

API 코드를 수정한 뒤, 서버 컨테이너가 실행 중인 상태에서 프로젝트 최상위에서 실행합니다.

```bash
docker compose exec backend python manage.py spectacular --validate --fail-on-warn
```

API 설명 데이터를 만들면서 형식을 검사하고 경고가 있으면 실패로 처리합니다. 성공해도 실제 조회 기능까지 검사한 것은 아니므로 1단계처럼 직접 요청해 봅니다.

DB 조회 실패 시 응답에는 `error` 항목이 나오고 자세한 오류는 서버 실행 기록에 남습니다. 로그인은 Django 세션 방식(`SessionAuthentication`)을 사용합니다. [DRF 설정 설명](https://www.django-rest-framework.org/api-guide/settings/)

## 7. 로그인·회원 정보·게시판·대시보드 API (프로토타입)

모두 `/api/` 아래에 있고 `backend/core/urls.py`에서 연결합니다. `/api/auth/csrf/`·`/api/auth/login/`·`/api/auth/register/`·`/api/auth/logout/`을 제외한 아래 주소는 로그인해야 쓸 수 있으며, 로그인하지 않으면 `403`을 돌려줍니다.

| 경로 | 요청 방식 | 용도 |
| --- | --- | --- |
| `/api/auth/csrf/` | GET | 쓰기 요청에 필요한 `csrftoken` 쿠키 발급 (`204`) |
| `/api/auth/login/` | POST | `{username, password}`로 로그인. 실패 시 `401` |
| `/api/auth/register/` | POST | `{name, username, password, invite}`로 회원가입 후 자동 로그인 (`201`). 유효한 초대 토큰이 없으면 `400` (`invite` 항목) |
| `/api/auth/invites/{token}/` | GET | 비로그인 확인용. 초대가 유효하면 `{status, inviter_name, expires_at}`, 아니면 `404`와 사유(`missing`·`revoked`·`expired`·`used_up`) |
| `/api/invites/` | GET, POST | 내가 만든 초대 링크 목록(관리자는 전체)·발급. 발급 응답에만 토큰 원문 `token`이 들어 있음. 옵저버의 발급은 `403` |
| `/api/invites/options/` | GET | 내 권한으로 고를 수 있는 `expires_days`·`max_uses` 목록과 기본값 |
| `/api/invites/{id}/revoke/` | POST | 초대 링크 취소. 만든 사람이나 관리자만 가능하며, 다른 사람의 링크는 `404`, 옵저버는 `403` |
| `/api/auth/logout/` | POST | 로그아웃 (`204`) |
| `/api/me/` | GET | 내 정보 조회 전용. 계정 수정은 관리자 DB 설정에서 처리 |
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

### 회원가입·회원정보 수정 항목

- 회원가입은 초대 링크로만 할 수 있습니다. 로그인한 팀원은 누구나 화면 왼쪽의 "팀원 초대"에서 링크를 만들 수 있고, 관리자 승인은 필요 없습니다. 링크 형식은 `https://<사이트>/?invite=<토큰>`입니다.
- 초대 기간과 가입 인원은 권한에 따라 다릅니다. 일반 팀원은 1일·10명 링크만 만들 수 있고, 관리자는 기간 1·7·30일과 인원 50·100·200명 중에서 고릅니다(기본 7일·50명). 한 번에 많은 인원이 가입해야 할 때는 관리자가 최대 200명 링크를 만듭니다. 선택지는 `GET /api/invites/options/`가 알려 주며, 권한 밖 값으로 발급하면 `400`입니다. 기간이 지나거나 인원이 차거나 취소된 링크로는 가입할 수 없습니다.
- 토큰은 SHA-256 해시로만 저장하므로(`auth_invites.token_hash`) 링크는 만들 때 한 번만 복사할 수 있습니다. 목록에는 토큰 끝 4자리만 표시합니다. 누가 어떤 링크로 가입했는지는 `auth_invite_uses`에 남습니다.
- 가입 입력이 틀려 실패하면 초대 사용 횟수는 줄지 않습니다. 가입과 사용 횟수 증가는 한 트랜잭션에서 초대 행을 잠근 채 처리합니다.
- `auth_invites`·`auth_invite_uses`는 `auth_user`를 참조하므로 init SQL 대신 backend 시작 시 Django `invites/0001_initial`로 생성합니다.
- 가입 입력은 `name`(이름), `username`(이메일 형식 아이디), `password`, `invite`(초대 토큰) 네 가지입니다. 이름과 아이디는 최대 150자입니다.
- 아이디는 공백을 제거하고 소문자로 저장하며, 대소문자를 구분하지 않고 기존 아이디·이메일과 중복을 검사합니다. 가입 시 `auth_user.username`과 `auth_user.email`에 같은 값을 저장합니다. 기존 계정은 삭제하거나 일괄 변경하지 않습니다.
- 비밀번호는 8~128자이며, 흔한 비밀번호·숫자만 있는 비밀번호·회원정보와 너무 비슷한 비밀번호를 거절합니다. DB에는 Django 비밀번호 해시만 저장합니다.
- 가입·로그인·내 정보 응답은 `{id, name, username, email, date_joined, is_staff}`입니다. 비밀번호와 현재 비밀번호는 응답에 포함하지 않습니다.
- `PATCH /api/me/`에 `name`만 보내면 이름을 수정합니다. 아이디를 바꾸려면 `username`과 `current_password`, 비밀번호를 바꾸려면 `password`와 `current_password`를 보냅니다. 두 항목을 동시에 바꿀 수도 있습니다.
- 아이디 변경 시 이메일도 함께 변경합니다. 비밀번호 변경 후 현재 로그인은 유지하며, 다른 로그인 세션은 만료됩니다.
- `id`, `email`, `date_joined`, `is_staff`는 읽기 전용입니다. 일반 가입·프로필 수정으로 관리자 권한을 얻을 수 없습니다.
- `admin@admin`은 관리 명령으로 생성하는 관리자 전용 예외입니다. 일반 회원가입·아이디 변경에는 올바른 이메일 형식이 필요합니다.
- 회원가입·로그인에도 CSRF 토큰이 필요합니다. 가입·로그인 직후 토큰이 회전하므로 후속 요청은 새 쿠키 값을 읽어 사용합니다.

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

## 8. 운영 최신값 API

일반 운영 화면은 조회 전용입니다. 개발 모드에서는 로그인 없이 조회할 수 있지만 저장할 수 없습니다. 모든 업무 데이터·댓글·공통데이터 변경은 실제 활성 관리자만 DB 관리 경로에서 수행하며 CSRF 검사를 유지합니다.

| 경로 (`/api/` 아래) | 방식 | 내용 |
| --- | --- | --- |
| `app-config/` | GET | 개발 모드 여부 |
| `operations/bootstrap/` | GET | 리전·서비스·인력 기준정보 |
| `operations/current/` | GET | 현재 데이터·합계·동시 수정 버전·최근 로그 |
| `db-admin/sections/{section}/` | PUT | `{revision, rows}`로 최신값 저장 |
| `db-admin/issues/{id}/comments/` | POST | `{revision, content}` 댓글 등록 |
| `db-admin/common/{collection}/` | POST | 관리자 공통데이터 추가 |
| `db-admin/common/{collection}/{pk}/` | PATCH/DELETE | 관리자 공통데이터 수정·삭제 |
| `operations/logs/` | GET | 최근 200건 변경 이력. `section` 필터 |

`section`은 `resources`, `staff`, `work`, `issues`, `collection`은 `regions`, `services`, `staff-members`입니다. 주·월·K8s API는 제거했습니다.

기능별 저장은 현재 전체 행을 보냅니다. 기존 행은 `id`를 유지하고 새 행은 생략합니다. 보낸 목록에서 빠진 행은 실제 삭제하며 참조 데이터가 있으면 거절합니다. 중복·수량 제약 오류는 400, 동시 수정 충돌은 409입니다. 기능별 관리자 설정과 읽기 전용 원본 조회는 [관리자 DB 관리](database-admin.md), 모델은 [운영 데이터 설계](operations.md)를 참고하세요.
