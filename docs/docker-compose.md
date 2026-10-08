# 기본 Docker Compose

## 현재 구성

| 서비스 | 역할 | 접속 |
| --- | --- | --- |
| frontend | React + TypeScript 빌드 파일 제공 | localhost:8080 |
| backend | Django 페이지와 조회 API | 내부 backend:8000, 외부 /backend/ 및 /api/ |
| db | PostgreSQL | 내부 db:5432 |

Compose 하나로 세 컨테이너를 실행합니다. Node는 React 이미지의 빌드 단계에서 사용합니다.

## 시작과 확인

실행 명령은 `docker compose up --build -d`입니다. `-d`는 백그라운드 실행 옵션이며 `-i`는 Compose 실행 옵션이 아닙니다.

Docker Desktop/Engine과 Compose v2.17 이상을 사용합니다.

```bash
# 최초 설정 시에만 복사
cp .env.example .env
docker compose up --build -d
docker compose ps
docker compose logs -f
```

실행 직후 웹 서버가 준비되는 데 잠시 걸릴 수 있습니다. depends_on은 DB 컨테이너 시작 순서만 지정하며 DB 접속 준비 완료까지 기다리지는 않습니다.

브라우저는 http://localhost:8080 으로 접속합니다. Nginx가 `/`에서는 React 파일을 제공하고 `/backend/`와 `/api/` 요청은 Django로 전달합니다. backend의 8000번 포트는 호스트에 공개하지 않습니다.

- 화면: http://localhost:8080
- Django 기본 페이지: http://localhost:8080/backend/
- Swagger UI: http://localhost:8080/api/docs/
- test 테이블 조회 API: http://localhost:8080/api/test/

## 수정과 종료

```bash
# 코드 변경 후 이미지 재빌드/컨테이너 갱신
docker compose up --build -d
# 설정 문법 확인 (비밀값은 출력하지 않음)
docker compose config --quiet
# 컨테이너/네트워크 제거, DB 볼륨 유지
docker compose down
```

소스 변경은 `up --build -d`로 반영합니다. 포트 충돌 시 compose.yaml의 왼쪽 호스트 포트만 변경합니다.

## DB 관리

`db/init/`의 SQL은 빈 DB 볼륨의 최초 초기화에 적용됩니다. 기존 볼륨에 적용하는 방법과 `test` 테이블 조회는 [DB 가이드](database.md)를 참고하세요.

```bash
# 예시 기본값으로 접속. 실제 사용자/DB를 바꿨다면 맞춰 수정합니다.
docker compose exec db psql -U coc -d coc_dashboard
```

데이터는 coc-dashboard_postgres_data 볼륨에 보관됩니다. down -v는 DB 데이터까지 삭제하므로 초기화할 때만 사용합니다.
