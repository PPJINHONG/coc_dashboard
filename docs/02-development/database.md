# 데이터 확인과 DB 접속

현재 서비스는 주·월 구분 없이 최신 운영 데이터를 한 PostgreSQL DB에 저장합니다. 테이블별 역할은 [운영 데이터 설계](operations.md)를 참고하세요.

## 웹에서 확인

- 일반 기능 탭: 인프라 자원·운영 인력·운영 작업·이슈의 최신값 조회 전용.
- 관리자 **DB 관리 → 기능별 설정**: 업무 데이터, 사용자·권한·댓글 관리.
- 관리자 **DB 관리 → 원본 테이블 조회**: 같은 원본 테이블을 읽기 전용으로 확인.
- `http://localhost:8080/api/operations/current/`: 현재 데이터와 합계. 개발 모드가 아니면 로그인이 필요합니다.

기준정보와 임시 수량을 자동으로 넣지 않습니다. 새 설치에서는 관리자가 DB 관리 → 공통데이터에서 리전·서비스·인력을 먼저 등록합니다. 과거 연결 확인용 `test` 테이블·API·샘플 SQL·데모 계정 생성 명령은 제거했습니다.

## 로컬 PostgreSQL 확장에서 확인

| 항목 | 값 |
| --- | --- |
| Host | `127.0.0.1` |
| Port | `.env`의 `POSTGRES_PORT` (기본 `5433`) |
| Database | `.env`의 `POSTGRES_DB` |
| User | `.env`의 `POSTGRES_USER` |
| Password | `.env`의 `POSTGRES_PASSWORD` |
| Schema | `public` |
| SSL | 끄기 |

웹 로그인 계정은 PostgreSQL 접속 계정과 별개입니다. Mac의 VS Code는 공개한 호스트 포트를 사용하고, 같은 Docker 네트워크 안의 서버는 `db:5432`를 사용합니다.

```bash
docker compose port db 5432
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

연결이 안 되면 `docker compose ps`로 DB 상태와 공개 포트를 확인합니다. 비밀번호 변경은 기존 볼륨에 자동 적용되지 않으므로 실제 DB 계정과 `.env`가 같은지 확인합니다. 연결 문제를 해결하려고 볼륨을 삭제하지 않습니다.

## 구조와 초기화

모델 변경은 Django 마이그레이션으로 적용합니다. `db/init/02-current-operations.sql`은 신규 설치용 운영 테이블, `db/init/05-db-admin.sql`은 관리자 변경 이력 테이블입니다. 기존 볼륨에 init SQL을 다시 실행하지 않습니다. 서버 시작 시 `migrate --fake-initial --noinput`을 실행하며 샘플 생성은 하지 않습니다.
