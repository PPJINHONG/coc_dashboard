# [임시] 작업 인계 프롬프트 — main 병합 전 반드시 삭제

> ⚠️ 이 파일은 다른 PC에서 `feat/prototype-harness` 작업을 이어가기 위한 **임시 파일**이다.
> **`main`으로 PR/merge 하기 전에 이 파일(`HANDOFF-TEMP.md`)을 삭제하는 커밋을 먼저 만든다.**
> 에이전트는 이 파일을 읽고 작업을 이어가되, PR을 만들 때 이 파일이 diff에 남아 있으면 삭제부터 한다.

---

## 에이전트에게 주는 프롬프트

아래를 그대로 에이전트에 전달한다.

```
coc_dashboard 레포의 feat/prototype-harness 브랜치에서 작업을 이어간다.
먼저 AGENTS.md, README.md, docs/README.md와 이 HANDOFF-TEMP.md를 읽는다.
응답·문서·보고는 한국어 존댓말, 코드 식별자·명령은 원문 유지.
승인이 필요한 결정도 묻지 말고 권장안으로 진행하고, 끝날 때 결정 사항을 목록으로 보고한다.

[현재 목표]
커밋 08b642c의 UI 변경(다크 테마 + 왼쪽 사이드바)은 빌드만 통과했고 기능·화면 독립 검증이 안 됐다.
아래 "남은 작업"을 끝까지 수행하고, UI가 깨지거나 기능이 동작하지 않는 곳이 없게 마무리한다.

[보호 규칙 — 수정 금지]
AGENTS.md, README.md, docs/**(단 기능·API·DB·설정이 실제로 바뀔 때 대응 문서 갱신은 허용),
.codex/**, .github/**, compose.yaml, .env.example(새 환경변수 추가 시만 예외), .gitignore,
backend/Dockerfile, backend/config/**(기능상 필수일 때만 최소 수정), backend/manage.py,
frontend/Dockerfile, frontend/nginx.conf, frontend/vite.config.ts, frontend/tsconfig.json,
frontend/package.json, db/init/**.
쓰기 허용: backend/core/**, frontend/src/**, 신규 테스트.
main 직접 push 금지. .env·비밀값을 Git/문서/보고에 넣지 않는다.
```

---

## 현재 상태 (2026-10-26 기준)

| 커밋 | 내용 | 검증 |
|---|---|---|
| `2f4ebc3` | 슬라이스1: 세션 로그인 + 회원정보(`/api/me/`) | pytest 9/9, API 흐름, 브라우저 PASS |
| `ff28c28` | CSRF 신뢰 출처를 `DJANGO_CSRF_TRUSTED_ORIGINS` 환경변수로 설정 가능 | 브라우저 로그인 PASS |
| `1238a14` | 게시판(글 CRUD·댓글·이미지 업로드) + `docs/02-development/api.md`, `database.md` | pytest 19/19, B1~B15 PASS |
| `08b642c` | UI: 다크 테마 + 사이드바(게시판/대시보드/유저관리), `PlaceholderPage.tsx` | **빌드만 통과, 독립 검증 미실시(NOT_VERIFIED)** |

슬라이스2(패널 대시보드)·유저관리 기능은 미착수(준비 중 화면만 있음).

## 남은 작업

1. **UI 독립 검증** (서브에이전트는 장시간 작업 중 끊긴 이력이 있으니 메인 세션에서 직접 실행 권장)
   - 기능: 로그인 → 글쓰기·수정·삭제 → 댓글 작성·수정·삭제 → 이미지 업로드·자동 축소·Ctrl+V 붙여넣기 → 오류 문구(빈 제목 등) → 다른 사람 글에 수정/삭제 버튼 미노출 → 사이드바 탭 전환 → 프로필 저장 → 로그아웃 → 컨테이너 안 pytest 재실행
   - 화면: 로그인·게시판 목록·상세·에디터·프로필·대시보드·유저관리 7개 화면 × 1440/1024/768/390px
     - 가로 스크롤 발생 여부, 요소 넘침·겹침·잘림, 긴 제목·띄어쓰기 없는 긴 단어 처리, 키보드 포커스 표시
   - 판정은 PASS / FAIL / NOT_VERIFIED. 결과·스크린샷은 세션 임시 폴더가 아니라 지워지지 않는 위치에 저장(레포에는 커밋하지 않음).
2. FAIL 항목 수정 → 재검증 반복. 전부 PASS면 `frontend/src`만 커밋.
3. **이 파일(`HANDOFF-TEMP.md`) 삭제 커밋** 후 PR 생성: `feat/prototype-harness` → `main`.
   PR 본문에 변경 요약·검증 결과·settings 변경 사유·아래 미합의 항목을 적고 코워커 리뷰를 받는다.

## 로컬 실행 방법

```
git switch feat/prototype-harness
copy .env.example .env      # .env가 없을 때만. 기존 .env는 덮어쓰지 않는다
docker compose up --build -d
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_demo_user   # 데모 계정 demo 생성
docker compose exec backend pytest
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

## 알려진 사항

- 첫 화면 콘솔의 403 1건은 로그인 여부 확인 요청이라 정상.
- Nginx 기본 업로드 한도 1MB(`nginx.conf` 보호 대상) → 화면에서 이미지를 900KB 이하로 자동 축소해 업로드. 서버 한도는 5MB.
- 업로드 이미지는 백엔드 컨테이너 내부에 저장되어 재빌드 시 사라짐(볼륨 추가는 `compose.yaml` 수정이 필요해 보류).
- PowerShell로 한글 JSON을 PATCH하면 400이 날 수 있음(클라이언트 charset 문제). 브라우저·pytest에서는 정상.
- Playwright 설치 도구가 `.gitignore`에 `.playwright-cli/`를 자동 추가할 수 있음 → 되돌리고 `.git/info/exclude`에 넣는다.
- 스크린샷 자동화는 `playwright-core`를 직접 `require`하고 `channel: 'chrome'`(시스템 Chrome)으로 실행하는 방식이 가장 안정적이었다.
- git 신원이 없으면 커밋이 거부됨 → 레포 로컬 `git config user.name/user.email`만 설정(전역 변경 금지).

## PR 리뷰에서 코워커와 합의할 항목 (AGENTS.md 미합의 사항)

- DB 변경 관리 방식: 현재 Django 모델·마이그레이션으로 "제안" 상태.
- 인증·권한 정책: 세션 인증 + 글·댓글은 작성자만 수정·삭제.
- `backend/config/settings.py` 변경(auth/sessions/contenttypes 앱, 미들웨어, SessionAuthentication, MEDIA 설정, `DJANGO_CSRF_TRUSTED_ORIGINS`) 사유.
- 테스트 도구: `pytest`, `pytest-django`, 이미지 검사용 `Pillow==11.3.0`을 `requirements.txt`에 추가.
