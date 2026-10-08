# Git/GitHub 협업 운영 가이드

> 프로젝트: `PPJINHONG/coc_dashboard`  
> 협업 인원: 2명  
> 초기 상태: `README.md`만 있는 GitHub 저장소, 각 개발자 PC에서 Clone/Pull 완료  
> 저장소: Public로 전환하여 `main` Ruleset 적용 예정  
> 목표: 기능 브랜치에서 개발 → PR 리뷰 및 승인 → `main` 병합

## 1. Git 핵심 개념

| 용어/명령 | 의미 | 현재 작업 파일에 미치는 영향 |
|---|---|---|
| `git fetch origin` | `origin`의 최신 커밋/브랜치 정보를 내려받음 | 작업 브랜치/파일은 변경하지 않음 |
| `git fetch --all` | 등록된 **모든 원격 저장소**의 참조를 갱신 | 현재 작업 브랜치/파일은 변경하지 않음 |
| `git pull origin main` | 원격 `main`을 Fetch한 뒤 **현재 브랜치에** 병합 또는 Rebase | 현재 브랜치와 파일이 바뀔 수 있음 |
| `git merge origin/main` | Fetch로 갱신된 `origin/main`을 현재 브랜치에 병합 | 충돌 가능 |
| `git push origin <branch>` | 로컬 브랜치의 커밋을 원격 같은 브랜치에 업로드 | 원격 브랜치 갱신; `main`에 자동 합쳐지지 않음 |
| Pull Request(PR) | 기능 브랜치를 `main`에 합치기 위한 검토 요청 | PR 생성만으로 `main`은 변경되지 않음 |
| Approve | 리뷰어가 PR 변경 사항을 승인 | 승인 자체는 Merge가 아님 |
| Merge | 브랜치의 변경 사항을 대상 브랜치에 실제 반영 | `main`에 코드 반영 |

**주의:** `feature/backend`에서 `git pull origin main`을 실행하면 로컬 `main`이 갱신되는 것이 아니라 **현재 `feature/backend` 브랜치에 원격 main을 합치는 작업**이 된다.

## 2. 권장 브랜치 전략

- `main`: 안정적인 공용 코드, 직접 Push하지 않고 PR을 통해 반영.
- `chore/init-project`: React/Django 프로젝트 뼈대 초기화 작업용.
- `feature/login-ui`, `feature/login-api`, `feature/file-upload`: 기능별 단기 브랜치.
- 담당자별 고정 브랜치(`feature/frontend`, `feature/backend`)도 가능하지만, **기능별로 최신 `main`에서 새 브랜치를 만들고 PR 병합 후 삭제하는 방식**을 권장.

작업 흐름:

```text
main (최신 공용 코드)
  ├─ chore/init-project  ── PR → 승인 → Merge ──► main
  ├─ feature/login-ui     ── PR → 승인 → Merge ──► main
  └─ feature/login-api    ── PR → 승인 → Merge ──► main
```

## 3. README만 있는 저장소에서 최초 뼈대 올리기

개발자 A가 공통 초기 구조를 만들어 PR을 올리고, 개발자 B가 검토한다.

### A. 초기화 브랜치 만들기

```bash
git switch main
git pull origin main
git switch -c chore/init-project
```

이 브랜치에서 프로젝트 폴더와 `.gitignore` 등을 작성한다.

### B. 변경 사항 커밋 및 Push

```bash
git status
git add .
git commit -m "chore: initialize project structure"
git push -u origin chore/init-project
```

### C. GitHub에서 PR 만들기

1. 저장소 → **Pull requests** → **New pull request**.
2. `base: main`, `compare: chore/init-project` 선택.
3. **Create pull request**.
4. 개발자 B가 **Files changed**에서 변경 사항을 검토.
5. B가 **Review changes → Approve → Submit review**.
6. 정책/테스트 조건을 충족하면 A 또는 권한이 있는 B가 **Squash and merge** (또는 허용된 Merge 방식) 실행.

**PR 생성과 Approve만으로는 `main`이 바뀌지 않는다. Merge해야 반영된다.** 보호 규칙에서 승인 1명을 요구하면 작성자 이외의 적격 리뷰어 승인이 필요하다.

### D. 두 사람 모두 로컬 main 최신화

```bash
git switch main
git pull origin main
```

