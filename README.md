# COC Dashboard

화면은 React·TypeScript, 서버는 Django, 데이터 보관은 PostgreSQL을 사용하는 웹 프로젝트입니다.

처음이라면 **[쉬운 문서 안내부터 읽으세요](docs/README.md)**. 실행 방법과 두 사람의 Git 작업 순서를 상황별로 찾을 수 있습니다.

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
# .env가 없을 때만 양식을 복사합니다.
if [ ! -f .env ]; then
  cp .env.example .env
fi
docker compose config --quiet
docker compose up --build -d
```

Docker Desktop이 실행 중이어야 합니다. 위 명령은 compose.yaml이 있는 프로젝트 폴더에서 한 단계씩 확인하며 실행합니다. 오류가 나면 다음 단계로 넘어가지 않습니다.

코드를 수정한 뒤에는 `docker compose up --build -d`를 다시 실행해 반영합니다. 처음 설정하는 경우 [프로젝트 켜고 끄기](docs/02-development/docker-compose.md)를 따라 하세요.

## 협업 흐름

```text
기능 브랜치 → Push → PR → 기본 CI 빌드 → 리뷰 → main 병합
```

GitHub Actions는 설정 확인과 이미지 빌드만 수행합니다.

각자 브랜치에서 작업을 저장하고 GitHub에 올린 뒤 PR로 상대 검토를 요청합니다. 승인과 검사 후 실제로 main에 합칩니다.

- [평소 Git 작업 순서](docs/03-collaboration/git_collaboration_guide.md)
- [상대가 먼저 main에 합쳤을 때](docs/03-collaboration/git-scenarios.md)
- [자동 검사 결과 보는 방법](docs/03-collaboration/github-actions.md)
- [전체 문서 안내](docs/README.md)
