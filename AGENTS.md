# COC Dashboard 작업 원칙

## 기본 작업

- 요청한 결과를 완성하도록 코드·설정·관련 파일을 자율적으로 수정한다. 일반적인 구현 선택은 직접 판단하고, 관련 파일과 문서만 필요할 때 읽는다.
- 기본은 한 에이전트가 구현과 확인까지 처리한다. 사용자의 별도 분업·검토 요청이 있을 때만 추가 에이전트를 사용한다.
- 다른 작업자의 변경은 보존한다. Git 조회는 가능하며 브랜치 전환·스테이징(`git mv` 포함)·커밋·푸시·병합은 별도 요청이 있을 때만 실행한다.
- 요구사항의 핵심이 모호하거나 실제 데이터 삭제·운영 배포가 필요하면 질문한다. 기존 API·인증·DB 정책의 중요한 변경은 기존 합의와 사용자 의도를 확인한다.

## 구조와 두 사람 협업

- 상세: [폴더 구조와 기능 추가 방법](docs/02-development/structure.md), [기능별로 나눠 개발하기](docs/03-collaboration/parallel-development.md).
- 기능 탭 하나는 `frontend/src/features/<기능>/`과 `backend/features/<기능>/`(Django 앱, label=폴더 이름)에 둔다. 기능 ID·폴더 이름·API 이름(`Section.key`)·탭 ID를 같게 둔다.
- 기능 등록은 화면 `feature.tsx`(FeatureDefinition), 서버 `feature.py`(Feature: tabs·tables·sections·totals)로만 한다. `features/registry.ts`, `backend/features/__init__.py`, `config/settings.py`, `config/urls.py`가 자동으로 모으므로 공통 파일에 기능 이름을 나열하지 않는다.
- 기능 폴더는 공통 코드(`frontend/src/shared/`, `backend/core·reporting·database_admin·invites`)만 import하고 다른 기능 폴더를 import하지 않는다. 공통 코드도 기능 코드를 import하지 않는다. 다른 기능이 필요하면 화면은 `features` prop, 서버는 registry나 신호(`core.signals.username_changed`)를 쓴다.
- 기능 전용 스타일은 기능 폴더 CSS에 두고, 여러 기능이 쓰는 스타일은 `shared/styles/`에 둔다. 스타일 적용 순서(공통 → 기능, `tokens.css`는 `main.tsx`에서 마지막)를 바꾸지 않는다.
- 공통 파일(`frontend/src/app/`, `shared/`, 공통 앱, 설정·Compose·CI, 지침)을 바꿀 때는 이유를 보고하고 기능 변경과 섞지 않는다.
- 게시판(`features/board`)·대시보드(`features/dashboard`)는 서버 API만 유지하고 화면은 메뉴에 연결하지 않는다.

## 프로젝트 설정

- 설정은 `.env` 하나, 실행 구성과 이미지 버전은 `compose.yaml`에서 관리한다. EC2 운영은 별도 전체 파일 `compose.prod.yaml`(프로젝트 이름 `coc-dashboard-prod`, 데이터 `/srv_db`)을 `docker compose -f compose.prod.yaml`로 실행한다. 서비스 설정을 바꾸면 두 파일을 함께 맞춘다. 로컬과 EC2는 같은 `.env` 내용을 사용하며 `.env`는 Git에 올리지 않고 팀이 직접 공유한다.
- 실제 비밀번호·키·토큰은 출력하거나 Git·문서·보고에 포함하지 않는다. 설정 확인에는 `docker compose config --quiet`를 사용한다.
- 환경변수를 바꾸면 사용 코드/Compose, CI의 임시 `.env`, [설정 문서](docs/02-development/configuration.md)를 함께 맞춘다. 터미널의 환경변수가 `.env`보다 우선할 수 있다.
- DB·첨부파일은 로컬은 고정 이름 Docker 볼륨 `coc-dashboard_postgres_data`, `coc-dashboard_media_data`, EC2는 `/srv_db/postgres`, `/srv_db/media`에 보관한다. 배포는 `git pull` → `down` → `up --build -d`(EC2는 `-f compose.prod.yaml`)이며 EC2 백업은 AWS 스냅샷이다. Git에는 업무 데이터를 넣지 않는다.
- backend 시작 시 `ensure_admin`이 기본 계정을 없을 때만 만든다. 비밀번호는 아이디와 같으며 이미 있는 계정의 비밀번호·권한은 바꾸지 않는다. `admin`(관리자, 기존 `admin@admin`은 `admin`으로 변경), `kr`·`eu`·`na`(각각 KR·EU·NA 그룹장), `readonly`(옵저버). 목록은 `backend/core/defaults.py`이며 기본 계정만 @ 없는 아이디를 허용한다. 운영에서는 첫 로그인 후 비밀번호를 바꾼다.

## DB 구조 변경

