# 처음 읽는 프로젝트 안내

[문서 목록으로 돌아가기](../README.md)

**프로젝트가 어떻게 움직이는지 처음 알아볼 때** 읽습니다. 명령어를 모두 외울 필요는 없습니다.

## 1. 무엇으로 이루어져 있나요?

| 구분 | 쉬운 설명 | 실제 폴더·도구 |
| --- | --- | --- |
| 화면 | 브라우저에서 보는 부분 | `frontend/`, React, TypeScript |
| 서버 | 요청을 받아 데이터를 읽고 저장하는 부분 | `backend/`, Django |
| 데이터 보관 | 내용을 표 형태로 저장하는 부분 | PostgreSQL (`db/init/`은 신규 설치용 기준선) |

```text
브라우저 localhost:8080
        ↓
frontend(Nginx) ── 화면 파일 제공
        ↓ /api/
backend(Django) ── 로그인 확인, DB 읽기·쓰기
        ↓
db(PostgreSQL)
```

Docker가 세 부분을 각각 실행하고, 함께 켜는 방법은 프로젝트 최상위의 `compose.yaml`에 있습니다.

## 2. 코드는 공통과 기능으로 나뉩니다

화면에 보이는 기능 탭(인프라 자원, 운영 인력, 운영 작업, 리전 이슈, 리포트, 변경 이력, DB 관리)은 **기능 폴더 하나씩**에 들어 있습니다.

```text
frontend/src/features/<기능>/   이 기능의 화면
backend/features/<기능>/        이 기능의 테이블·API·테스트
```

사이드바·홈·로그인 같은 공통 뼈대와 버튼·표 같은 공통 부품은 `frontend/src/app/`, `frontend/src/shared/`, 로그인·권한·공통데이터는 `backend/core/`, `backend/reporting/` 등에 있습니다. 새 기능 폴더를 만들면 메뉴와 API에 자동으로 연결되므로 두 사람이 서로 다른 기능을 동시에 고쳐도 같은 파일을 덜 건드립니다. 자세한 구조는 [폴더 구조와 기능 추가 방법](../02-development/structure.md)에 있습니다.

## 3. 내 컴퓨터에서 열어보기

Docker Desktop이 실행 중이어야 합니다. 처음이라면 [프로젝트 켜고 끄기](../02-development/docker-compose.md)의 1~3단계를 따라 하세요. 이미 설정했다면:

```bash
docker compose up --build -d
```

브라우저에서 http://localhost:8080 을 열고 로그인합니다. 빈 DB로 처음 켜면 관리자 `admin` / `admin`이 생깁니다. API 목록은 http://localhost:8080/api/docs/ 에서 봅니다.

## 4. 수정하고 함께 쓰는 순서

```text
최신 main 받기 → 내 브랜치 만들기 → 내 기능 폴더에서 수정
      → Commit → Push → PR → 자동 검사(빌드·테스트) + 상대 승인 → Merge
```

자동 검사는 화면 빌드(TypeScript 검사 포함)와 서버 테스트까지 확인합니다. 화면이 실제로 잘 보이는지는 사람이 직접 확인합니다.

## 5. 다음에 읽을 문서

- 실행: [프로젝트 켜고 끄기](../02-development/docker-compose.md)
- 어디를 고칠지: [폴더 구조와 기능 추가 방법](../02-development/structure.md)
- 두 사람이 나눠 개발하기: [기능별로 나눠 개발하기](../03-collaboration/parallel-development.md)
- Git 순서: [평소 Git 작업 순서](../03-collaboration/git_collaboration_guide.md)
- 낯선 단어: [쉬운 용어 사전](glossary.md)
