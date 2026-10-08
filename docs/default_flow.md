# 현재 프로젝트 전체 흐름

## 1. 로컬 실행

```text
브라우저 localhost:8080
    ↓
frontend (Nginx)
├─ /          → React + TypeScript 화면
├─ /backend/  → Django 기본 페이지
└─ /api/      → backend:8000 (Django REST Framework)
   ├─ docs/   → Swagger UI
   ├─ schema/ → OpenAPI 명세
   └─ test/   → db:5432 (PostgreSQL test 테이블)
```

화면은 http://localhost:8080, Django 기본 페이지는 http://localhost:8080/backend/, test 테이블 조회는 http://localhost:8080/api/test/ 입니다. backend와 db는 Docker 내부 네트워크로 연결합니다.

```bash
# .env가 없을 때만 한 번 복사합니다.
cp .env.example .env
docker compose up --build -d
```

코드 변경 후에는 같은 명령으로 이미지를 다시 빌드합니다. Compose 파일 하나로 세 서비스를 실행합니다.

## 2. 협업과 CI

```text
개발자 A 기능 브랜치          개발자 B 기능 브랜치
          │                            │
          └──────── GitHub Push ───────┘
                         │
                  main 대상 PR
                         │
                GitHub Actions: Basic CI
                ├─ 저장소 파일 받기
                ├─ 예시 환경값 준비
                ├─ Compose 설정 확인
                └─ frontend/backend 이미지 빌드
                         │
                      팀원 리뷰
                         │
                     main 병합
                         │
                  동일한 기본 CI 실행
```

검사 이름은 `Compose build`입니다. Compose 설정과 이미지 빌드를 확인하며 React 빌드 과정에서 TypeScript 타입 검사를 수행합니다.

main 대상 PR에 CI가 실행되며 기능 브랜치 Push만으로는 자동 실행되지 않습니다. main 보호 규칙과 팀원 승인 조건은 GitHub에서 별도로 설정합니다.

## 관련 문서

- [환경변수와 버전 관리](configuration.md)
- [Compose 실행과 DB 관리](docker-compose.md)
- [애플리케이션 파일 구조](application.md)
- [Actions 입문 가이드](github-actions.md)
- [Git 협업 가이드](git_collaboration_guide.md)