- 테이블 구조는 해당 앱의 Django 마이그레이션으로만 바꾼다. 기능 테이블은 그 기능 앱, 공통데이터(리전·서비스·인력)·변경 이력·탭 설정은 `reporting`, 행동 이력은 `core`에서 만든다. 과거 마이그레이션은 기존 설치의 업그레이드에 필요하므로 수정·삭제하지 않는다.
- `db/init/*.sql`은 신규 설치용 고정 기준선(`reporting` 0017 시점)이다. 수정하지 않는다. 이후 구조는 `migrate --fake-initial`이 이어서 적용한다.
- 컬럼·테이블 삭제나 값 이전이 있는 마이그레이션은 실행 전에 로컬 DB를 `.artifacts/backups/`(Git 제외)에 백업하고 보고한다.
- 리전·서비스·인력 등 업무 데이터와 샘플은 init SQL·마이그레이션·서버 시작 과정에서 자동 등록하지 않는다. 관리자가 UI에서 입력한다.

## 로컬 Docker 반영

- 코드·설정을 수정하면 필요한 Docker 중지·재빌드·재기동·마이그레이션까지 직접 수행하고, 실행 중인 서비스에 반영된 것을 확인한 뒤 완료를 보고한다. 사용자에게 재시작이나 빌드를 넘기지 않는다.
- 컨테이너 재생성이나 이미지 재빌드가 필요한 변경은 `docker compose down` 후 `docker compose up --build -d`로 반영한다. 서버 코드를 바꾸면 `docker compose exec backend pytest`도 실행한다(임시 DB 사용).
- 기존 `.env`와 DB 볼륨·데이터를 보존한다. `docker compose down -v` 또는 데이터 볼륨 삭제는 실행하지 않는다. 검증용 스택이 필요하면 별도 프로젝트 이름·볼륨·포트를 쓴다(`compose.yaml`의 볼륨 이름이 고정이므로 `-p`만 바꾸면 실제 볼륨을 공유한다).
- 반영 후 컨테이너 상태와 관련 API·화면 동작을 확인한다. 운영 배포는 기존 승인 원칙을 따른다.

## 운영 데이터와 권한

