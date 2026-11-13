# 운영 데이터 설계

[문서 목록](../README.md) · [데이터 확인과 DB 구조 변경](database.md) · [관리자 DB 관리](database-admin.md)

인프라 자원·운영 작업은 **기준 월별로** 저장합니다. 권역별 요청작업은 서버가 기록한 KST 요청일이 속한 월로 자동 분류합니다. 운영 인력과 공통데이터(리전·서비스·인력)는 월 구분 없이 현재값 하나입니다. K8s 기능과 주별 테이블은 없습니다.

### 기준 월

- 열: 각 월별 테이블의 `period_month`(DATE, 그 달 1일만 허용. 검사 제약 `*_month_first_day`). 기본값은 이번 달(Asia/Seoul).
- API: `month`를 `YYYY-MM`으로 주고받습니다. 조회는 `?month=2026-08`, 저장은 본문 `"month": "2026-08"`. 없으면 이번 달이고 형식이 틀리면 `400`입니다. 응답의 각 행과 최상위에 `month`가 있습니다.
- 인프라 자원·운영 작업은 월마다 따로 입력합니다. 새 달은 빈 상태로 시작하며 지난달 값을 자동 복사하지 않습니다.
- 권역별 요청작업의 `period_month`는 사용자가 고르지 않습니다. 서버가 요청 등록 시각을 KST로 환산해 해당 월 1일을 저장하고, 목록은 `?month=YYYY-MM`으로 구분합니다.
- 합계(`totals`)는 조회한 월 기준입니다. 운영 인력 수는 월과 관계없이 전체입니다.
- 마이그레이션 적용 전에 있던 행은 2026-11월로 들어갔습니다.
- 화면: 상단바의 기준 월 선택(이전 달·목록·다음 달, 이번 달부터 24개월 전까지)이 모든 탭과 DB 관리에 같이 적용됩니다. 처음 열면 이번 달이고, 편집 중에 월을 바꾸면 확인 창을 띄웁니다. 코드는 `frontend/src/app/AppShell.tsx`(`MonthPicker`)이며 저장 요청은 `snapshot.month`를 보냅니다.

## 1. 테이블과 담당 앱

| 테이블 | 데이터 | 앱 |
| --- | --- | --- |
| `ops_regions` | 리전 이름·국가 코드·전체 리전(자동 계산). 내부 숫자 ID로 연결 | `reporting` |
| `ops_services` | 서비스 코드·이름 | `reporting` |
| `ops_staff_members` | 인력 이름(동명이인 허용). 내부 ID로 연결 | `reporting` |
| `infra_resources` | 기준 월·리전·서비스별 Host·VM·Compute Rack·Storage Rack 수량 | `features/resources` |
| `ops_staff_assignments` | 인력의 국가(KR·EU·NA)·직책·소속사·업무·근무지 | `features/staff` |
| `ops_work_summaries` | 기준 월별 요청·변경·장애 작업 수량과 평균 복구시간 | `features/work` |
| `ops_regional_requests` | 요청일 월·KR/NA/EU 리전·제목·리치 본문·Requester·작업 일정·상태·담당 권역·자유 입력 담당자 | `features/regional_requests` |
| `ops_regional_request_images` | 요청작업 리치 본문 이미지 | `features/regional_requests` |
| `auth_user` | 이메일 아이디·이름·비밀번호 해시·활성/관리자 | Django 인증 |
| `user_activity_logs` | 로그인·등록·수정(이전/새 값)·삭제(원본) 행동 이력 | `core` |
| `auth_invites`, `auth_invite_uses` | 초대 링크와 가입 기록 | `invites` |
| `ui_navigation_preferences` | 계정·브라우저별 숨긴 탭·사이드바 접기 | `reporting` |
| `ops_data_state` | 운영 데이터 동시 수정 버전(`revision`) | `reporting` |
| `ops_change_logs` | 운영 데이터 변경 이력. 월별 데이터 변경은 `period_month`에 기준 월 | `reporting` |
| `db_admin_change_logs` | 계정·댓글 관리자 변경 이력 | `database_admin` |
| `core_post`, `core_comment`, `core_postimage`, `core_dashboardpanel` | 게시판·대시보드(화면 미연결). 테이블 이름은 옮기기 전 그대로 | `features/board`, `features/dashboard` |

