# DB 기본 구조와 테스트 쿼리

```text
db/
├─ init/01-test.sql   test 테이블과 샘플 데이터 생성
└─ queries/test.sql  샘플 데이터 조회
```

PostgreSQL 공식 이미지를 사용합니다. DB 이름/사용자/비밀번호와 이미지 버전은 루트 `.env`에서 관리합니다.

## test 테이블

| 컬럼 | 타입 | 역할 |
| --- | --- | --- |
| id | INTEGER | 자동 생성 기본 키 |
| message | TEXT | 중복되지 않는 메시지 |

초기화 SQL이 `Hello PostgreSQL` 메시지를 한 건 넣습니다. 같은 SQL을 다시 실행해도 기존 테이블과 데이터를 유지합니다.

## 초기화 SQL 적용

Compose는 `db/init/`을 컨테이너의 `/docker-entrypoint-initdb.d/`에 연결합니다. PostgreSQL 공식 이미지는 **빈 데이터 볼륨을 처음 초기화할 때만** 이 폴더의 SQL을 실행합니다. [공식 이미지 설명](https://hub.docker.com/_/postgres)

이미 DB 볼륨이 있으면 다음 명령으로 적용합니다. DB를 삭제할 필요는 없습니다.

```bash
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < db/init/01-test.sql
```

## 조회 쿼리 실행

프로젝트 루트에서 실행합니다. 접속 정보는 DB 컨테이너의 환경변수에서 읽습니다.

```bash
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < db/queries/test.sql
```

`id`와 `Hello PostgreSQL` 메시지가 표시되면 테이블 생성과 조회가 정상입니다. Django의 `/api/test/`에서도 이 테이블을 조회할 수 있습니다.

## API로 조회

접속 경로: **http://localhost:8080/api/test/**

```bash
curl http://localhost:8080/api/test/
```

샘플 데이터가 있는 경우 응답:

```json
{
  "results": [
    { "id": 1, "message": "Hello PostgreSQL" }
  ]
}
```

행이 없으면 results는 빈 배열입니다. 조회는 GET으로 요청합니다. HEAD/OPTIONS도 지원하며 POST/PUT/DELETE는 HTTP 405로 거부합니다. DB가 준비되지 않았거나 테이블이 없으면 HTTP 503을 반환합니다. 이 경우 위 초기화 SQL 적용 명령과 `docker compose logs backend db`로 확인합니다.

Swagger UI에서도 조회할 수 있습니다. [API 문서 사용법](api.md)을 참고하세요.
