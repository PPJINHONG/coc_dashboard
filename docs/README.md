# 문서 목차

현재 구현은 React + TypeScript 기본 화면, Django 페이지/조회 API, PostgreSQL의 3개 컨테이너입니다. 환경 설정은 루트 .env에 모으고 Compose 하나로 실행합니다.

처음에는 전체 흐름을 읽고 필요한 상세 문서로 이동하세요.

| 문서 | 내용 |
| --- | --- |
| [전체 흐름](default_flow.md) | 로컬 실행 → 기능 브랜치 → PR → 빌드 CI → 리뷰 → main |
| [환경변수와 버전](configuration.md) | 설정 위치, 기본값, 패키지/이미지 버전 변경 |
| [Docker Compose](docker-compose.md) | 실행, 재빌드, 로그, 종료, DB 관리 |
| [DB 기본 구조](database.md) | test 테이블 초기화, 조회 SQL과 API |
| [애플리케이션](application.md) | TSX 파일, Django 템플릿, DB 연결 설정 |
| [GitHub Actions](github-actions.md) | Basic CI 첫 실행, Compose build 로그 확인 |
| [Git 협업](git_collaboration_guide.md) | 브랜치, PR, 리뷰, main 보호 규칙 |

## 현재 확인할 화면

- 프론트: http://localhost:8080
- Django 페이지: http://localhost:8080/api/
- test 테이블 조회 API: http://localhost:8080/api/test/
- DB: Docker 내부 db:5432

CI는 Compose 설정 검증과 애플리케이션 이미지 빌드를 수행합니다.


