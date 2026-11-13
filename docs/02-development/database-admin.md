# 관리자 DB 관리

[문서 목록](../README.md) · [운영 데이터 설계](operations.md)

DB 관리 탭과 `/api/db-admin/`은 **실제 로그인한 활성 관리자만** 씁니다. 개발용 로그인 우회도 적용하지 않습니다. 화면 코드는 `frontend/src/features/database/`, 서버 코드는 `backend/database_admin/`과 각 기능 앱의 `admin_urls.py`입니다.

## 1. 본문 위 가로 탭

| 탭 | 내용 | 화면 코드 |
| --- | --- | --- |
| 공통데이터 | 리전·서비스·인력을 하위 탭으로 등록·수정·삭제·행 복사 | `features/database/CommonData.tsx` |
| 기능별 설정 | 기능별 현재값 편집, 이슈 댓글, 사용자·권한 | 각 기능 `feature.tsx`의 `admin` + `features/database/AccountsAdmin.tsx` |
| DB 원본 | 웹에서 쓰는 테이블만 읽기 전용으로 조회 | `features/database/RawTables.tsx` |

기능별 설정의 하위 탭은 각 기능이 등록합니다. 현재 순서는 인프라 자원 → 운영 인력 → 운영 작업 → 리전 이슈 → 이슈 댓글 → 사용자·권한입니다. 새 기능이 `admin`을 등록하면 사용자·권한 앞에 자동으로 추가됩니다. 공통데이터 목록을 기능 입력 화면에 반복해서 두지 않습니다.

## 2. 기능별 설정

- 편집 화면은 조회 상태로 열리고 **편집 → 변경사항 저장**을 눌러야 DB에 반영됩니다. 삭제한 행은 저장할 때 실제로 삭제됩니다.
- 편집 중에는 다른 탭으로 이동할 때 확인 창이 뜹니다.
- 인프라 수량은 Host·VM·Compute Rack·Storage Rack을 입력합니다. 리전의 전체 리전은 자동 계산이라 입력하지 않습니다.
- 사용자·권한에서는 이메일 아이디·이름·비밀번호·활성 상태·권한(관리자·옵저버·사용자)을 관리하고, **이력**에서 계정별 로그인·등록·수정(이전/새 값)·삭제(원본)를 봅니다. 로그인 상태는 만료되지 않은 세션 수로 표시합니다.
- 새 비밀번호는 검증 후 해시로만 저장하고 응답·이력에 넣지 않습니다. 현재 관리자 자신과 최고 관리자는 비활성화·권한 해제·삭제할 수 없습니다.

## 3. 행 복사

행 복사는 편집 초안만 만들고 저장 전에는 DB가 바뀌지 않습니다. ID·시각·비밀번호·연결 댓글은 복사하지 않습니다.

- 공통데이터: 서비스는 새 코드를 입력하고 이름에 "(복사)"가 붙습니다. 리전은 이름·국가, 인력은 이름만 복사합니다.
- 기능별: 인프라는 리전·서비스, 작업은 리전·구분·대상, 인력은 성명(복사 시 비워 둠)을 확인한 뒤 저장합니다. 중복 조합은 서버가 전체를 거절합니다.
- 계정: 새 아이디·비밀번호를 직접 입력하며 기본 권한은 사용자입니다.

## 4. DB 원본

허용 목록은 각 앱 `feature.py`의 `tables`에서 모읍니다(계정 `core`, 공통데이터 `reporting`, 기능 테이블은 각 기능 앱). 세션·마이그레이션·권한 내부 테이블과 게시판·대시보드 테이블은 보여 주지 않습니다.

검색·정렬·페이지 조회와 열·자료형·기본값·기본키·제약조건 조회만 제공합니다. **행·열·테이블 구조 모두 읽기 전용**이며 쓰기 API는 없습니다(쓰기 요청은 `405`). 비밀번호·토큰 같은 민감한 값과 그 기본값은 숨깁니다.

## 5. API

| 경로 (`/api/db-admin/` 아래) | 방식 | 내용 | 코드 |
| --- | --- | --- | --- |
| `sections/{기능}/` | PUT | 기능별 기준 월 데이터 저장(본문 `month`, 생략 시 이번 달) | `reporting/admin_urls.py` |
| `common/{collection}/`, `common/{collection}/{pk}/` | POST / PATCH·DELETE | 공통데이터 | `reporting/admin_urls.py` |
| `issues/{id}/comments/` | POST | 이슈 화면의 댓글 등록 | `features/issues/admin_urls.py` |
| `comments/`, `comments/{id}/` | GET·POST / PATCH·DELETE | 이슈 댓글 관리 | `features/issues/admin_urls.py` |
| `accounts/`, `accounts/{id}/`, `accounts/{id}/activities/` | GET·POST / PATCH·DELETE / GET | 계정·권한·행동 이력 | `database_admin/accounts.py` |
| (경로 없음: `/api/db-admin/`), `tables/{table}/`, `tables/{table}/rows/` | GET | 원본 테이블 목록·구조·행 | `database_admin/views.py` |
| `changes/` | GET | 계정·댓글 관리자 변경 이력 | `database_admin/views.py` |

쓰기에는 CSRF 토큰과 관리자 세션이 필요합니다.
