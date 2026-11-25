# 관리자 DB 관리

[문서 목록](../README.md) · [운영 데이터 설계](operations.md)

DB 관리 탭과 `/api/db-admin/`은 **실제 로그인한 활성 관리자만** 씁니다. 개발용 로그인 우회도 적용하지 않습니다. 화면 코드는 `frontend/src/features/database/`, 서버 코드는 `backend/database_admin/`과 `reporting/admin_urls.py`입니다.

## 1. DB 관리 화면

DB 관리 화면은 `features/database/RawTables.tsx`를 사용해 웹에서 쓰는 DB 원본 목록을 바로 표시합니다. 공통데이터와 기능별 설정 메뉴는 제공하지 않습니다.

허용 목록은 각 앱 `feature.py`의 `tables`에서 모읍니다(계정 `core`, 공통데이터 `reporting`, 기능 테이블은 각 기능 앱). 세션·마이그레이션·권한 내부 테이블과 게시판·대시보드 테이블은 보여 주지 않습니다.

검색·정렬·페이지 조회와 열·자료형·기본값·기본키·제약조건 조회만 제공합니다. **행·열·테이블 구조 모두 읽기 전용**이며 쓰기 API는 없습니다(쓰기 요청은 `405`). 비밀번호·토큰 같은 민감한 값과 그 기본값은 숨깁니다.

## 2. 기능 데이터 편집

기능 데이터의 등록·수정·삭제 화면은 필요한 기능 탭에 둡니다. 인프라 자원은 평상시에 관리자와 사용자가 같은 읽기 전용 표를 보며, 실제 활성 관리자만 자원 목록 상단의 편집 버튼으로 편집 모드에 들어가 행을 추가·수정·삭제합니다.

공통데이터 편집 화면은 DB 관리에 연결하지 않으며 사용되지 않던 `CommonData.tsx`는 제거했습니다. `/api/db-admin/common/` API는 기존 클라이언트 호환을 위해 유지합니다.

## 3. API

| 경로 (`/api/db-admin/` 아래) | 방식 | 내용 | 코드 |
| --- | --- | --- | --- |
| `sections/{기능}/` | PUT | 기능별 기준 월 데이터 일괄 저장. DB 관리 화면에는 연결하지 않습니다. | `reporting/admin_urls.py` |
| `common/{regions·staff-members}/`, `common/{regions·staff-members}/{pk}/` | POST / PATCH·DELETE | 호환용 리전·인력 공통데이터 관리 API. 화면에는 연결하지 않습니다. | `reporting/admin_urls.py` |
| `accounts/`, `accounts/{id}/`, `accounts/{id}/activities/` | GET·POST / PATCH·DELETE / GET | 기존 계정·권한·행동 이력 API | `database_admin/accounts.py` |
| (경로 없음: `/api/db-admin/`), `tables/{table}/`, `tables/{table}/rows/` | GET | 원본 테이블 목록·구조·행 | `database_admin/views.py` |
| `changes/` | GET | 계정·댓글 관리자 변경 이력 | `database_admin/views.py` |

쓰기에는 CSRF 토큰과 관리자 세션이 필요합니다.
