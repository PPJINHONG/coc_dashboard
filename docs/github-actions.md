# GitHub Actions 처음 사용하기

## 현재 파일 하나

`.github/workflows/ci.yml`만 사용합니다. GitHub는 이 경로에 올라온 YAML 파일을 Workflow로 인식합니다.

실행 순서는 **Compose 설정 확인 → frontend/backend 이미지 빌드**입니다.

## 용어

| 용어 | 이 프로젝트의 예 |
| --- | --- |
| Workflow | Basic CI: 자동화 전체 설정 |
| Event | PR, main Push, 수동 실행: 시작 조건 |
| Job | Compose build: 한 실행 컴퓨터에서 수행할 작업 |
| Runner | ubuntu-24.04: GitHub가 제공하는 임시 실행 컴퓨터 |
| Step | 파일 받기, 환경값 준비, 설정 확인, 빌드 |
| Action | checkout: 저장소 파일을 받는 재사용 도구 |
| run | runner에서 실행할 셸 명령 |

Workflow → Job → Step 순서로 읽으면 됩니다. [GitHub 공식 개념 가이드](https://docs.github.com/en/actions/get-started/understand-github-actions)

## 언제 실행되나

| 이벤트 | 실행 |
| --- | --- |
| main 대상 PR 생성/새 커밋 | 자동 실행 |
| main에 Push 또는 PR 병합 | 자동 실행 |
| Actions 화면에서 Run workflow | 수동 실행 |

기능 브랜치에 Push만 하고 PR이 없으면 이 Workflow는 자동 실행되지 않습니다. 수동 실행 버튼을 보려면 workflow_dispatch가 있는 파일이 기본 브랜치 main에 먼저 있어야 합니다.

## 첫 실행 순서

1. 현재 변경을 기능 브랜치에 커밋하고 GitHub에 Push합니다.
2. 해당 브랜치에서 main으로 PR을 만듭니다.
3. PR의 Checks 탭 또는 저장소 Actions 탭을 엽니다.
4. `Basic CI` 실행을 선택합니다.
5. `Compose build`를 선택하고 각 Step 로그를 확인합니다.
6. 성공이면 초록색, 실패면 빨간색으로 표시됩니다.
7. 리뷰 후 병합하면 main에서도 다시 실행됩니다.

GitHub 저장소에서 Actions가 비활성화된 경우 Settings → Actions → General에서 정책을 확인합니다.

## 각 Step의 역할

1. Checkout repository: 저장소 코드를 runner로 받습니다.
2. Prepare example environment: 예시 양식을 runner의 .env로 복사합니다. 개인 .env는 Git에 없고 GitHub로 전송하지 않습니다.
3. Validate Compose configuration: 공통 이미지 버전과 환경변수가 정상적으로 읽히는지 확인합니다.
4. Build application images: requirements.txt 설치와 React·TypeScript 타입 검사/빌드가 성공하는지 확인합니다.

후속 Step은 앞 Step이 성공해야 실행됩니다.

## 실패 확인

실패한 Step을 펼치고 오류가 시작된 줄을 읽습니다. 흔한 원인은 잘못된 이미지 참조, package.json과 lock 불일치, Python 의존성 설치 실패, React 빌드 오류입니다.

로컬에서 같은 범위를 확인합니다.

```bash
docker compose config --quiet
docker compose build
```

수정 커밋을 PR 브랜치에 Push하면 새 검사가 실행됩니다. 일시적인 다운로드 오류라면 Actions 실행 화면의 Re-run jobs로 재시도할 수 있습니다.

## main 병합 조건에 연결하기

CI 파일 자체는 main 직접 Push나 실패한 PR 병합을 막지 않습니다. 첫 실행 이후 Ruleset에서 `Require status checks to pass`를 켜고 `Compose build`를 필수로 등록합니다. 팀원 승인 1명도 별도 규칙으로 설정합니다.

필수 검사에는 `Compose build` 하나를 등록합니다. 리뷰 승인 조건은 별도 규칙입니다.
