# Git 2인 협업 실전 가이드

> **대상:** 두 명이 각자 기능 브랜치에서 개발하고, GitHub Pull Request(PR)로 `main`에 병합하는 프로젝트  
> **핵심 원칙:** **작업은 내 브랜치에서 → 변경사항 확인 → 커밋·푸시 → PR 리뷰 → `main` 병합**  
> 이 문서의 `ours` / `theirs` 설명은 **내 기능 브랜치에서 `git merge origin/main`을 실행하는 상황**을 기준으로 합니다.

---

# 0. 가장 먼저 보는 요약본 ⭐

## 상황 ① 새 기능 시작 → 커밋 → Push → PR

```bash
# 기존 작업이 정리된 상태에서 시작
git status
git switch main
git pull --ff-only origin main
git switch -c feature/login

# 코드 수정 및 저장 후
git status
git diff
git add .
git diff --cached
git commit -m "feat: 로그인 기능 구현"
git push -u origin feature/login
```

**GitHub에서:** `Pull requests` → `New pull request` → **base: `main`**, **compare: `feature/login`** → PR 생성 → 리뷰/승인 → `Squash and merge`.

> `feature/login`은 예시입니다. 실제 브랜치 이름을 사용하세요. `git add .` 전에 비밀키, `.env`, 임시 파일이 포함되지 않았는지 꼭 확인하세요.

## 상황 ② PR 생성 후 추가 코드 수정

```bash
# 같은 기능 브랜치에서 계속 작업
git add .
git commit -m "fix: 로그인 오류 수정"
git push
```

- **기존 PR에 자동 반영**됩니다. 새 PR을 만들 필요가 없습니다.
- 승인 이후 추가 Push한 경우 저장소 설정에 따라 **재승인**이 필요할 수 있습니다.

## 상황 ③ 개발 중 다른 사람이 `main`에 Merge함

```bash
# 현재 내 기능 브랜치에서
git status
# 작업 중인 변경이 있으면 먼저 안전하게 커밋(아래 설명 참고)
git add .
git commit -m "wip: 작업 중간 저장"

git fetch origin                                   # 최신 원격 정보만 가져오기
git log --oneline HEAD..origin/main                 # main에 새로 생긴 커밋
git diff --name-status HEAD...origin/main           # main 쪽에서 바뀐 파일
git diff HEAD...origin/main                         # main 쪽 변경 코드

git merge origin/main                              # 그제야 내 브랜치에 실제 반영
# 충돌 시: 아래 '충돌 해결' 절 확인

# Merge 완료 후
git status
# 실행/테스트 확인
git push
```

> **주의:** 위 `git add`/`commit`은 변경 파일이 있을 때만 실행합니다. `working tree clean`이면 생략하세요. `fetch`만 하면 작성 중인 내 파일은 바뀌지 않습니다.

## 상황 ④ 충돌 발생 시 초간단 명령표

| 원하는 결과 | 방법 | 주의점 |
|---|---|---|
| `main` 버전만 채택 | `git checkout --theirs app.py` → `git add app.py` | **파일 전체**를 main 버전으로 선택 |
| 내 브랜치 버전만 채택 | `git checkout --ours app.py` → `git add app.py` | **파일 전체**를 내 버전으로 선택 |
| main 코드 아래 내 코드도 남김 | `nano app.py` → 충돌 표시 삭제 및 두 코드 정렬 → `git add app.py` | **필요한 부분만** 수정 가능 |
| 충돌 중인 Merge 취소 | `git merge --abort` | Merge 시작 전 상태로 복원 시도 |
| 충돌 해결 완료 | `git status` → `git merge --continue` → 테스트 → `git push` | **모든** 충돌을 먼저 해결 |

> **중요:** `--ours`/`--theirs`는 **충돌난 몇 줄만** 고르는 명령이 **아닙니다**. 해당 **파일 전체**의 한쪽 버전을 선택하므로 다른 정상 변경도 버릴 수 있습니다. 여러 변경이 섞인 파일이라면 텍스트 편집기로 충돌 부분만 수정하세요.

## 상황 ⑤ 내 PR이 `main`에 Merge된 뒤 다음 작업

```bash
git status                            # 미완료 작업이 없는지 확인
git switch main
git pull --ff-only origin main
git switch -c feature/next-task       # 새 기능은 최신 main에서
```

---

# 1. Git 동작을 1분 만에 이해하기

```text
               GitHub 저장소
             origin/main (공용)
                    │
         ┌──────────┴──────────┐
         │                     │
  feature/login (나)    feature/dashboard (동료)
         │                     │
      commit                commit
         │                     │
       push                  push
         │                     │
        PR                    PR ── 승인/병합 ──▶ main 갱신
         │                                             │
         └── fetch로 새 정보 확인 ── merge로 내 브랜치에 반영
```

