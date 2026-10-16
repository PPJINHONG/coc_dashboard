# 평소에 따라 하는 Git 작업 순서

[문서 목록](../README.md) · [쉬운 용어 사전](../01-start/glossary.md)

**새 기능을 만들고 상대방 검토를 거쳐 공용 코드에 합칠 때** 읽습니다. 두 사람이 각자 자기 브랜치에서 개발하는 상황을 기준으로 합니다.

아래는 두 사람이 함께 검토해 사용할 권장 방법입니다. GitHub 보호 설정을 실제로 적용한 것은 아닙니다.

## 1. 먼저 이것만 구분하기

| 할 일 | 뜻 |
| --- | --- |
| 파일 저장 | 편집 내용을 파일에 저장 |
| Commit, 커밋 | 변경 이력을 내 PC에 기록 |
| Push, 푸시 | 내 기록을 GitHub에 올리기 |
| PR 만들기 | 내 변경을 공용 코드에 합쳐 달라고 요청 |
| Approve, 승인 | 상대가 검토하고 합쳐도 좋다고 표시 |
| Merge, 병합 | 공용 코드에 실제로 합치기 |

**승인과 병합은 서로 다른 단계입니다.** `main`은 공용 코드, 기능 브랜치는 내가 따로 작업하는 공간이라고 생각하면 됩니다.

## 2. 새 작업을 시작하기 전

터미널은 프로젝트 최상위 폴더에서 엽니다. 먼저 현재 작업 위치와 저장되지 않은 변경을 확인합니다.

```bash
git branch --show-current
git status
```

첫 줄은 현재 브랜치 이름을 보여줍니다. 두 번째 결과에 `working tree clean`이 있으면 커밋되지 않은 변경이 없다는 뜻입니다. 변경이 남아 있다면 브랜치를 옮기기 전에 [작업 중 최신 코드 가져오기](git-scenarios.md)를 보고 저장합니다.

## 3. 최신 공용 코드를 받고 내 작업 공간 만들기

변경을 모두 커밋한 상태에서 하나씩 실행합니다.

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/report-ui
```

| 명령 | 하는 일 |
| --- | --- |
| `git switch main` | 내 PC의 공용 브랜치로 이동 |
| `git pull --ff-only origin main` | GitHub의 최신 main을 받아 내 main 갱신 |
| `git switch -c feature/report-ui` | 새 작업 브랜치를 만들고 그곳으로 이동 |

`feature/report-ui`는 예시 이름입니다. 자기 작업에 맞는 이름으로 바꾸고 이후 명령에서도 같은 이름을 씁니다. 이미 그 브랜치에서 작업 중이라면 다시 만들지 않습니다.

`--ff-only`는 이력이 예상과 다르면 억지로 합치지 않고 멈추게 하는 옵션입니다. 실패하면 다음 명령을 실행하지 말고 [문제 해결](git-troubleshooting.md)을 확인합니다.

## 4. 코딩한 내용을 내 PC에 기록하기

파일을 저장한 뒤 변경을 확인합니다.

```bash
git status
git diff
```

어떤 파일을 바꿨는지, 어떤 줄이 달라졌는지 나옵니다. 긴 화면이 나오고 입력이 안 되면 `q`를 눌러 나올 수 있습니다.

이번 작업을 모두 기록할 준비가 되면 실행합니다.

```bash
git add .
git diff --cached
```

`git add .`은 프로젝트 아래의 변경·추가·삭제를 커밋할 목록에 넣습니다. 아직 커밋한 것은 아닙니다. `git diff --cached`로 **이번 커밋에 들어갈 내용**을 확인합니다.

의도한 내용만 있으면 기록합니다.

```bash
git commit -m "feat: add report UI"
```

따옴표 안은 작업 설명입니다. `feat: 보고서 화면 추가`처럼 한글로 적어도 됩니다. 비밀번호나 키, `.env`는 기록하지 않습니다. 잘못 준비한 파일을 목록에서 빼는 방법은 [문제 해결](git-troubleshooting.md)에 있습니다.

**기능이 미완성이어도 커밋할 수 있습니다.** 중간 저장에는 `wip: 보고서 화면 작업 중`처럼 적습니다. 미완성 코드를 공용 코드에 합치는 것은 별개의 판단입니다.

## 5. GitHub의 내 브랜치에 올리기

브랜치를 처음 올릴 때 실행합니다.

```bash
git push -u origin feature/report-ui
```

이때 `main`에는 합쳐지지 않습니다. `-u`는 앞으로 업로드할 원격 브랜치를 연결해 둡니다. 이후 같은 브랜치에서 새로 커밋한 뒤에는 다음으로 올릴 수 있습니다.

```bash
git push
```

## 6. GitHub에서 PR 만들기

1. 저장소의 **Pull requests → New pull request**를 엽니다.
2. `base: main`을 고릅니다. 합쳐질 목적지입니다.
3. `compare: feature/report-ui`를 고릅니다. 내 작업 브랜치입니다.
4. 바꾼 내용과 확인한 동작을 적고 **Create pull request**를 누릅니다.
5. 아직 미완성이지만 공유하고 싶다면 **Draft pull request**로 만듭니다.

이미 PR이 있다면 같은 브랜치에 추가 커밋을 올릴 때 그 PR도 바뀝니다. 새 PR을 만들 필요가 없습니다.

## 7. 최신 코드 확인, 자동 검사, 상대방 검토

최종 리뷰 전에 [작업 중 최신 코드 가져오기](git-scenarios.md)에 따라 최신 main을 내 브랜치에 합칩니다. 새로 반영할 내용이 없다면 Git이 알려줍니다.

그다음 [프로젝트를 다시 실행](../02-development/docker-compose.md)해서 내 기능과 상대 기능을 확인합니다. PR의 `Compose build`가 성공했는지도 확인합니다. [자동 검사 보는 방법](github-actions.md)

상대방은 다음 순서로 리뷰합니다.

1. PR의 **Files changed**에서 바뀐 파일을 봅니다.
2. 변경 목적, 실행 확인, 함께 쓰는 설정에 문제가 없는지 봅니다.
3. 수정이 필요하면 설명을 남깁니다.
4. 확인이 끝나면 **Review changes → Approve → Submit review**로 승인합니다.

승인 후 수정 커밋을 올리면 검사와 승인을 다시 확인해야 할 수 있습니다.

## 8. 실제로 main에 합치기

상대의 승인과 검사를 마친 뒤 **Squash and merge**를 누릅니다. 내 PR의 여러 커밋을 하나로 묶어 main에 넣는 방식입니다. 최종 상태가 **Merged**인지 확인합니다.

두 사람이 헷갈리지 않도록 작성자가 승인·검사를 확인하고 병합하는 방식을 권장합니다. GitHub에서 강제로 막아주는 조건은 [처음 설정하기](github-settings.md)를 참고하세요.

## 9. 내 PR 병합이 끝났다면 다음 작업 시작

그 PR 이후 추가 작업이 없고 `git status`가 깨끗한지 먼저 확인합니다.

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/next-feature
```

다음 기능은 최신 공용 코드에서 새 브랜치로 시작합니다. 이전 브랜치 정리는 [문제 해결](git-troubleshooting.md)을 참고하세요.

**상대 PR만 합쳐졌고 내 작업이 남은 상황은 다릅니다.** 그때는 새 브랜치를 만들지 말고 [현재 브랜치에 최신 main을 가져옵니다](git-scenarios.md).
