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
   └─ operations/current/ → db:5432 (최신 운영 데이터)
```

접속 주소는 http://localhost:8080 하나입니다. 화면은 `/`, Django 기본 페이지는 `/backend/`, 운영 데이터 조회 API는 `/api/operations/current/`에서 확인합니다. 운영 데이터 조회에는 로그인이 필요합니다.

API 목록과 호출 화면은 http://localhost:8080/api/docs/ 에서 확인합니다.

## 시작

```bash
# .env가 없을 때만 양식을 복사합니다.
if [ ! -f .env ]; then
  cp .env.example .env
fi
docker compose config --quiet
python3 tools/deploy.py init-storage
docker compose up --build -d
```

Docker Desktop이 실행 중이어야 합니다. 위 명령은 compose.yaml이 있는 프로젝트 폴더에서 한 단계씩 확인하며 실행합니다. 오류가 나면 다음 단계로 넘어가지 않습니다.

코드를 수정한 뒤에는 `python3 tools/deploy.py deploy`로 백업 후 반영합니다. 처음 설정하는 경우 [프로젝트 켜고 끄기](docs/02-development/docker-compose.md)를 따라 하세요. 현재 DB를 EC2로 옮기고 이후 데이터 유실 없이 배포하는 절차는 [EC2 배포와 데이터 보존](docs/02-development/ec2-deployment.md)에 정리했습니다.

EC2에서는 코드는 `/srv/coc-dashboard/app`, 실제 DB 파일은 `/srv/coc-dashboard/data/postgres`에 둡니다. EC2 `.env`의 `COMPOSE_FILE=compose.yaml:compose.ec2.yaml` 설정으로 같은 DB 경로를 계속 연결합니다. 최초 한 번 현재 데이터를 복원하고, 이후 코드 재배포 때는 운영 DB를 그대로 이어서 사용합니다.

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