| 개념/명령 | 정확한 의미 | 지금 내 작업 파일이 변하나? |
|---|---|---|
| `git add` | 다음 커밋에 넣을 변경을 스테이징 | 보통 아니오 |
| `git commit` | 현재 브랜치에 변경 이력 기록 | 아니오 |
| `git push` | 현재 브랜치의 커밋을 GitHub에 업로드 | 아니오 |
| `git fetch origin` | GitHub 브랜치의 **최신 상태를 가져와서 `origin/main` 등의 추적 정보 갱신** | **아니오** |
| `git merge origin/main` | 원격 main의 변경을 **현재 브랜치에 병합** | **예** |
| `git pull` | 기본적으로 fetch 후 통합(merge/rebase 등 설정에 따라 다름) | **예, 가능** |
| PR 생성 | GitHub에서 병합을 요청 | `main`은 아직 그대로 |
| PR 승인(Approve) | 검토자가 병합에 동의 | `main`은 아직 그대로 |
| PR Merge | GitHub에서 `main`에 실제 반영 | 원격 `main` 변경 |

**특히 헷갈리는 두 가지:**

- `main`: **내 PC의 로컬 main**. `fetch`만으로 자동 갱신되는 것은 아닙니다.
- `origin/main`: 마지막 `fetch`로 확인한 **GitHub main의 원격 추적 상태**입니다.

따라서 내 기능 브랜치에서 동료의 최신 변경을 받으려면 **`git fetch origin` → 확인 → `git merge origin/main`**을 권장합니다.

---

# 2. Git 작업 흐름: 실제 협업 예시

## A와 B가 서로 다른 기능을 개발하는 경우

1. A는 `feature/login`에서 로그인 개발 중.
2. B는 `feature/dashboard`에서 대시보드 개발 중.
3. B가 먼저 PR을 승인받아 `main`에 Merge함.
4. **A의 작업 폴더는 저절로 변경되지 않음.**
5. A가 `git fetch origin` 실행 → **B의 변경 정보만 수신**.
6. A가 `git diff HEAD...origin/main` 실행 → **B가 main 쪽에 바꾼 코드 확인**.
7. A가 `git merge origin/main` 실행 → **B가 바꾼 코드가 A 브랜치에 실제로 합쳐짐**.
8. 필요하면 충돌 해결, 프로그램 실행/테스트, `git push`.
9. A도 PR을 리뷰받고 `main`에 Merge.

### 작업 도중 `main` 변경을 당장 가져와야 할까?

- **내용만 알고 싶을 때:** `git fetch origin`과 `git diff`만 실행. 내 파일에 영향 없음.
- **다른 사람이 수정한 공통 파일을 사용해야 할 때:** 내 변경을 커밋한 뒤 `git merge origin/main`.
- **PR 리뷰/병합 전:** 최신 main을 반영하고 테스트하는 것을 권장.

### 작업 중인 파일이 아직 커밋되지 않았다면?

먼저 `git status`를 확인합니다. 중요한 작업이라면 임시 커밋을 만들거나 `git stash`로 안전하게 저장한 뒤 Merge하세요. 이 가이드는 **커밋 → Merge** 흐름을 기준으로 합니다.

```bash
git status
# 변경 파일을 확인하고 필요한 것만 add
git add .
git commit -m "wip: 작업 중간 저장"
```

**실수 방지:** 현재 `working tree clean`이면 새 커밋을 만들 수 없으므로 `add`/`commit`은 생략합니다.

---

# 3. `git diff`에 무엇이 보이고, 무엇을 확인해야 할까?

```bash
git status
```

현재 브랜치, 수정/추가/삭제한 파일, 충돌 여부 확인.

```bash
git diff
```

**아직 `git add`하지 않은** 변경 내용 확인.

```bash
git diff --cached
```

**이미 `git add`한**, 이번 커밋에 들어갈 내용 확인.

```bash
git fetch origin
git log --oneline HEAD..origin/main
git diff --name-status HEAD...origin/main
git diff HEAD...origin/main
```

**main 쪽 변경 확인:** 위 세 점(`...`) diff는 내 브랜치와 `origin/main`의 **공통 조상부터 main까지**의 변경을 보여줍니다. 내 브랜치의 작업 파일 자체를 바꾸지 않습니다.

```bash
git diff --name-status origin/main...HEAD
git diff origin/main...HEAD
```

