# 두 사람이 기능별로 나눠 개발하기

[문서 목록](../README.md) · [폴더 구조와 기능 추가 방법](../02-development/structure.md) · [평소 Git 순서](git_collaboration_guide.md)

**두 사람이 서로 다른 기능 탭을 동시에 고치고, 합칠 때 충돌을 줄이고 싶을 때** 읽습니다.

## 1. 기본 원칙: 기능 폴더 단위로 나눕니다

기능 하나는 화면과 서버에 같은 이름의 폴더가 하나씩 있습니다.

```text
frontend/src/features/<기능>/     화면
backend/features/<기능>/          서버 (모델·마이그레이션·API·테스트)
```

- 작업을 나눌 때 **기능 폴더 단위로 담당**을 정합니다. 예: A는 `resources`·`work`, B는 `regional_requests`·`staff`.
- 내 담당 기능 폴더 안의 파일은 상대와 상의 없이 고칩니다. 상대 폴더의 파일은 고치지 않습니다.
- 새 기능은 새 폴더를 만들기만 하면 메뉴·홈·탭 관리·리포트·DB 관리·API 주소에 자동으로 연결됩니다. 공통 목록 파일이 없으므로 두 사람이 동시에 새 기능을 추가해도 같은 줄을 고치지 않습니다.
- 기능 폴더는 다른 기능 폴더를 import하지 않습니다. 그래서 한 사람의 변경이 상대 기능을 깨뜨리지 않습니다.

## 2. 함께 쓰는 파일은 먼저 알리고 작게 고칩니다

아래 파일·폴더는 두 사람 모두에게 영향을 줍니다. 고쳐야 하면 작업 전에 상대에게 알리고, 기능 작업과 섞지 않은 **작은 PR로 먼저** 합칩니다.

| 함께 쓰는 곳 | 예 |
| --- | --- |
| `frontend/src/app/` | 사이드바·상단바·홈 레이아웃 |
| `frontend/src/shared/` | 공통 부품(DataTable, Modal), `feature.ts` 형식, 공통 스타일 |
| `backend/core/`, `backend/reporting/`, `backend/database_admin/`, `backend/invites/` | 로그인·권한, 공통데이터(리전·서비스·인력), DB 관리 |
| `backend/config/`, `compose.yaml`, `compose.prod.yaml`, `.github/` | 설정·실행·CI |
| `AGENTS.md`, `.codex/`, `docs/` | 지침·문서 (자기 기능 설명은 해당 문서 절만 고칩니다) |

공통 파일을 고친 PR이 먼저 합쳐지면 상대는 [상대 PR이 먼저 합쳐졌을 때](git-scenarios.md#상황-1-상대-pr이-합쳐졌는데-나는-아직-개발-중이에요)처럼 자기 브랜치에 main을 합친 뒤 계속합니다.

## 3. DB 구조 변경(마이그레이션)

- 테이블 구조 변경은 **그 기능 앱의 마이그레이션**으로만 합니다. 앱마다 번호가 따로 붙으므로 A가 `resources/0002`, B가 `regional_requests/0002`를 만들어도 충돌하지 않습니다.
- `db/init/*.sql`은 신규 설치용 고정 기준선입니다. 고치지 않습니다.
- 공통 앱(`reporting`의 리전·서비스·인력, `core`)의 마이그레이션은 한 번에 한 사람만 만듭니다. 두 사람이 같은 앱에 마이그레이션을 만들면 같은 번호(예: `0019`)가 둘 생겨 서버가 시작하지 못합니다.
- 같은 앱에 마이그레이션이 둘 생겼다면(자동 검사 `test_no_pending_migrations` 실패) 나중에 합치는 사람이 자기 브랜치에서 아래 명령으로 합치기 마이그레이션을 만들고 커밋합니다.

  ```bash
  docker compose run --rm --no-deps -v "$PWD/backend:/app" --entrypoint python backend manage.py makemigrations --merge
  ```

- 컬럼·테이블을 지우거나 값을 옮기는 마이그레이션은 PR 설명에 적고, 운영 배포 전에 [스냅샷](../02-development/ec2-deployment.md)을 만듭니다.

## 4. 합치기 전 확인

PR을 올리기 전에 내 브랜치에 최신 main을 합치고 다음을 확인합니다.

```bash
docker compose down
docker compose up --build -d
docker compose exec backend pytest
```

- `up --build`가 성공하면 화면 TypeScript 검사도 통과한 것입니다.
- `pytest`는 마이그레이션 누락·충돌까지 검사합니다. GitHub의 자동 검사(Compose build)도 같은 테스트를 실행합니다. [자동 검사 보는 방법](github-actions.md)
- 내 기능뿐 아니라 상대 기능 탭도 한 번 열어 봅니다.

## 5. 충돌이 났다면

기능 폴더를 나눠 쓰면 충돌은 대부분 공통 파일에서만 생깁니다. 공통 파일 충돌은 두 사람의 변경을 모두 살리는 방향으로 고칩니다. 절차는 [충돌 해결](git-conflicts.md)을 따릅니다.

| 자주 생기는 경우 | 처리 |
| --- | --- |
| 둘 다 `shared/` 부품을 고침 | 두 변경을 모두 반영하고 두 기능 화면을 확인 |
| 같은 공통 앱에 마이그레이션 두 개 | 위 3절의 `makemigrations --merge` |
| 같은 `order` 값 | 오류는 아니며 폴더 이름순으로 표시됨. 원하는 순서가 있으면 한쪽 값을 바꿈 |
| 같은 기능 ID·폴더 이름 | 한쪽 이름을 바꿈. ID는 주소·API·DB 앱 이름에 쓰이므로 합치기 전에 정함 |