리전·서비스·인력은 **공통데이터**입니다. 모든 기능이 같은 원본을 참조하며 자동으로 만들지 않습니다. 관리자가 DB 관리 → 공통데이터에서 등록합니다. 공통데이터에는 사용 상태(`is_active`) 열이 없습니다. `auth_user.is_active`(로그인 가능 여부)와 업무 진행 상태는 별개입니다.

- 리전과 인력은 자동 생성되는 숫자 ID로 연결합니다. 화면에서는 이름으로 고르고 ID는 DB 원본에서만 보입니다. 서비스 코드와 국가 코드는 직접 입력하는 값입니다.
- 리전 기본 목록은 이름순, 인프라 요약 그래프는 수량 내림차순입니다.
- `ops_regions.global_region`(전체 리전)은 `country_code`로 DB가 계산하는 생성 열입니다. KR·CN=내수, EU=유럽, NA=북미, 그 외 NULL. 아직 화면·API에서 쓰지 않습니다. 분류를 바꾸려면 모델·마이그레이션의 계산식을 함께 바꿉니다.
- 인프라 고유 조합은 기준 월·리전·서비스(`unique_monthly_resource_service`), 운영 작업은 기준 월·리전·작업유형·범위(`unique_monthly_work_scope`)입니다. VM·Compute Rack·Storage Rack의 빈 값은 미입력, 0은 실제 0개입니다. 상단 Rack 카드는 Compute + Storage 합계이며 둘 다 비어 있을 때만 미입력입니다.
- 운영 인력은 리전 대신 국가 코드(KR·EU·NA)를 저장하며 API와 DB가 허용값을 검사합니다.

## 2. API와 저장

| 경로 (`/api/` 아래) | 방식 | 내용 | 코드 |
| --- | --- | --- | --- |
| `operations/bootstrap/` | GET | 공통데이터·관리자 여부 | `reporting/views.py` |
| `operations/current/[?month=YYYY-MM]` | GET | 기준 월의 기능별 데이터·합계·버전·최근 변경 이력(관리자만) | `reporting/views.py` + 각 `feature.py` |
| `operations/logs/[?section=&month=]` | GET | 변경 이력 최근 200건(관리자만) | `reporting/views.py` |
| `operations/regional_requests/[?month=&region=]` | GET/POST | 월·리전별 요청 목록 조회와 요청 등록 | `features/regional_requests/views.py` |
| `operations/regional_requests/{id}/` | GET/PATCH/DELETE | 요청 상세·수정, 관리자 삭제 | `features/regional_requests/views.py` |
| `operations/regional_requests/images/`, `images/{id}/` | POST/GET | 리치 본문 이미지 업로드·인증 조회 | `features/regional_requests/views.py` |
| `db-admin/sections/{기능}/` | PUT | `{revision, month, rows}`로 기준 월 데이터 전체 저장(관리자) | `reporting/views.py` |
| `db-admin/common/{regions·services·staff-members}/[{pk}/]` | POST/PATCH/DELETE | 공통데이터 관리(관리자) | `reporting/views.py` |

`{기능}`은 각 기능 앱 `feature.py`의 `Section.key`(`resources`, `staff`, `work`)입니다.

- 일반 기능 화면은 기본적으로 조회 전용입니다. 업무 데이터와 공통데이터의 일괄 변경은 `/api/db-admin/`에서 **실제 활성 관리자만** 합니다. 개발용 로그인 우회(`DEVELOPMENT_AUTH_BYPASS`)도 쓰기 권한을 주지 않습니다.
- 예외: 권역별 요청작업은 일반 화면에서 관리자와 사용자가 등록합니다. 요청 리전은 KR·NA·EU 중 하나입니다. 요청 내용은 작성자·관리자만 수정하고 상태·담당 권역·자유 입력 담당자는 관리자·사용자가 수정하며 삭제는 관리자만 합니다.
- 기능별 저장은 기준 월의 전체 행을 보냅니다(월별 기능). 기존 행은 `id`를 유지하고 새 행은 생략합니다. 다른 달의 `id`는 거절합니다. 그 월에서 빠진 행만 실제로 삭제하고 다른 달 행은 그대로 둡니다. 연결된 데이터(댓글, 사용 중인 공통데이터)가 있으면 거절합니다.
- 모든 저장은 `revision`을 확인합니다. 다른 저장이 먼저 있었으면 `409`이며 최신 데이터를 다시 불러와 편집합니다. 수량·상태 제약은 서버와 DB가 함께 검사합니다(오류 `400`).
- 열 이름이 바뀐 뒤 예전 열 이름(`environment_name`, `zone_name` 등)으로 보내는 요청은 거절해 오래 열린 화면이 값을 바꾸지 않게 합니다.