**PR에서 보여줄 내 브랜치 쪽 변경 미리보기:** main과 갈라진 공통 지점부터 내 브랜치까지의 변경을 확인합니다.

### 결과 읽는 법

| 표시 | 의미 |
|---|---|
| `+` | 추가된 줄 |
| `-` | 삭제된 줄 또는 바꾸기 전 줄 |
| `M` | 수정된 파일 |
| `A` | 새로 생성된 파일 |
| `D` | 삭제된 파일 |

예를 들어 변수 하나를 수정해도 Diff에는 보통 **옛 줄 하나 `-` / 새 줄 하나 `+`**로 나타납니다. **빨간 줄과 초록 줄은 단순 비교 결과이며, 충돌이라는 뜻이 아닙니다.**

### Merge를 막 끝낸 뒤, 내 파일에 실제로 무엇이 적용됐는지 보고 싶다면

```bash
git diff --name-status ORIG_HEAD HEAD
git diff ORIG_HEAD HEAD
```

- 일반적인 `git merge` 직후 `ORIG_HEAD`는 Merge **이전**의 내 브랜치 HEAD를 가리킵니다.
- 따라서 이 명령으로 Merge **전과 후**의 파일 차이를 볼 수 있습니다.
- **Merge 직후에 확인**하세요. 다른 Git 작업을 하면 `ORIG_HEAD`가 바뀔 수 있습니다.
- 충돌 해결 과정에서 로직이 바뀔 수 있으므로 Diff만 보지 말고 **실행/테스트**도 해야 합니다.

---

# 4. 충돌은 언제 발생할까?

> **같은 파일 수정 = 무조건 충돌이 아닙니다.** Git은 공통 조상을 기준으로 양쪽의 변경 위치와 내용을 비교합니다. 충돌 없이 자동 병합되어도 **프로그램 동작이 깨질 수 있다는 점**은 별도로 확인해야 합니다.

| A(내 작업) | B(main에 병합) | 보통 결과 |
|---|---|---|
| `login.py` 수정 | `dashboard.py` 수정 | 자동 병합 |
| 같은 파일의 먼 위치 수정 | 다른 위치 수정 | 자동 병합 |
| 파일 상단 수정 | 파일 하단에 코드 추가 | 자동 병합하는 경우 많음 |
| **같은 줄**을 서로 다르게 수정 | 같은 줄 다른 값으로 수정 | **충돌 가능성 높음** |
| **같은 위치**에 서로 다른 줄을 추가 | 같은 위치 다른 코드 추가 | **충돌 가능** |
| 매우 가까운 줄의 변경 | 인접한 내용 변경 | 충돌 가능 |
| `login.py` 새로 생성 | `dashboard.py` 새로 생성 | 자동 병합 |
| `config.py`를 서로 다른 내용으로 새로 생성 | 같은 이름의 `config.py` 생성 | **add/add 충돌 가능** |
| `config.py` 수정 | `config.py` 삭제 | **modify/delete 충돌 가능** |
| 같은 파일 삭제 | 같은 파일 삭제 | 보통 자동 처리 |

## 사례 A. 서로 다른 줄 수정 — 대체로 자동 병합

공통 원본:

```python
PORT = 8000
DEBUG = False
TIMEOUT = 30
```

A는 `DEBUG = True`, B는 `PORT = 9000`으로 변경하면 보통 다음과 같이 자동 병합됩니다.

```python
PORT = 9000
DEBUG = True
TIMEOUT = 30
```

## 사례 B. 변수 하나를 같은 줄에서 다르게 수정 — 충돌

```text
원래:  TIMEOUT = 30
A:     TIMEOUT = 60
B:     TIMEOUT = 120
```

Git은 60과 120 중 무엇이 맞는지 자동 결정할 수 없습니다. 직접 선택/수정해야 합니다.

## 사례 C. 4줄 아래 동일한 위치에 서로 다른 코드 추가 — 충돌 가능

- 기존 파일은 4줄까지 같음.
- A가 4줄 바로 아래에 `configure_login()`을 추가함.
- B가 **바로 같은 위치**에 `configure_logging()`을 추가함.
- Git에서 충돌할 수 있으며 **main만 / 내 코드만 / 둘 다 원하는 순서로** 해결할 수 있습니다.

반면 A는 파일 하단, B는 파일 상단의 서로 다른 부분을 수정했다면 보통 자동으로 병합됩니다.

---

# 5. 터미널로 충돌 해결: main만 / 내 코드만 / 둘 다

## 5-1. 충돌 발생 확인

내 브랜치에서 다음을 실행한 상태라고 가정합니다.

```bash
git fetch origin
git merge origin/main
```

충돌이 나면 Git이 Merge를 멈춥니다.

