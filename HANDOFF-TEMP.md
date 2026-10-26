# [임시] 작업 인계 문서 — main 병합 전 반드시 삭제

> ⚠️ 이 파일은 다른 PC에서 `feat/prototype-harness` 작업을 이어가기 위한 **임시 파일**이다.
> **`main`으로 PR/merge 하기 전에 이 파일(`HANDOFF-TEMP.md`)을 삭제하는 커밋을 먼저 만든다.**
> 브랜치에 작업을 올릴 때마다 이 파일을 최신 상태로 갱신해 같은 push에 포함한다.

---

## 사용자 작업 방침 (반드시 지킴)

- **`feat/prototype-harness` 브랜치 안에서만 작업한다.** main은 코워커 승인 없이는 머지할 수 없도록 보호되어 있다.
  **main으로의 PR은 사용자가 명시적으로 요청할 때만** 만든다. 그 전에는 이 파일도 삭제하지 않는다.
- 브랜치에 push할 때는 **항상 이 파일을 갱신**하고, 최종 보고에 **다음 에이전트에게 줄 프롬프트**를 함께 적는다.
- 응답·문서·보고는 한국어 존댓말, 코드 식별자·명령은 원문 유지.
- 승인이 필요한 결정도 묻지 말고 권장안으로 진행하고, 끝날 때 결정 사항을 목록으로 보고한다(단, 새 기능의 범위처럼 사용자만 정할 수 있는 것은 확인한다).

## 보호 규칙

- 수정 금지: `AGENTS.md`, `README.md`, `.codex/**`, `.github/**`, `compose.yaml`, `.gitignore`, `db/init/**`,
  `backend/Dockerfile`, `backend/manage.py`, `frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/vite.config.ts`,
  `frontend/tsconfig.json`, `frontend/package.json`.
- 예외: `docs/**`는 기능·API·DB·설정이 실제로 바뀔 때만, `.env.example`은 새 환경변수 추가 시만,
  `backend/config/**`는 기능상 꼭 필요할 때만 최소 수정.
- 쓰기 허용: `backend/core/**`, `frontend/src/**`, 신규 테스트, 이 파일.
- main 직접 push·force push 금지. `.env`·비밀번호·토큰을 Git/문서/보고에 넣지 않는다.
- 로컬 전용 파일(`compose.override.yaml`, `backend/media/` 등)은 `.gitignore`가 아니라 `.git/info/exclude`에 넣는다.

---

## 현재 상태 (2026-10-27 기준)

| 커밋 | 내용 | 검증 |
|---|---|---|
| `2f4ebc3` | 슬라이스1: 세션 로그인 + 회원정보(`/api/me/`) | pytest 9/9, API 흐름, 브라우저 PASS |
| `ff28c28` | CSRF 신뢰 출처를 `DJANGO_CSRF_TRUSTED_ORIGINS` 환경변수로 설정 가능 | 브라우저 로그인 PASS |
| `1238a14` | 게시판(글 CRUD·댓글·이미지 업로드) + `docs/02-development/api.md`, `database.md` | pytest 19/19, B1~B15 PASS |
| `08b642c` | UI: 다크 테마 + 사이드바(게시판/대시보드/유저관리), `PlaceholderPage.tsx` | 아래 `3599b02`에서 독립 검증 완료 |
| `3599b02` | 08b642c 검증 FAIL 수정(아래 참고) | 기능 F01~F21 PASS, 7개 화면 × 4개 폭 PASS, `npm run build` 통과 |

슬라이스2(패널 대시보드)·유저관리 기능은 미착수(준비 중 화면만 있음).

### `3599b02`에서 고친 것 (`frontend/src`만)

- 900px 이하: `.nav-item`의 기본 `width: 100%` 때문에 탭이 한 줄씩 차지해 대시보드·유저관리 탭이 화면 밖으로 밀림 → `flex: 1 1 0; width: auto`.
- 띄어쓰기 없는 긴 제목·작성자명: 상세 제목/메타 줄, 댓글 작성자, 프로필 값은 `overflow-wrap: anywhere`, 작성자 배지·카드 하단 작성자는 말줄임.
- 로그아웃 아이콘 `⏻`가 Windows Chrome에서 빈 네모 → `🚪`.
- `BoardListPage`·`PostDetailPage`: 화면을 떠난 뒤 도착한 첫 로드 응답은 무시(`isActive`). 로그아웃 직후 도착한 403 때문에 정상 로그아웃인데 "세션이 만료되었습니다"가 뜨던 문제.

### 지난 검증 방법 (2026-10-26, Docker 없는 Windows PC)

그 PC에는 Docker·WSL이 없어 **레포 밖** 폴더에 대체 스택을 만들어 검증했다. 이 스택과 스크립트·스크린샷은 **그 PC에만 있고 이 브랜치에는 없다.**

