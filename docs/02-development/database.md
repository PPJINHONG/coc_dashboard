# 데이터 확인과 DB 구조 변경

[문서 목록](../README.md) · [운영 데이터 설계](operations.md)

최신 운영 데이터는 PostgreSQL DB 하나에 저장합니다. 테이블별 역할은 [운영 데이터 설계](operations.md)를 봅니다.

## 1. 웹에서 확인

- 일반 기능 탭: 인프라 자원·운영 작업은 기준 월별, 운영 인력은 현재값 조회. 권역별 요청작업은 KST 요청일 기준 월별로 조회하고 관리자·사용자가 등록합니다. 월 구조는 [운영 데이터 설계](operations.md#기준-월).
- 관리자 **DB 관리 → 기능별 설정**: 업무 데이터와 사용자·권한 관리.
- 관리자 **DB 관리 → DB 원본**: 같은 원본 테이블을 읽기 전용으로 확인.
- `http://localhost:8080/api/operations/current/?month=YYYY-MM`: 기준 월 데이터와 합계(로그인 필요, 월 생략 시 이번 달).

공통데이터와 수량은 자동으로 넣지 않습니다. 새 설치에서는 관리자가 DB 관리 → 공통데이터에서 리전·서비스·인력을 먼저 등록합니다.

## 2. 직접 DB 접속

| 항목 | 값 |
| --- | --- |
| Host | `127.0.0.1` |
| Port | `.env`의 `POSTGRES_PORT` (기본 `5433`) |
| Database / User / Password | `.env`의 `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` |
| Schema | `public` |
| SSL | 끄기 |

웹 로그인 계정과 DB 접속 계정은 별개입니다. 컨테이너끼리는 `db:5432`를 씁니다.

```bash
docker compose port db 5432
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

연결이 안 되면 `docker compose ps`로 DB 상태와 포트를 확인합니다. `.env`의 비밀번호를 바꿔도 이미 만든 DB에는 적용되지 않습니다. 연결 문제를 해결하려고 볼륨을 지우지 않습니다.

## 3. DB 구조 변경 규칙

테이블 구조는 **Django 마이그레이션으로만** 바꿉니다. backend가 켜질 때 `migrate --fake-initial --noinput`이 새 마이그레이션을 자동으로 적용합니다.

| 바꾸는 테이블 | 마이그레이션을 만드는 앱 |
| --- | --- |
| 인프라 자원 `infra_resources` | `features/resources` |
| 운영 인력 배치 `ops_staff_assignments` | `features/staff` |
| 운영 작업 `ops_work_summaries` | `features/work` |
| 권역별 요청작업·이미지 `ops_regional_requests`, `ops_regional_request_images` | `features/regional_requests` |
| 게시판 `core_post` 등, 대시보드 `core_dashboardpanel` | `features/board`, `features/dashboard` |
| 리전·서비스·인력·변경 이력·탭 설정 | `reporting` (공통 앱, 한 번에 한 사람) |
| 행동 이력 `user_activity_logs` | `core` (공통 앱) |
| 초대 `auth_invites` | `invites` (공통 앱) |

마이그레이션 파일은 내 PC 폴더에 바로 만듭니다.

```bash
docker compose run --rm --no-deps -v "$PWD/backend:/app" --entrypoint python backend manage.py makemigrations <앱이름>
docker compose down
docker compose up --build -d
docker compose exec backend pytest
```

- 이미 배포한 마이그레이션 파일은 고치거나 지우지 않습니다. 기존 설치의 업그레이드에 필요합니다.
- 컬럼·테이블을 지우는 마이그레이션은 실행 전에 백업합니다. 로컬은 `docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > .artifacts/backups/<날짜>-<내용>.dump`(Git 제외 폴더), EC2는 AWS 스냅샷을 씁니다.
- 공통데이터·샘플 행을 마이그레이션이나 서버 시작 과정에서 넣지 않습니다.
- 두 브랜치가 같은 앱에 마이그레이션을 만들었다면 [협업 규칙](../03-collaboration/parallel-development.md#3-db-구조-변경마이그레이션)대로 `makemigrations --merge`로 합칩니다.

## 4. 신규 설치와 init SQL

`db/init/02-current-operations.sql`, `db/init/05-db-admin.sql`은 **빈 DB 볼륨으로 처음 시작할 때만** 실행되는 고정 기준선입니다(`reporting` 0017 시점 구조). 이후 변경은 위 마이그레이션이 이어서 적용하므로 init SQL은 **수정하지 않습니다.** 기존 볼륨에는 다시 실행되지 않습니다.

신규 설치 순서: init SQL로 기준선 테이블 생성 → backend 시작 → `--fake-initial`이 기준선에 이미 있는 초기 마이그레이션을 건너뛰고 나머지를 적용 → `admin`/`admin` 관리자 생성.