```bash
git status
git diff --name-only --diff-filter=U
```

두 번째 명령은 **아직 해결되지 않은 충돌 파일 목록**을 보여줍니다.

예를 들어 `app.py`에는 이런 충돌 표시가 들어갈 수 있습니다.

```python
def start_app():
    print("시작")
<<<<<<< HEAD
    configure_login()
=======
    configure_logging()
>>>>>>> origin/main
    run_app()
```

- `<<<<<<< HEAD` 쪽: **내 기능 브랜치**의 코드(Current / ours)
- `=======`: 두 버전의 구분선
- `>>>>>>> origin/main` 쪽: **main에서 들어온** 코드(Incoming / theirs)

### 방법 1. main 코드만 사용하기 — 파일 전체를 main 버전으로

```bash
git checkout --theirs app.py
git add app.py
```

결과:

```python
def start_app():
    print("시작")
    configure_logging()
    run_app()
```

⚠️ **파일 전체가 main 버전으로 선택됩니다.** 파일의 다른 위치에서 내가 추가한 정상 변경도 버려질 수 있습니다.

### 방법 2. 내 코드만 사용하기 — 파일 전체를 내 브랜치 버전으로

```bash
git checkout --ours app.py
git add app.py
```

결과:

```python
def start_app():
    print("시작")
    configure_login()
    run_app()
```

⚠️ **파일 전체가 내 브랜치 버전으로 선택됩니다.** main에서 들어온 파일 내 다른 정상 변경도 버려질 수 있습니다.

### 방법 3. main 코드 다음에 내 코드를 추가하기 — 충돌 부분만 직접 수정 (권장)

```bash
nano app.py
```

충돌 표시 `<<<<<<<`, `=======`, `>>>>>>>`를 **모두 제거**하고 원하는 최종 코드로 수정합니다.

```python
def start_app():
    print("시작")
    configure_logging()  # main에서 추가한 코드
    configure_login()    # 내가 추가한 코드
    run_app()
```

`nano` 저장/종료: `Ctrl + O` → `Enter` → `Ctrl + X`.

```bash
git add app.py
```

**이 방법은 충돌한 일부만 선택할 수 있다는 장점**이 있습니다. 예를 들어 위 블록에서 **main 코드만 남기거나 내 코드만 남기는 것도** `nano`로 가능하고, 파일의 다른 정상 수정은 유지할 수 있습니다.

> `nano`가 없는 환경이라면 사용 가능한 텍스트 편집기(`vi app.py` 등)로 열어 **충돌 표시를 제거하고 최종 코드로 저장**하면 됩니다. GUI Merge Editor는 필수가 아닙니다.

## 5-2. 여러 파일에서 충돌했다면

파일 하나씩 `nano 파일명`으로 수정하고 `git add 파일명`을 반복합니다. 다음 명령으로 남은 충돌을 확인합니다.

```bash
git diff --name-only --diff-filter=U
git status
```

**모든 충돌이 해소된 후**:

```bash
git diff --cached        # 최종 반영될 변경 확인
git merge --continue       # 중단됐던 Merge 완료
# 실행/테스트 확인
git push
```

`git merge --continue` 시 커밋 메시지 편집기가 열릴 수 있습니다. 기본 메시지를 그대로 사용해도 됩니다.

## 5-3. 충돌 해결 자체를 취소하려면

```bash
git merge --abort
```

병합 시작 전 상태로 돌아가려고 시도합니다. 작업 보호를 위해 **Merge 전에 `git status` 확인 및 커밋**해두는 것이 안전합니다.

---

# 6. 신규 파일과 삭제된 파일은 어떻게 처리할까?

## 새 파일이 생긴 경우

**서로 다른 이름/경로**의 파일을 생성했다면 일반적으로 충돌 없이 두 파일이 모두 유지됩니다.

```text
A: backend/login.py 추가
B: backend/dashboard.py 추가
→ 보통 두 파일 모두 유지
```

**같은 경로/파일명**에 서로 다른 파일을 새로 생성하면 충돌할 수 있습니다.

```text
A: backend/config.py 새로 생성 (A 내용)
B: backend/config.py 새로 생성 (B 내용)
→ add/add 충돌 가능
```

이때 **내용을 합칠 경우** `nano backend/config.py`로 수정 후 `git add backend/config.py` 합니다. `--ours`나 `--theirs`를 쓰면 **한쪽의 파일 전체**를 택합니다.

## B가 main에서 파일을 삭제했는데 나는 수정한 경우

```text
A: config.py의 내용 수정
B: main에서 config.py 삭제
→ modify/delete 충돌 가능
```

