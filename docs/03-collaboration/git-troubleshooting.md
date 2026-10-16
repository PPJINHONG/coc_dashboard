# Git 작업이 막혔을 때 찾아보기

[문서 목록](../README.md) · [평소 Git 순서](git_collaboration_guide.md)

평소에는 전부 읽지 않아도 됩니다. **지금 나온 메시지와 비슷한 항목만 찾아보세요.**

## 1. 승인했는데 상대 코드가 안 보여요

PR이 **Approved**인지 **Merged**인지 확인합니다. 승인은 검토 결과이고, 실제로 합쳐졌다는 뜻은 Merged입니다.

Merged여도 내 파일은 자동으로 바뀌지 않습니다. [내 브랜치에 최신 코드 가져오기](git-scenarios.md)를 따라야 합니다. Fetch만 실행하면 정보만 받아오므로 파일이 그대로인 것이 정상입니다.

## 2. `git add .`에 원하지 않는 파일을 넣었어요

아직 커밋하기 전이라면 다음 명령으로 커밋 목록에서만 뺍니다. `파일경로`는 실제 이름으로 바꿉니다.

```bash
git restore --staged 파일경로
```

편집한 파일 내용은 그대로 남습니다. 처음부터 일부 파일만 준비하려면 `git add frontend/src/App.tsx`처럼 경로를 지정할 수 있습니다.

## 3. `nothing to commit`이 나와요

새로 커밋할 변경이 없다는 뜻입니다. 파일을 저장했는지, 현재 브랜치가 맞는지 `git status`로 확인합니다. 이미 커밋한 상태라면 커밋 단계를 생략하고 다음 단계로 진행합니다.

## 4. main을 받는데 `--ff-only` 오류가 나요

내 PC의 main에 GitHub와 다른 기록이 생겼을 수 있습니다. 오류가 난 상태에서 강제로 덮어쓰지 말고 먼저 확인합니다.

```bash
git status
git log --oneline --graph --decorate -15
```

이력 화면을 보고 내 작업을 보관할 브랜치가 필요한지 두 사람이 확인합니다. 본인만 만든 기록을 버려도 되는지 모르는 상태에서 초기화하지 않습니다.

## 5. Push가 `non-fast-forward`로 거절돼요

같은 원격 브랜치에 다른 기록이 생겼을 수 있습니다. 강제 업로드부터 하지 않습니다. 내 변경을 먼저 커밋하고 자기 브랜치에서 확인합니다. 예시 이름은 실제 브랜치로 바꿉니다.

```bash
git fetch origin
git log --oneline --left-right HEAD...origin/feature/report-ui
```

`<`는 내 쪽에만 있는 기록, `>`는 GitHub 쪽에만 있는 기록을 뜻합니다. 화면을 닫으려면 `q`를 누릅니다.

GitHub 쪽 변경을 확인하고 합치기로 했다면 작업 폴더가 깨끗한 상태에서 실행합니다.

```bash
git merge origin/feature/report-ui -m "merge: 같은 브랜치의 원격 변경 반영"
```

충돌이 있으면 [해결 절차](git-conflicts.md)를 따르고, 실행 확인 후 다시 Push합니다. 이때 필요한 것은 **같은 기능 브랜치의 변경**이므로 `origin/main`만 합쳐서는 해결되지 않을 수 있습니다. 앞으로는 한 브랜치는 한 사람이 올리는 방식을 권장합니다.

## 6. 기능 브랜치에서 `git pull origin main`을 했어요

이 명령은 현재 브랜치에 원격 main을 반영합니다. 로컬 main만 갱신하는 명령이 아닙니다. 설정에 따라 합치는 방식도 달라질 수 있습니다.

먼저 `git status`로 성공·충돌·진행 상태를 확인합니다. 앞으로는 [평소 순서](git_collaboration_guide.md)처럼 main 갱신과 기능 브랜치 갱신 명령을 구분해서 사용합니다. [Git 공식 설명](https://git-scm.com/docs/git-pull)

## 7. 병합 후 예전 브랜치를 지워도 되나요?

삭제는 선택입니다. 먼저 PR이 Merged인지, 그 뒤에 추가로 작업한 커밋이 없는지 확인합니다.

원격 브랜치는 GitHub PR의 **Delete branch** 버튼으로 정리할 수 있습니다. 로컬 브랜치는 다른 브랜치로 이동한 뒤 다음처럼 삭제를 시도할 수 있습니다.

```bash
git branch -d feature/report-ui
```

Squash 방식은 main에 하나의 새 커밋을 만들기 때문에 Git이 기존 브랜치를 합쳐진 것으로 인식하지 못해 거절할 수 있습니다. 당장 지울 필요는 없습니다. 내용을 모르고 `-D`로 강제 삭제하지 않습니다. [Git 공식 설명](https://git-scm.com/docs/git-branch)

다음 기능은 최신 main에서 새 브랜치로 시작합니다. Squash된 브랜치에 계속 작업하면 다음 PR에서 이력을 이해하기 어려워질 수 있습니다.

## 8. 선택: 커밋 대신 잠깐 치워 두는 Stash

초기에는 **중간 커밋으로 저장하는 방법**을 권장합니다. Stash는 미커밋 변경을 내 PC에만 잠시 치워 두는 기능이며 GitHub에 업로드되지 않습니다.

사용해야 한다면 내 기능 브랜치에서 먼저 확인합니다.

```bash
git status
git stash push -u -m "main을 받기 전 임시 보관"
```

새로 저장됐다는 메시지가 나온 경우에만 뒤에서 Pop합니다. `No local changes to save`라면 이번에 저장한 것이 없으므로 이전 Stash를 잘못 꺼내지 않도록 Pop하지 않습니다.

`-u`는 추적하지 않던 새 파일도 포함하지만 `.env`처럼 Git에서 제외한 파일은 포함하지 않습니다. 새 Stash가 저장됐다면 main을 합칩니다.

```bash
git fetch origin
git merge origin/main -m "merge: 최신 main 반영"
```

충돌이 있다면 먼저 병합을 해결하거나 중단합니다. 그 과정이 끝난 뒤 보관했던 변경을 꺼냅니다.

```bash
git stash pop
git status
```

꺼낼 때도 충돌할 수 있습니다. 파일을 고치고 `git add` 후 일반 커밋으로 저장합니다. 이 충돌은 Merge 진행 상태가 아니므로 `git merge --abort`로 취소하지 못합니다. 충돌 시 Stash 항목은 남으니 Pop을 반복하지 말고 `git stash list`로 확인합니다. [Git 공식 설명](https://git-scm.com/docs/git-stash)