> 참고: `main`으로 이동할 때 미커밋 수정 사항 때문에 브랜치 전환이 차단될 수 있으므로 `git status`를 먼저 확인한다.

## 4. 일상적인 기능 개발 명령어

### 새 기능 시작

```bash
git switch main
git pull origin main
git switch -c feature/login-ui
```

### 개발 중 변경 사항 커밋 및 업로드

```bash
git status
git add .
git commit -m "feat: add login UI"
git push -u origin feature/login-ui   # 이 브랜치 최초 Push
```

동일 브랜치의 다음 Push부터는 추적 설정이 되어 있다면 다음 명령으로 충분하다.

```bash
git push
```

### 기능 완료 후

1. GitHub에서 `feature/login-ui` → `main` PR 생성.
2. 상대방이 리뷰/Approve.
3. 필수 체크가 통과하면 Merge.
4. 양쪽 PC에서 `main` 최신화.
5. 다음 기능은 갱신된 `main`에서 새 브랜치 생성.

```bash
git switch main
git pull origin main
git switch -c feature/next-feature
```

선택적으로 병합된 기능 브랜치를 정리한다.

```bash
git branch -d feature/login-ui
git push origin --delete feature/login-ui
```

브랜치를 삭제하기 전에 PR 병합 여부와 더 필요한 커밋이 없는지 확인한다.

## 5. 다른 사람이 main에 Merge했을 때 내 작업 브랜치에 반영

예: B가 `feature/login-api`에서 작업 중 A의 PR이 `main`에 Merge됨.

- **아무것도 하지 않으면:** B의 파일은 자동 변경되지 않음.
- **Fetch만 하면:** 원격 정보만 갱신, B의 작업 파일 유지.
- **최신 main이 필요할 때:** 먼저 B의 미커밋 작업을 안전하게 보관한 후 B의 기능 브랜치에 `origin/main`을 Merge.

### 방법 A: 작업 중 코드도 Commit할 수 있을 때

```bash
git switch feature/login-api
git status
git add .
git commit -m "wip: implement login API"
git fetch origin
git merge origin/main
# 충돌이 발생했다면 해결 후 git add 및 git commit
git push
```

### 방법 B: 아직 Commit하고 싶지 않을 때

```bash
git switch feature/login-api
git stash push -u -m "WIP: login API"
git fetch origin
git merge origin/main
git stash pop
```

`git stash pop`에서도 충돌이 발생할 수 있다. 충돌 시 파일을 수정하고 `git add` 등으로 정리한다. **Stash를 썼다고 충돌 가능성이 없어지는 것은 아니다.**

### 충돌 발생 시

```bash
git status                   # 충돌 파일 확인
# 편집기에서 충돌 구간을 직접 해결
git add <resolved-file>
git commit                   # merge 중단 상태인 경우 병합 커밋 완료
```

같은 파일을 수정했다고 무조건 충돌하는 것은 아니지만, 같은 위치의 상충하는 변경은 수동 조정이 필요할 수 있다. 병합 전후 테스트를 실행한다.

## 6. GitHub Public 저장소 main 보호 Ruleset

경로: **Repository → Settings → Rules → Rulesets → New branch ruleset**

| 설정 항목 | 권장값 | 설명 |
|---|---|---|
| Ruleset Name | `Protect main` | 규칙 이름 |
| Enforcement status | `Active` | 규칙 활성화 |
| Bypass list | 비워둠 | 예외 사용자 없이 적용 |
| Target branches | `Default` | 기본 브랜치(`main`) 대상 |
| Restrict deletions | 켜기 | `main` 브랜치 삭제 방지 |
| Require a pull request before merging | 켜기 | 변경 시 PR 필수 |
| Required approvals | `1` | 상대방 리뷰 승인 1명 필요 |
| Dismiss stale pull request approvals when new commits are pushed | 켜기 | 새로운 리뷰 대상 커밋 발생 시 이전 승인 해제 |
| Block force pushes | 켜기 | 강제 Push 차단 |
| Require status checks to pass | **CI 구축 후 켜기** | GitHub Actions 검사 결과 필수화 |
| Allowed merge methods | 우선 `Squash` 권장 | PR의 커밋을 하나로 정리 |

**지금 단계에서는 비추천:** `Restrict creations`, `Restrict updates`, `Require deployments to succeed`, `Require signed commits` 등은 필요성과 영향 범위를 이해한 뒤 활성화한다. 특히 `Restrict updates`는 정상적인 Merge까지 막을 수 있다.

