# 데이터 요청과 응답 (API)

[문서 목록](../README.md) · [운영 데이터 설계](operations.md) · [관리자 DB 관리](database-admin.md)

API 목록과 실행 화면은 `http://localhost:8080/api/docs/`, 다른 도구가 읽는 설명 데이터는 `/api/schema/`에 있습니다.

## 1. 공통 규칙

- 모든 주소는 `/api/` 아래에 있습니다. 공통 앱 주소는 `backend/core·invites·reporting·database_admin`의 `urls.py`, 기능 주소는 `backend/features/<기능>/urls.py`(→ `/api/`)와 `admin_urls.py`(→ `/api/db-admin/`)에 있으며 자동으로 연결됩니다.
- 로그인은 Django 세션 방식입니다. POST·PATCH·PUT·DELETE에는 `csrftoken` 쿠키 값을 `X-CSRFToken` 헤더에 넣습니다. 화면 코드(`frontend/src/shared/api/client.ts`)가 자동으로 처리합니다.
- `200`·`201`·`204` 정상, `400` 입력 오류, `401` 로그인 실패, `403` 로그인·권한·CSRF 오류, `404` 없음, `405` 허용하지 않는 방식, `409` 동시 수정 충돌입니다.
- 접속 주소가 `http://localhost:8080`이나 운영 도메인이 아니면 로그인이 `403`으로 막힐 수 있습니다. [설정](configuration.md)의 `DJANGO_CSRF_TRUSTED_ORIGINS`를 확인합니다.

API 코드를 고친 뒤에는 설명 데이터 형식도 검사합니다.

```bash
docker compose exec backend python manage.py spectacular --validate --fail-on-warn
```

## 2. 로그인·회원가입·초대 (`core`, `invites`)

| 경로 | 방식 | 용도 |
| --- | --- | --- |
| `/api/auth/csrf/` | GET | `csrftoken` 쿠키 발급(`204`) |
| `/api/auth/login/` | POST | `{username, password}` 로그인. 실패 `401` |
| `/api/auth/register/` | POST | `{name, username, password, invite}` 회원가입 후 자동 로그인(`201`). 초대가 유효하지 않으면 `400`(`invite`) |
| `/api/auth/logout/` | POST | 로그아웃(`204`) |
| `/api/me/` | GET | 내 정보 `{id, name, username, email, date_joined, is_staff, role}`. 조회 전용 |
| `/api/auth/invites/{token}/` | GET | 비로그인 초대 확인. 유효하면 `{status, inviter_name, expires_at}`, 아니면 `404`와 사유(`missing`·`revoked`·`expired`·`used_up`) |
| `/api/invites/` | GET, POST | 내가 만든 초대 목록(관리자는 전체)·발급. 발급 응답에만 토큰 원문 `token`. 옵저버 발급은 `403` |
| `/api/invites/options/` | GET | 고를 수 있는 기간·인원과 기본값 |
| `/api/invites/{id}/revoke/` | POST | 초대 취소. 만든 사람·관리자만, 옵저버는 `403` |
| `/api/app-config/` | GET | 개발용 로그인 우회 여부 |
| `/api/navigation/preferences/` | GET, PATCH | 내 탭 숨김·사이드바 접기 |

- 회원가입은 초대 링크(`/?invite=<토큰>`)로만 합니다. 일반 사용자는 1일·10명 링크, 관리자는 1·7·30일과 50·100·200명 중에서 고릅니다(기본 7일·50명). 범위 밖 값은 `400`입니다.
- 토큰은 SHA-256 해시로만 저장하므로 링크는 만들 때 한 번만 복사할 수 있습니다. 가입 실패 시 사용 횟수는 늘지 않습니다.
- 아이디는 이메일 형식이며 소문자로 저장하고 대소문자 구분 없이 중복을 검사합니다. 비밀번호는 8~128자이며 흔하거나 숫자만 있거나 회원정보와 비슷하면 거절합니다.
- `admin`은 backend 시작 시 없을 때만 만드는 기본 관리자(`admin`/`admin`)이며 `@` 없는 아이디의 유일한 예외입니다.
- 계정 수정·권한 변경은 [관리자 DB 관리](database-admin.md)의 사용자·권한에서 합니다.

## 3. 운영 데이터

현재값 조회(`/api/operations/bootstrap/`, `/api/operations/current/`), 리전 이슈 작성(`/api/operations/issues/...`), 관리자 저장(`/api/db-admin/...`)은 [운영 데이터 설계](operations.md#2-api와-저장)와 [관리자 DB 관리](database-admin.md#5-api)에 정리했습니다.

```bash
curl http://localhost:8080/api/operations/current/
```

로그인하지 않으면 `403`입니다. 브라우저에서 로그인한 뒤 같은 주소를 열면 현재값을 볼 수 있습니다.

## 4. 게시판·대시보드 (`features/board`, `features/dashboard`)

서버 API만 있고 화면은 메뉴에 연결하지 않았습니다. 로그인해야 쓰며 쓰기 권한은 [권한 규칙](operations.md#3-권한)과 같습니다.

| 경로 | 방식 | 용도 |
| --- | --- | --- |
| `/api/board/posts/` | GET, POST | 글 목록(최신순)·작성. 제목·내용이 비면 `400` |
| `/api/board/posts/{id}/` | GET, PATCH, DELETE | 글 상세·수정·삭제. 작성자·관리자만 수정·삭제 |
| `/api/board/posts/{id}/comments/` | POST | 댓글 작성 |
| `/api/board/comments/{id}/` | PATCH, DELETE | 댓글 수정·삭제. 작성자·관리자만 |
| `/api/board/images/` | POST | 이미지 업로드(항목 이름 `file`, png·jpeg·gif·webp, 5MB 이하) |
| `/api/board/images/{id}/` | GET | 이미지 보기 |
| `/api/dashboard/panels/` | GET, POST | 내 패널 목록·추가 |
| `/api/dashboard/panels/{id}/` | GET, PATCH, DELETE | 패널 조회·수정·삭제. 남의 패널은 `404` |
| `/api/dashboard/panels/reorder/` | POST | `{ids: [...]}`로 내 패널 순서 변경 |

- 글의 `image_ids`에 미리 올린 이미지 번호를 넣으면 첨부됩니다(글당 5장, 본인이 올린 이미지만). 첨부파일은 로컬 볼륨 `coc-dashboard_media_data`, EC2 `/srv_db/media`에 저장됩니다. Nginx 기본 요청 크기 제한은 1MB입니다.
- 대시보드 패널의 수식은 서버가 문법만 검사합니다(`backend/features/dashboard/expr.py`). 연산자 `+ - * / % ^`, 함수 `abs round floor ceil sqrt log log10 exp sin cos tan pow min max clamp`, 상수 `pi`·`e`를 씁니다. 함수식 변수는 `t`, 변환 수식 변수는 `x i n t prev sum avg min max`입니다.
- 이 기능의 화면 코드는 저장소에서 정리했습니다. 다시 만들 때 예전 코드는 Git 이력(게시판 `1238a14`, 대시보드 `41782f7`)에서 볼 수 있습니다.