**파일을 유지하려면** 내 변경이 담긴 `config.py`를 확인하고:

```bash
git add config.py
```

**삭제가 맞다면**:

```bash
git rm config.py
```

다른 충돌도 모두 정리했다면 `git merge --continue`를 실행합니다.

> 이 상황에서 main에는 **파일 자체가 없기 때문에** `git checkout --theirs config.py`가 실패할 수 있습니다. 수정/삭제 충돌은 **파일을 남길지 삭제할지**를 선택하는 방식으로 해결하세요.

## B가 수정한 파일을 내가 삭제한 경우

- **삭제 유지:** `git rm config.py`
- **main의 수정 버전 복구:** `git restore --source=origin/main -- config.py` → `git add config.py`

## B가 삭제했고 내가 손대지 않은 경우

대개 충돌 없이 삭제가 자동 반영됩니다. 코드에서 그 파일을 여전히 참조하지 않는지 테스트하세요.

---

# 7. PR 리뷰·승인·병합 시 체크리스트

- [ ] 내 브랜치에서 개발한 것이 맞는가? (`git branch --show-current`)
- [ ] 스테이징된 변경이 의도한 것인가? (`git diff --cached`)
- [ ] 비밀번호·API 키·`.env`를 커밋하지 않았는가?
- [ ] 최신 main 변경을 확인하고 필요한 경우 반영했는가?
- [ ] 충돌 파일이 없는가? (`git status`)
- [ ] 프로그램 실행 / Docker Compose / 필요한 테스트가 통과하는가?
- [ ] PR의 **base가 `main`**, **compare가 내 기능 브랜치**인가?
- [ ] PR **Files changed**에서 예상하지 않은 삭제·변경이 없는가?
- [ ] GitHub Actions 검사가 통과하는가?
- [ ] 상대방이 리뷰하고 승인했는가?
- [ ] **Squash and merge** 후 PR 상태가 **Merged**인가?

### PR을 이미 만들었는데 다시 커밋·Push해도 되나?

**가능합니다.** 같은 브랜치에 계속 `git add` → `git commit` → `git push`하면 열린 PR에 자동으로 반영됩니다. 다만 리뷰가 진행 중이면 바뀐 부분을 리뷰어에게 알려주는 것이 좋습니다.

### Squash and merge 후 옛 기능 브랜치로 계속 작업해도 되나?

가급적 **새 기능은 최신 `main`에서 새 브랜치를 생성**하세요. Squash는 main에 새로운 단일 커밋을 만들기 때문에 예전 브랜치와 main의 커밋 이력이 같지 않을 수 있습니다.

---

# 8. 막히면 이 순서로 확인

| 증상 | 확인할 것 | 기본 대응 |
|---|---|---|
| Push가 거부됨 | `git status`, 원격에 다른 커밋 있는지 | 오류 메시지 확인 후 해당 원격 브랜치 동기화. 무작정 force push 금지 |
| `git merge` 충돌 | `git status`, `git diff --name-only --diff-filter=U` | 충돌 부분을 수동 수정 → `git add` → `git merge --continue` |
| `git switch main`이 안 됨 | 커밋되지 않은 변경/충돌 존재 여부 | 변경사항 커밋 또는 별도 안전하게 보관 후 이동 |
| `git pull --ff-only` 실패 | 로컬 main과 원격 main 이력 불일치 | 억지 병합하지 말고 원인 확인 |
| 파일이 갑자기 삭제됨 | `git diff --name-status ORIG_HEAD HEAD` | 동료가 main에서 삭제했는지 확인, 필요한 경우 복구 |
| 충돌이 없었는데 앱이 오류남 | 함수명 변경·import·설정·의존성 | `git diff`, 테스트, 실행 로그 확인 |
| `git commit`이 "nothing to commit" | `git status` | 커밋할 변경이 없으면 다음 단계로 진행 |

---

# 9. 최종 암기용: 일상 작업 3가지

**새 기능 시작:**

```text
main 이동 → 최신 main pull → 새 feature 브랜치 → 개발 → add → commit → push → PR
```

**PR 후 계속 개발:**

```text
같은 feature 브랜치에서 개발 → add → commit → push (기존 PR 자동 갱신)
```

**동료가 먼저 main 병합:**

```text
내 작업 커밋(필요 시) → fetch → diff로 변경 확인 → merge origin/main
→ 충돌 시 수정/add/merge --continue → 테스트 → push
```

**충돌 해결의 핵심 한 문장:** `--ours` / `--theirs`는 **파일 전체 선택**, `nano` 등으로 직접 수정하면 **원하는 줄만 선택하고 코드 순서도 정할 수 있음**.