### Public/Private 요금제 주의

- Public 저장소는 GitHub Free에서도 일반적인 보호 규칙 적용이 가능하다.
- Private 조직 저장소에서 무료 요금제로 Ruleset을 만들면 **강제 적용되지 않는다**는 경고가 발생할 수 있다.
- 현재 저장소는 Public으로 변경했으므로 위 Ruleset을 적용하는 방향으로 진행한다.

## 7. GitHub Actions와 Ruleset의 관계

GitHub Actions는 Ruleset에 독립적인 **별도 체크박스가 아니다.**

1. 저장소에 `.github/workflows/ci.yml` 등 Workflow 파일 추가.
2. PR에서 Workflow를 실제 실행.
3. **Settings → Rules → Rulesets → Protect main**으로 이동.
4. **Require status checks to pass** 체크.
5. **Add checks**에서 Workflow의 Job 검사 이름(예: `frontend-build`, `backend-check`)을 필수 검사로 등록.

React/Django 코드가 없는 초기 단계에서는 필수 Status Check를 미리 설정하지 않고, 프로젝트 기본 구조와 CI가 실행된 후 추가하는 것이 좋다. `frontend-build`는 React 빌드, `backend-check`는 Django 설정 검사를 위한 예시 이름이다. 실제 파일·작업 정의가 있어야 동작한다.

**중요:** Actions가 실패해도 Status Check를 필수 규칙으로 연결하지 않았다면 Merge가 자동으로 차단되는 것은 아니다.

## 8. 실무에서의 역할 분담

| 상황 | 개발자 A | 개발자 B |
|---|---|---|
| A 기능 개발 | 기능 브랜치 개발 → Commit → Push | 자신의 브랜치에서 계속 개발 |
| A의 PR 생성 | PR 생성, 변경 설명 | 코드 차이 검토 |
| PR 승인/병합 | 승인·검사 완료 후 Merge 가능 | Approve(적격 리뷰 권한 필요) |
| main 최신화 | `git switch main && git pull origin main` | 필요할 때 동일하게 최신화 |
| 진행 중 브랜치 동기화 | 필요시 `git fetch origin && git merge origin/main` | Commit 또는 Stash 후 같은 방식 사용 |

- 리뷰 승인을 **필수**로 만드는 것은 저장소 보호 규칙이며, PR 작성자와 Merge 실행자가 반드시 다른 사람일 필요는 없다.
- `Approve`와 `Merge`는 별개다.
- Public 저장소의 단순 열람 권한만으로는 승인 요건을 충족하지 못한다. 협업자에게 적절한 저장소 권한이 필요하다.
- 상대가 `main`에 Merge했다고 해서 각자의 기능 브랜치에 즉시 Pull할 필요는 없다. 필요할 때 동기화하면 된다.

## 9. 최소 명령어 치트시트

```bash
# 현재 상태 확인
git status
git branch --show-current

# 원격 정보만 확인
git fetch origin
git fetch --all

# main 최신화 (현재 브랜치를 main으로 바꾼 후)
git switch main
git pull origin main

# 새 기능 브랜치
git switch -c feature/new-feature

# 수정 사항 저장/업로드
git add .
git commit -m "feat: add new feature"
git push -u origin feature/new-feature

# 내 기능 브랜치에 최신 main 병합 (미커밋 변경 먼저 정리)
git fetch origin
git merge origin/main

# 로그 및 비교
git log --oneline -5
git log HEAD..origin/main --oneline
git diff HEAD origin/main
```

---

### 최초 실행 체크리스트

- [ ] Public 저장소에서 `Protect main` Ruleset을 `Active`로 생성
- [ ] 개발자 B를 협업자로 초대하여 적절한 권한 부여
- [ ] `chore/init-project` 브랜치 생성
- [ ] 프로젝트 공통 폴더 구조 및 `.gitignore` 작성
- [ ] Commit 후 Push 및 PR 생성
- [ ] B가 리뷰하고 Approve
- [ ] PR을 `main`에 Merge
- [ ] 두 개발자 모두 `main` Pull
- [ ] 기능별 브랜치 개발 시작
- [ ] React/Django 실행 가능해지면 GitHub Actions CI 추가
- [ ] CI 검사 성공을 필수 Status Check로 지정
