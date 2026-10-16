# GitHub에서 처음 해 둘 설정

[문서 목록](../README.md) · [평소 Git 순서](git_collaboration_guide.md)

**두 사람이 합의한 협업 방법을 GitHub에서도 지키도록 설정할 때** 읽습니다. 관리 권한이 있는 사람이 화면에서 진행합니다.

아래는 권장안입니다. 문서를 작성했다고 설정이 적용되는 것은 아닙니다. 저장소 공개 여부·요금제에 따라 사용할 수 있는 기능이 다르므로 실제 Settings에서 확인합니다.

## 1. 두 사람이 사용할 방식부터 맞추기

- 각자 자기 작업 브랜치에 커밋하고 Push합니다.
- main은 공용 코드이므로 직접 올리는 대신 PR로 합칩니다.
- 상대가 검토하고 승인한 뒤 합칩니다.
- 필요한 검사에 실패하면 수정하고 다시 확인합니다.
- 상대 PR이 먼저 합쳐지면 다음 작성자가 최신 main을 가져와 다시 확인합니다.

한 브랜치는 한 사람이 올리고, 작성자가 상대 승인·검사를 확인한 뒤 병합하는 방식을 권장합니다. PR 한 개에 여러 주제를 한꺼번에 넣지 않는 편이 검토하기 쉽습니다.

## 2. 상대방의 저장소 권한 확인

GitHub 저장소의 **Settings → Collaborators** 또는 해당 저장소의 접근 관리 화면에서 상대방을 초대합니다. 상대에게 PR 검토 승인 요건을 충족하는 쓰기 권한 이상이 있는지 확인합니다.

초대만 보낸 상태라면 상대가 초대를 수락해야 합니다. 작성자는 자기 PR의 승인자로 계산되지 않습니다.

## 3. 자동 검사를 먼저 한 번 실행

main으로 향하는 PR을 만들고 `Compose build` 검사가 실제로 나타나는지 확인합니다. 처음에는 목록에 없을 수 있으므로 실행한 뒤 보호 설정에서 선택합니다. [검사 보는 방법](github-actions.md)

## 4. main 보호 설정 만들기

경로는 **Settings → Rules → Rulesets → New branch ruleset**입니다. Ruleset은 “이 브랜치를 바꾸려면 지켜야 하는 조건”을 모아 둔 설정입니다.

| 화면에서 찾을 항목 | 권장 선택 | 쉬운 설명 |
| --- | --- | --- |
| Ruleset name | `Protect main` | 알아보기 쉬운 설정 이름 |
| Enforcement status | `Active` | 실제로 적용 |
| Target branches | `main` | 공용 브랜치에 적용. 기본 브랜치가 main이면 Default도 가능 |
| Bypass list | 비워 두기 | 두 사람 모두 같은 절차 사용 |
| Require a pull request before merging | 켜기 | PR을 거쳐야 합칠 수 있게 함 |
| Required approvals | `1` | 상대방 승인 한 명 필요 |
| Dismiss stale pull request approvals when new commits are pushed | 켜기 | 검토 내용이 바뀌면 다시 승인받기 |
| Require conversation resolution before merging | 켜기 권장 | 리뷰에서 남긴 논의를 처리한 뒤 합치기 |
| Require status checks to pass | `Compose build` 추가 | 검사 성공을 병합 조건으로 지정 |
| Require branches to be up to date before merging | 켜기 권장 | 최신 공용 코드를 반영하고 검사 |
| Block force pushes | 켜기 | 기존 공용 기록을 강제로 바꾸는 작업 차단 |
| Restrict deletions | 켜기 | main 삭제 방지 |
| 허용하는 PR 병합 방식 | Squash 권장 | PR 하나를 커밋 하나로 정리 |

저장소의 **Settings → General → Pull Requests**에 있는 병합 방식도 위 선택과 맞아야 합니다. 저장한 뒤 main에 실제 적용되는지 확인합니다.

`Restrict updates`는 정상적인 PR 병합까지 막을 수 있어 이 흐름에서는 켜지 않는 것을 권장합니다. 위 표에 없는 옵션은 필요와 영향을 이해한 뒤 선택합니다.

## 5. 적용하면 작업 중 무엇이 달라지나요?

예를 들어 A가 먼저 main에 합치면 B의 PR에 “최신 코드로 업데이트하라”는 안내가 나올 수 있습니다. B는 [상황별 안내](git-scenarios.md)에 따라 자기 브랜치에 main을 합치고 올립니다.

변경 내용이 달라지면 자동 검사나 상대 승인이 다시 필요할 수 있습니다. 전에 승인했다는 이유로 새 변경 확인을 건너뛰지 않습니다.

정확한 조건은 [GitHub 보호 설정 공식 문서](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)를 참고하세요.