- DB: PostgreSQL 17 Windows 바이너리(npm `@embedded-postgres/windows-x64`), 127.0.0.1:5432, `db/init/01-test.sql` 적용.
- backend: Python 3.13 venv(`uv`) + `manage.py runserver`. 설정은 레포 밖 모듈에서 `from config.settings import *` 후 DB `HOST`만 `127.0.0.1`로 바꿈(레포 설정 무수정).
- frontend: `npm run build` 결과 `dist`를 Node 프록시로 서빙. `nginx.conf`처럼 `/api/`·`/backend/`를 Django로 넘기고 1MB 초과 본문은 413.
- 브라우저: `playwright-core`를 직접 `require`, `channel: 'chrome'`, headless.
  - 기능 스크립트: 로그인 오류 문구 → 글 CRUD → 12.9MB PNG 업로드(자동 축소 확인) → 실제 클립보드 Ctrl+V → 댓글 CRUD → 다른 사용자 글 버튼 미노출·API 403 → 탭 전환 → 프로필 → 로그아웃 → 늦은 403 회귀(목록 요청을 `page.route`로 붙잡았다가 로그아웃 후 놓아줌).
  - 화면 스크립트: 각 화면·폭에서 `document.scrollWidth`, 요소별 `scrollWidth > clientWidth`(overflow visible = 넘침, hidden이고 말줄임 아님 = 잘림), flex/grid 형제 요소 사각형 겹침, Tab 이동 시 outline/box-shadow 유무를 측정하고 전체 페이지·포커스 스크린샷을 저장.
  - 다른 사용자 데이터: `manage.py shell -c "exec(open(..., encoding='utf-8').read())"`로 긴 아이디 사용자와 긴 제목·긴 단어 글·댓글을 ORM으로 생성(Windows에서 `shell < 파일`은 한글이 깨짐).

---

## 남은 작업

1. **Docker가 있는 PC에서 NOT_VERIFIED 2건 확인** (이번 PC에 Docker가 있으면 먼저 수행)
   - `docker compose exec backend pytest --ds=config.settings core/tests` → **19 passed** 기대.
     (`pytest.ini`가 없어 `--ds` 없이 실행하면 수집 단계에서 `ImproperlyConfigured`.)
   - 실제 nginx에서 1MB 넘는 이미지(예: 5MB 이상 PNG)를 화면으로 올렸을 때 자동 축소돼 201이 나는지.
   - 간단한 화면 확인: 768px·390px에서 사이드바 탭 3개가 모두 보이는지, 로그아웃 아이콘이 깨지지 않는지.
   - 결과는 PASS/FAIL/NOT_VERIFIED로 보고. FAIL이면 고치고 재검증.
2. **다음 기능은 사용자에게 확인 후 착수**: 슬라이스2(패널 대시보드)와 유저관리는 범위·완료 조건·API가 아직 합의되지 않았다(AGENTS.md "아직 정해진 것으로 취급하지 않는다" 항목).
3. **main PR은 사용자가 요청할 때만**. 요청을 받으면: 이 파일 삭제 커밋 → push → `gh pr create`(본문: 변경 요약, 검증 결과, settings.py 변경 사유, 아래 합의 항목).

## 로컬 실행 방법 (Docker)

```
git switch feat/prototype-harness
copy .env.example .env      # .env가 없을 때만. 기존 .env는 덮어쓰지 않는다
docker compose up --build -d
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_demo_user   # 데모 계정 demo 생성
docker compose exec backend pytest --ds=config.settings core/tests
```

접속: `http://localhost:8080` (데모 계정 `demo`, 비밀번호는 `seed_demo_user` 명령 코드 참고)

### Windows에서 8080 포트가 막힐 때 (Hyper-V/WinNAT 예약 범위)

`netsh interface ipv4 show excludedportrange protocol=tcp`로 8080이 예약 범위에 들어 있으면,
레포 루트에 **로컬 전용** `compose.override.yaml`을 만들고 `.git/info/exclude`에 추가한다(커밋 금지, `compose.yaml`은 수정 금지).

```yaml
services:
  frontend:
    ports: !override
      - "127.0.0.1:18080:80"
  backend:
    environment:
      DJANGO_CSRF_TRUSTED_ORIGINS: "http://localhost:18080,http://127.0.0.1:18080"
```

`!override`가 없으면 포트 목록이 합쳐져 8080 충돌이 그대로 남는다. 이 경우 접속 주소는 `http://localhost:18080`.

### Docker가 없는 PC

위 "지난 검증 방법"처럼 레포 밖에 대체 스택을 만든다. WSL·Docker 설치는 시스템 설정 변경이라 사용자 확인 없이 하지 않는다.

## 알려진 사항

