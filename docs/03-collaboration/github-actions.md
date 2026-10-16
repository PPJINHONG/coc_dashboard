# GitHub 자동 검사 결과 보는 방법

[문서 목록](../README.md) · [평소 Git 순서](git_collaboration_guide.md)

**PR에서 초록색·빨간색 검사 결과를 보거나 실패 이유를 확인할 때** 읽습니다.

GitHub Actions는 “코드를 올리면 정해 둔 작업을 실행해 주는 기능”입니다. 여기서는 설정과 빌드 검사를 자동으로 실행합니다. 이런 자동 검사를 CI라고 부릅니다.

## 1. 지금 무엇을 검사하나요?

설정 파일은 `.github/workflows/ci.yml` 하나입니다. 검사 전체 이름은 **Basic CI**, PR에서 확인할 검사 이름은 **Compose build**입니다.

실행 순서는 다음과 같습니다.

1. GitHub의 임시 컴퓨터로 프로젝트 코드를 받습니다.
2. `.env.example`을 사용해 검사에 필요한 설정을 준비합니다. 개인 `.env`를 보내는 방식은 아닙니다.
3. Compose 설정 파일이 올바르게 읽히는지 확인합니다.
4. 화면과 서버의 실행 묶음을 빌드합니다. 화면의 TypeScript 코드 검사도 이 과정에 포함됩니다.

앞 단계가 실패하면 뒤 단계는 진행하지 않습니다. **현재는 화면을 열거나 실제 API·DB 연결까지 검사하지 않습니다.** 빌드가 성공해도 로컬에서 기능을 확인해야 합니다.

## 2. 언제 실행되나요?

| 내가 한 일 | 자동 검사 |
| --- | --- |
| main으로 합치는 PR 생성 | 실행 |
| 열린 PR의 브랜치에 새 커밋 Push | 실행 |
| main에 PR 병합 또는 Push | 실행 |
| PR 없이 기능 브랜치에만 Push | 현재 설정에서는 실행하지 않음 |
| Actions 화면에서 수동 실행 | 직접 실행 가능 |

수동 실행 버튼은 해당 기능이 있는 검사 파일이 기본 브랜치 main에 먼저 올라가 있어야 보입니다.

## 3. 결과 확인 순서

1. GitHub에서 내 PR을 엽니다.
2. **Checks** 탭을 엽니다. 또는 저장소의 **Actions** 탭을 엽니다.
3. 최신 커밋에 해당하는 **Basic CI** 실행을 고릅니다.
4. **Compose build**를 엽니다.
5. 성공이면 초록색, 실패면 빨간색 표시를 확인합니다. 실행 중이면 끝날 때까지 기다립니다.

이전 커밋의 성공 표시 대신 **마지막으로 올린 커밋의 결과**를 봅니다.

## 4. 빨간색이면 어떻게 하나요?

실패한 단계를 펼쳐 오류 기록을 읽습니다. 마지막 줄만 보지 말고 오류가 처음 나온 부분도 확인합니다.

| 실패한 단계의 이름 | 뜻 | 먼저 볼 것 |
| --- | --- | --- |
| Checkout repository | 프로젝트 파일 받기 | GitHub 실행 기록의 다운로드·권한 오류 |
| Prepare example environment | 검사 설정 준비 | `.env.example`이 있는지 |
| Validate Compose configuration | 실행 설정 확인 | Compose 문법, 필요한 설정 이름 |
| Build application images | 프로그램 묶음 만들기 | Dockerfile, package 파일, 설치 오류, 코드 검사 오류 |

내 컴퓨터에서도 비슷한 범위를 확인할 수 있습니다. 프로젝트 최상위에서 실행합니다.

```bash
docker compose config --quiet
docker compose build
```

오류를 고쳐 같은 PR 브랜치에 커밋하고 Push하면 검사가 다시 실행됩니다. 다운로드 연결처럼 일시적인 문제라면 **Re-run jobs**로 재실행할 수 있지만 코드 오류라면 수정부터 해야 합니다.

검사가 전혀 실행되지 않으면 GitHub의 **Settings → Actions → General**에서 사용을 허용했는지도 확인합니다.

## 5. 검사가 실패하면 자동으로 병합이 막히나요?

검사 파일만 있다고 항상 막히지는 않습니다. GitHub 보호 설정에서 **Compose build가 성공해야 합칠 수 있다**고 지정해야 합니다. 상대 승인 1명도 별도 조건입니다.

두 사람이 개발할 때는 최신 main을 반영한 뒤 검사하도록 설정하는 것도 권장합니다. 설정 방법은 [GitHub 처음 설정하기](github-settings.md), 작업 중 반영 명령은 [상황별 Git 사용법](git-scenarios.md)을 참고하세요.

## 6. 화면에 나오는 용어가 궁금하다면

| 영어 | 여기서의 뜻 |
| --- | --- |
| Workflow | 자동으로 실행할 전체 순서. 여기서는 Basic CI |
| Job | 한 실행 환경에서 할 일 묶음. 여기서는 Compose build |
| Step | 파일 받기, 설정 확인 같은 개별 단계 |
| Runner | GitHub가 검사를 실행하는 임시 컴퓨터. 현재 ubuntu-24.04 |
| Event | PR 생성 등 검사를 시작하는 계기 |
| Action | 파일 받기처럼 재사용할 수 있게 만들어진 작업 |
| run | 그 단계에서 직접 실행할 명령 |

[GitHub 공식 개념 안내](https://docs.github.com/en/actions/get-started/understand-github-actions)