## 3. 권한

| 권한 | 저장 방법 | 할 수 있는 일 |
| --- | --- | --- |
| 관리자 | `is_staff=true` | 모든 조회·수정·삭제, DB 관리, 변경 이력·행동 이력 |
| 옵저버 | `observer` 그룹 | 조회만. 모든 쓰기·초대 발급·취소는 `403` |
| 사용자 | 그 외 활성 계정 | 조회, 권역별 요청작업 등록, 모든 요청의 상태·담당 변경, 본인 요청 내용 수정, 초대 발급 |

- 권역별 요청작업 응답은 `can_edit_content`, `can_update_assignment`, `can_delete`를 내려 주고 화면은 이 값으로만 버튼을 보여 줍니다. 작성자 아이디는 응답에 넣지 않습니다.
- 권역별 요청작업 삭제는 관리자만 가능하며, 옵저버는 조회만 합니다.
- 권한 변경은 DB 관리 → 기능별 설정 → 사용자·권한에서만 합니다. `/api/me/`는 조회 전용입니다.

## 4. 개인 화면 설정

`GET/PATCH /api/navigation/preferences/`는 본인의 `hidden_tabs`, `sidebar_collapsed`만 다룹니다. 로그인 사용자는 계정별, 비로그인 개발 화면은 서명된 HttpOnly 쿠키로 브라우저별로 저장합니다. 처음 로그인하면 브라우저 설정을 계정으로 가져옵니다. PATCH에는 CSRF가 필요합니다. 숨길 수 있는 탭은 각 앱 `feature.py`의 `tabs`이며 홈·DB 관리는 숨길 수 없습니다. 업무 데이터 권한과는 별개입니다.

## 5. 과거 구조 변경 기록

이미 배포된 마이그레이션은 기존 설치의 업그레이드에 필요하므로 지우지 않습니다.

| 마이그레이션 | 내용 |
| --- | --- |
| `reporting` 0001~0006 | 주별 테이블을 최신값 테이블로 전환. 가장 최근 주의 데이터와 그 댓글만 이전, 주·K8s·test 테이블 제거 |
| `reporting` 0007, 0016 | Compute Rack 열 제거 후 빈 열로 다시 추가(이전 값은 복원하지 않음) |
| `reporting` 0009 | 공통데이터 사용 상태(`is_active`) 제거 |
| `reporting` 0011 | 인프라 `zone_name`→`environment_name`, `storage_rack_count`→`storage_count`, 인력 `role`→`job_title`, 리전 표시 순서 제거 |
| `reporting` 0012 | 운영 인력 리전 → 국가 코드(KR·EU·NA) |
| `reporting` 0013, 0014 | 인력코드 제거, 리전 코드 PK → 자동 숫자 ID |
| `reporting` 0015 | 이슈 작성자 열 |
| `reporting` 0017 | 인프라 환경(`environment_name`) 열과 값 삭제(삭제 전 백업은 `.artifacts/backups/`) |
| `reporting` 0018, `core` 0004, 각 기능 앱 0001 | 기능별 모델을 `backend/features/<기능>` 앱으로 이동. DB는 바꾸지 않고 Django 상태만 옮김 |
| `resources`·`work`·`issues` 0002, `reporting` 0019 | 기준 월(`period_month`) 추가, 기존 행은 2026-11월로 이전, 고유 조합에 월 추가, 변경 이력에 기준 월 열(적용 전 백업은 `.artifacts/backups/`) |
| `issues` 0003 | 리전 이슈와 댓글 테이블 제거 |
| `regional_requests` 0001 | 권역별 요청작업·담당 계정·리치 본문 이미지 테이블 추가 |
| `regional_requests` 0002 | 요청 리전을 KR·NA·EU 값으로 단순화하고 담당 계정 테이블을 자유 입력 담당자로 변경 |