- 상세: [운영 데이터 설계](docs/02-development/operations.md), [관리자 DB 관리](docs/02-development/database-admin.md).
- 로그인·회원가입(초대 링크 전용)을 사용하며 `.env`의 `DEVELOPMENT_AUTH_BYPASS=false`를 유지한다. 로그인 없는 개발은 별도 요청이 있을 때만 허용한다.
- 인프라 자원·운영 작업은 기준 월(`period_month`, 그 달 1일 DATE)별로 저장·조회하고 새 달은 빈 상태로 시작한다. 권역별 요청작업은 서버가 기록한 KST 요청일의 월로 자동 분류하며 목록 API의 `?month=YYYY-MM`으로 조회한다. 운영 인력과 공통데이터(리전·서비스·인력)는 월 구분 없이 하나이며, 모든 화면에서 같은 원본 테이블을 참조한다. 주 선택·확정과 K8s 기능은 제공하지 않는다.
- 운영 변경 이력(`ops_change_logs.period_month`)에 월별 데이터의 기준 월을 남긴다. 공통데이터·운영 인력 변경은 비워 둔다.
- 권한은 관리자(`is_staff`)·팀장(`team_lead` 그룹)·그룹장(`group_lead_KR`·`group_lead_EU`·`group_lead_NA` 그룹, 관리 국가)·옵저버(`observer` 그룹, 읽기 전용)·사용자다. 운영 인력은 운영 인력 탭에서 직접 편집하며 관리자·팀장은 전체 국가, 그룹장은 관리 국가, 연결된 일반 사용자는 본인 일반 정보만 편집한다. 행별 `can_edit`와 `/api/me/`의 `staff_edit_countries`는 서버가 계산한다. 계정 API는 `role`과 그룹장의 `managed_countries`를 받으며 관리자·팀장이 회원정보 메뉴에서 본인보다 하위 역할만 관리한다. 소속사·근무지는 선택지를 사용하고 관리자·팀장만 추가·삭제하며 기존 인력 값은 선택지 삭제로 바꾸지 않는다. `/api/me/`는 조회만 제공한다.
- DB 탭 밖의 운영 화면은 관리자도 조회 전용이다(운영 인력 탭 편집은 위 예외). 운영 데이터·댓글·공통데이터 저장 API는 `/api/db-admin/`에서만 제공하며 개발 우회 여부와 무관하게 실제 활성 관리자만 쓸 수 있다.
- 예외: 권역별 요청작업은 `/api/operations/regional_requests/`에서 관리자·사용자가 작성한다. 요청 리전은 KR·NA·EU 중 하나이며, 요청 내용은 작성자와 관리자만 수정한다. 상태·담당 권역(KR·NA·EU)·자유 입력 담당자는 관리자와 사용자가 수정한다. 상태는 사용자가 입력 화면에서 명시적으로 선택한 경우에만 바꾸고 다른 동작으로 자동 전환하지 않는다. 담당자는 빈 값으로 미지정할 수 있고 삭제는 관리자만 가능하며 옵저버는 모든 쓰기가 403이다. 게시판 API는 기존 작성자·관리자 규칙을 따른다.
- 수정·할당·삭제 가능 여부는 서버가 `can_edit_content`·`can_update_assignment`·`can_delete`로 계산하고 화면은 이 값으로만 버튼을 표시한다. 작성자 아이디는 응답에 노출하지 않는다.
- 초대 링크 발급·취소(`/api/invites/`)는 관리자·사용자만 하고 옵저버는 403이다. 옵저버 화면에는 "팀원 초대" 메뉴를 표시하지 않는다.
- 로그인·로그아웃·로그인 실패·등록·수정·삭제는 `user_activity_logs`(core.UserActivity)에 남긴다. 수정은 항목별 이전 값·새 값(`changes`), 삭제는 지운 원본 전체(댓글 포함)를 `before_data`에 보관한다. 관리자만 사용자·권한 > 이력에서 조회하며, 로그인 상태는 만료되지 않은 DB 세션 수로 표시한다.
- 변경 이력 탭·API(`/api/operations/logs/`)와 현재값 응답의 `logs`는 활성 로그인 사용자에게 권한별로 제공한다. 사용자·옵저버는 본인이 변경한 이력, 그룹장은 관리 국가의 변경 항목만, 팀장·관리자는 전체를 조회한다. 탭은 최근 변경순, 항목은 최신순이며 리전·사용자·기준 월로 필터링한다. 복구는 실제 활성 관리자만 `/api/db-admin/logs/{id}/restore-preview/`와 `restore/`에서 두 번 확인 후 실행한다. 해당 이력에서 바뀐 행만 되돌리고, 이후 수정·연결 데이터 충돌·중복 복구는 거절한다. 복구 작업도 변경·행동 이력에 기록한다. 복구 원본 없는 과거 이력은 조회만 한다.
- DB 관리 탭은 본문 위 가로 메뉴로 공통데이터·기능별 설정·DB 원본을 구분한다. 공통데이터 안에서 리전·서비스·인력을 하위 탭으로 관리하고, 기능별 입력 화면에 공통데이터 목록을 반복 배치하지 않는다. DB 원본은 각 앱 `feature.py`의 `tables` 허용 목록만 조회하며 행·열·구조 모두 읽기 전용이다. 원본 조회 API에 쓰기 기능을 추가하지 않는다.
- 행 복사는 관리자 DB 편집 초안에서 제공한다. 복사된 PK·시각·비밀번호·기존 댓글을 저장하지 않고 새 코드나 고유 조합을 확인한 뒤 저장한다.
- 리전과 인력은 자동 생성 숫자 PK로 연결하고 이름으로 선택한다. 리전코드·인력코드는 쓰지 않으며 내부 ID는 DB 원본에서만 표시한다. 인력은 이름만 입력하고 동명이인을 허용한다. 서비스 코드와 국가 코드는 별개로 유지한다.
- 공통데이터(리전·서비스·인력)의 사용 상태 열 `is_active`는 제공하지 않는다. 로그인 계정의 `is_active`와 업무 진행 상태는 별개로 유지한다. 리전 표시 순서 열은 쓰지 않으며 기본 목록은 리전 이름순이다.
- 인프라 수량은 Host·VM·Compute Rack(`compute_rack_count`)·Storage Rack(`storage_count`)이며 고유 조합은 기준 월·리전·서비스(`unique_monthly_resource_service`)다. 운영 작업은 기준 월·리전·작업유형·범위(`unique_monthly_work_scope`)다. 상단 세 번째 카드는 Rack(Compute + Storage 합계)이고 요약 그래프는 수량 내림차순이다. 환경 열은 없다.
- 리전의 `global_region`(전체 리전)은 `country_code`에서 DB가 계산하는 생성 열이다(KR·CN=내수, EU=유럽, NA=북미, 그 외 NULL). 아직 화면·API에서 사용하지 않는다.
- 운영 인력은 국가(KR·EU·NA)·성명·직책·소속사·업무·근무지·PC IP(`pc_ip`)·오토에버 계정(`autoever_account`)·Z 계정(`z_account`)을 편집하며 리전 대신 국가 코드를 저장한다. 직책·소속사는 비워 둘 수 있다. 운영 인력 탭 편집의 성명은 이름으로 입력하고 새 행은 인력 공통데이터를 새로 만든다.

## 화면 디자인과 개인 설정

- 새 화면과 기능은 [공통 디자인 규칙](.codex/design-system.md)을 따른다. 화이트 모드와 자체 제공 Inter(영문·숫자)·Pretendard(한글)를 사용하고 `shared/components`·`shared/styles`의 공통 컴포넌트·색상·간격·표 규칙을 재사용한다.
- 홈은 기능 카드, 상세 기능은 좌측 사이드바로 이동한다. 사이드바는 홈 다음 리포트 순서이며 변경 이력은 공통 기능 메뉴, DB 관리는 관리자 메뉴에 둔다.
- 탭 숨김·복원과 사이드바 접기는 개인 화면 설정이다. 로그인 사용자는 계정별, 개발 비로그인 사용자는 서명 쿠키로 구분한 브라우저별로 DB에 저장한다. `/api/navigation/preferences/`는 본인의 표시 설정만 수정하는 예외이며 업무 데이터 권한을 바꾸지 않는다. 홈·DB 관리는 숨길 수 없다.
