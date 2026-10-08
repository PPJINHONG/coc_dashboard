# COC Dashboard

React + TypeScript · Django · PostgreSQL의 기본 뼈대입니다.

## 실행 흐름

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

접속 주소는 http://localhost:8080 하나입니다. 화면은 `/`, Django 기본 페이지는 `/backend/`, 테이블 조회 API는 `/api/test/`에서 확인합니다.

API 목록과 호출 화면은 http://localhost:8080/api/docs/ 에서 확인합니다.

## 시작

```bash
# .env가 없다면 한 번만 복사합니다.
cp .env.example .env
docker compose up --build -d
```

코드 변경 후 같은 실행 명령으로 다시 빌드합니다. 환경변수와 이미지 버전은 루트 .env에서 관리합니다.

## 협업 흐름

```text
기능 브랜치 → Push → PR → 기본 CI 빌드 → 리뷰 → main 병합
```

GitHub Actions는 설정 확인과 이미지 빌드만 수행합니다.

자세한 내용은 [문서 목차](docs/README.md)를 참고하세요.
