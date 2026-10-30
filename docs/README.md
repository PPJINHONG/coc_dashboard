# 여기서부터 읽으세요

문서를 **처음 이해하기 → 실행하고 수정하기 → 두 사람이 협업하기**로 나눴습니다. 처음부터 끝까지 한 번에 읽을 필요는 없습니다. 지금 하려는 일에 맞는 문서 하나를 열어보세요.

## 처음이라면 이 순서로

1. [프로젝트가 어떻게 움직이나요?](01-start/default_flow.md) — 화면·서버·데이터의 관계부터 이해합니다.
2. [프로젝트 켜고 끄기](02-development/docker-compose.md) — 내 컴퓨터에서 실제 화면을 엽니다.
3. [평소 Git 작업 순서](03-collaboration/git_collaboration_guide.md) — 작업을 저장하고 상대 검토를 거쳐 합칩니다.

모르는 단어는 [쉬운 용어 사전](01-start/glossary.md)에서 찾아보세요. 명령어는 모두 외우지 않아도 됩니다.

## 지금 필요한 설명 찾기

| 지금 하고 싶은 일 | 읽을 문서 |
| --- | --- |
| 화면 문구나 색상을 바꾸고 싶다 | [어떤 파일을 수정하나요?](02-development/application.md) |
| 비밀번호나 설정 항목을 바꿔야 한다 | [설정값 관리](02-development/configuration.md) |
| 현재 데이터를 EC2로 옮기고 버전을 배포하고 싶다 | [EC2 배포와 데이터 보존](02-development/ec2-deployment.md) |
| 저장된 데이터가 있는지 보고 싶다 | [데이터 확인](02-development/database.md) |
| 관리자 기능별 설정과 원본 테이블을 보고 싶다 | [관리자 DB 관리](02-development/database-admin.md) |
| 최신 운영 데이터와 DB 구조·접속 방법을 보고 싶다 | [최신 운영 데이터와 DB 설계](02-development/operations.md) |
| API를 직접 요청해 보고 싶다 | [데이터 요청과 응답](02-development/api.md) |
| 새 브랜치를 만들고 PR까지 올리고 싶다 | [평소 Git 작업 순서](03-collaboration/git_collaboration_guide.md) |
| 상대가 먼저 main에 합쳤다 | [상황별 Git 사용법](03-collaboration/git-scenarios.md) |
| 둘 다 많은 파일을 바꿨다 | [큰 변경을 합치는 순서](03-collaboration/git-scenarios.md#상황-2-둘-다-많은-파일을-바꿨어요-누가-먼저-올리나요) |
| Git이 충돌이라고 한다 | [충돌 해결](03-collaboration/git-conflicts.md) |
| 상대가 파일을 옮기고 내용도 바꿔 충돌했다 | [옛 파일의 내 기능을 새 구조에 옮기기](03-collaboration/git-conflicts.md#1-목표를-파일-하나로-생각해-보기) |
| Push가 거절되거나 Git 명령이 막혔다 | [Git 문제 해결](03-collaboration/git-troubleshooting.md) |
| GitHub 검사에 빨간색이 떴다 | [자동 검사 결과 보기](03-collaboration/github-actions.md) |
| 상대 승인 없이는 main에 못 합치게 하고 싶다 | [GitHub 처음 설정하기](03-collaboration/github-settings.md) |
| AI 지침 파일을 구분하거나 별도 검토를 맡기고 싶다 | [AI 지침 구조와 사용법](03-collaboration/agent-workflow.md) |

## 폴더별 전체 문서

```text
docs/
├─ README.md                         이 문서: 어디부터 읽을지 안내
├─ 01-start/                         처음 이해하기
│  ├─ default_flow.md                 프로젝트의 큰 흐름
│  └─ glossary.md                     쉬운 용어 사전
├─ 02-development/                   실행하고 수정하기
│  ├─ docker-compose.md               켜기·수정 반영·끄기
│  ├─ application.md                  폴더와 파일의 역할
│  ├─ configuration.md                내 설정과 프로그램 버전
│  ├─ database.md                     저장된 데이터 확인
│  ├─ operations.md             최신값 사용법·DB 설계·접속
│  └─ api.md                          데이터 요청과 결과 확인
└─ 03-collaboration/                 두 사람이 협업하기
   ├─ agent-workflow.md                AI 지침 파일의 역할과 사용법
   ├─ git_collaboration_guide.md       평소 작업부터 PR 병합까지
   ├─ git-scenarios.md                 상대 변경과 큰 구조 변경 반영
   ├─ git-conflicts.md                 충돌이 났을 때
   ├─ git-troubleshooting.md           명령이 막혔을 때
   ├─ github-actions.md                자동 검사 결과 확인
   └─ github-settings.md               처음 해 둘 보호 설정
```

## 명령어를 따라 할 때

- 터미널은 보통 프로젝트 최상위, 즉 `compose.yaml`이 있는 폴더에서 엽니다. 다른 폴더가 필요하면 해당 문서에 적었습니다.
- 명령은 한 단계씩 실행하고 결과를 확인합니다. 오류가 나면 다음 단계로 넘어가지 않습니다.
- 예시 브랜치 이름은 자기 브랜치 이름으로 바꿉니다.
- 기존 `.env`를 덮어쓰지 않으며, 실제 비밀번호나 키를 GitHub에 올리지 않습니다.
- 팀 운영 방법과 GitHub 보호 설정은 권장안입니다. 두 사람이 검토하고 실제로 적용해야 합니다.