- 첫 화면 콘솔의 403 1건은 로그인 여부 확인 요청이라 정상. 잘못된 비밀번호 401, 잘못된 이메일 저장 400도 의도된 응답.
- Nginx 기본 업로드 한도 1MB(`nginx.conf` 보호 대상) → 화면에서 이미지를 900KB 이하(긴 변 최대 1600px JPEG)로 자동 축소해 업로드. 서버 한도는 5MB.
- 업로드 이미지는 백엔드 컨테이너 내부에 저장되어 재빌드 시 사라짐(볼륨 추가는 `compose.yaml` 수정이 필요해 보류). Docker 없이 `runserver`로 돌리면 `backend/media/`가 생기므로 `.git/info/exclude`에 넣는다.
- **Windows에서 pytest를 직접 돌리면 `test_attach_images_and_serve` 1건 실패**: 테스트가 `FileResponse`를 닫지 않아 Windows가 파일 삭제를 막음(`WinError 32`). Linux 컨테이너에서는 통과하고, 제품 결함 아님. 테스트 수정 여부는 "테스트 도구" 합의 때 함께 정한다.
- PowerShell로 한글 JSON을 PATCH하면 400이 날 수 있음(클라이언트 charset 문제). 브라우저·pytest에서는 정상.
- 커밋 메시지는 파일(`git commit -F`)로 UTF-8로 넘긴다. PowerShell 인자로 넘기면 한글이 깨질 수 있다(`4167724` 메시지가 깨진 사례).
- Playwright 설치 도구가 `.gitignore`에 `.playwright-cli/`를 자동 추가할 수 있음 → 되돌리고 `.git/info/exclude`에 넣는다.
- git 신원이 없으면 커밋이 거부됨 → 레포 로컬 `git config user.name/user.email`만 설정(전역 변경 금지).

## PR 리뷰에서 코워커와 합의할 항목 (AGENTS.md 미합의 사항)

- DB 변경 관리 방식: 현재 Django 모델·마이그레이션으로 "제안" 상태.
- 인증·권한 정책: 세션 인증 + 글·댓글은 작성자만 수정·삭제.
- `backend/config/settings.py` 변경(auth/sessions/contenttypes 앱, 미들웨어, SessionAuthentication, MEDIA 설정, `DJANGO_CSRF_TRUSTED_ORIGINS`) 사유.
- 테스트 도구: `pytest`, `pytest-django`, 이미지 검사용 `Pillow==11.3.0`을 `requirements.txt`에 추가. `pytest.ini`(`DJANGO_SETTINGS_MODULE`) 추가 여부, Windows 파일 잠금 테스트 처리.
- 화면 검증 자동화(Playwright 스크립트)를 레포에 둘지 여부.

---

## 다음 에이전트에게 줄 프롬프트

아래를 그대로 전달한다.

```
PPJINHONG/coc_dashboard 레포의 feat/prototype-harness 브랜치에서 작업을 이어 주세요.
응답·문서·보고는 한국어 존댓말로 하고, 코드 식별자·명령은 원문 그대로 둡니다.

1. 브랜치 가져오기
   - 레포가 없으면: git clone https://github.com/PPJINHONG/coc_dashboard.git → cd coc_dashboard → git switch feat/prototype-harness
   - 레포가 있으면: git status(커밋 안 한 변경이 있으면 멈추고 보고) → git fetch origin → git switch feat/prototype-harness → git pull origin feat/prototype-harness
   - git log --oneline -3 에 3599b02(fix(ui))와 그 뒤의 인계 문서 갱신 커밋이 보이는지 확인합니다.

2. AGENTS.md, README.md, docs/README.md, 레포 루트의 HANDOFF-TEMP.md를 읽고, HANDOFF-TEMP.md의
   "사용자 작업 방침", "보호 규칙", "남은 작업"을 기준으로 진행합니다.

3. 핵심 방침
   - 이 브랜치 안에서만 작업합니다. main으로 PR은 제가 요청할 때만 만들고, 그 전에는 HANDOFF-TEMP.md를 삭제하지 않습니다.
   - 브랜치에 push할 때마다 HANDOFF-TEMP.md를 최신 상태로 갱신해 함께 올리고, 최종 보고에 다음 에이전트에게 줄 프롬프트를 적어 주세요.
   - 승인이 필요한 결정은 권장안으로 진행하고 끝에 결정 목록으로 보고합니다. 단, 새 기능(대시보드·유저관리)의 범위는 저에게 먼저 확인합니다.
   - .env·비밀번호·토큰은 Git·문서·보고에 넣지 않습니다. main 직접 push·force push는 하지 않습니다.

4. 이번 할 일: HANDOFF-TEMP.md "남은 작업" 1번(Docker에서 pytest 19 passed, 실제 nginx 1MB 한도에서 이미지 자동 축소,
   768/390px 사이드바 탭·로그아웃 아이콘 확인)을 PASS/FAIL/NOT_VERIFIED로 검증하고, FAIL이면 고쳐서 재검증합니다.
   Docker가 없으면 그 사실을 보고하고, 다음으로 무엇을 할지 저에게 물어봐 주세요.

5. 최종 보고: 검증 결과표, 커밋·push 내역, 권장안으로 결정한 사항 목록, 다음 에이전트용 프롬프트.
```
