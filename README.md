# COC Dashboard

화면은 React·TypeScript, 서버는 Django, 데이터 보관은 PostgreSQL을 쓰는 운영 현황 웹 프로젝트입니다.

처음이라면 **[문서 안내부터 읽으세요](docs/README.md)**.

## 구조

```text
브라우저 localhost:8080 → frontend(Nginx) ─ /     React 화면
                                         └ /api/ backend:8000 (Django REST Framework) → db:5432 (PostgreSQL)

frontend/src/  app/(공통 뼈대)  shared/(공통 부품·API)  features/<기능>/(기능별 화면)
backend/       core·reporting·database_admin·invites(공통 앱)  features/<기능>/(기능별 앱)
```

기능 탭 하나는 `frontend/src/features/<기능>/`과 `backend/features/<기능>/`에 들어 있고, 새 기능 폴더는 메뉴·홈·DB 관리·API에 자동으로 연결됩니다. 자세한 내용은 [폴더 구조와 기능 추가 방법](docs/02-development/structure.md)과 [기능별로 나눠 개발하기](docs/03-collaboration/parallel-development.md)를 봅니다.

## 시작

`.env`는 Git에 없습니다. 팀원에게 받은 `.env`를 프로젝트 최상위 폴더에 둔 뒤 실행합니다.

```bash
docker compose config --quiet
docker compose up --build -d
```

Docker Desktop이 실행 중이어야 합니다. 빈 DB로 처음 실행하면 관리자 `admin` / `admin`이 생깁니다. 업무 데이터는 Git에 포함하지 않습니다. API 목록은 http://localhost:8080/api/docs/ 에서 확인합니다.

코드를 수정하거나 새 코드를 받은 뒤에는 아래처럼 반영하고, 서버 코드를 바꿨다면 테스트를 실행합니다. DB·첨부파일은 Docker 볼륨에 남습니다. `-v`는 붙이지 않습니다.

```bash
git pull --ff-only origin main
docker compose down
docker compose up --build -d
docker compose exec backend pytest
```

EC2는 운영 전용 `compose.prod.yaml`을 `-f`로 지정하며 데이터는 `/srv_db`에 저장됩니다. [프로젝트 켜고 끄기](docs/02-development/docker-compose.md), [EC2 배포](docs/02-development/ec2-deployment.md)를 참고하세요.

## 협업 흐름

```text
기능 브랜치 → Push → PR → 자동 검사(Compose build: 이미지 빌드 + 백엔드 테스트) → 리뷰 → main 병합
```

- [평소 Git 작업 순서](docs/03-collaboration/git_collaboration_guide.md)
- [기능별로 나눠 개발하기](docs/03-collaboration/parallel-development.md)
- [상대가 먼저 main에 합쳤을 때](docs/03-collaboration/git-scenarios.md)
- [자동 검사 결과 보는 방법](docs/03-collaboration/github-actions.md)
