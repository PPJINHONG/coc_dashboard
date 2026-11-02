# EC2 배포

[문서 목록](../README.md) · [설정값 관리](configuration.md)

**EC2는 운영 전용 `compose.prod.yaml`로 실행합니다.** 로컬은 `compose.yaml`을 씁니다. `.env`는 로컬과 EC2가 같습니다. DB·첨부파일은 EC2의 `/srv_db`에 저장되고, 배포할 때는 코드만 바꿉니다.

| 위치 | 내용 | 배포 때 |
| --- | --- | --- |
| `/srv/coc-dashboard/app` | Git에서 받은 코드와 `.env` | `git pull`로 갱신 |
| `/srv_db/postgres` | 운영 DB 파일 | 그대로 유지 |
| `/srv_db/media` | 게시판 첨부파일 | 그대로 유지 |

## 평소 배포

```bash
cd /srv/coc-dashboard/app
git pull --ff-only origin main
docker compose -f compose.prod.yaml down
docker compose -f compose.prod.yaml up --build -d
docker compose -f compose.prod.yaml ps
```

- EC2에서는 모든 `docker compose` 명령에 `-f compose.prod.yaml`을 붙입니다. 실수로 빼고 `up` 하면 포트가 이미 사용 중이라 실패하고, 운영 컨테이너는 그대로 둡니다.
- backend가 켜질 때 Django 마이그레이션(테이블 구조 변경)이 자동으로 적용됩니다. `/srv_db`의 데이터는 그대로 남습니다.
- `/srv_db/postgres` 폴더가 없으면(디스크가 연결되지 않은 경우 등) 빈 DB를 만들지 않고 실행을 멈춥니다.
- 컬럼·테이블을 지우는 마이그레이션이 들어간 배포라면 배포 전에 스냅샷을 먼저 만듭니다.

로그 확인 같은 다른 명령도 같은 형식입니다. 예: `docker compose -f compose.prod.yaml logs --tail=100 backend`

## 관리자 계정

backend가 켜질 때 `admin` 계정이 없으면 `admin` / `admin` 관리자 계정을 만듭니다. 이미 있으면 비밀번호를 포함해 아무것도 바꾸지 않습니다. 관리자만 `@` 없는 아이디를 쓰고, 다른 계정은 이메일 아이디를 사용합니다.

## 한 번만: Docker 볼륨의 데이터를 `/srv_db`로 옮기기

지금 운영 데이터는 Docker 볼륨 `coc-dashboard_postgres_data`에 있고, `compose.yaml`(`-f` 없음)로 실행 중입니다. 아래 순서로 한 번만 `/srv_db`로 옮깁니다. 이 작업 없이 `compose.prod.yaml`로 `up` 하면 `/srv_db/postgres`가 비어 있어 **빈 DB로 시작합니다.**

**문서의 ```` ``` ```` 줄은 복사하지 말고 명령 줄만 한 줄씩 붙여 넣습니다.** 오류가 나면 다음으로 넘어가지 않습니다.

### 1. 스냅샷

AWS 콘솔에서 EC2 스냅샷을 만듭니다. `/srv_db`가 별도 EBS라면 그 볼륨도 스냅샷 대상에 포함합니다.

### 2. 현재 데이터와 서버 상태 확인

```bash
cd /srv/coc-dashboard/app
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select username, is_staff from auth_user;" -c "select count(*) from ops_regions;"'
df -h /srv_db
getenforce
```

- 계정 목록에 기존 사용자가 있고 리전 개수가 0보다 커야 합니다. 아니라면 멈추고 먼저 확인합니다.
- `df -h /srv_db`는 `/srv_db`가 어느 디스크에 있는지 보여 줍니다. 별도 EBS를 붙였다면 재부팅 후에도 자동으로 연결되도록 `/etc/fstab`에 등록되어 있어야 합니다.
- `getenforce`가 `Enforcing`이면 멈춥니다. 컨테이너가 `/srv_db`에 접근하지 못할 수 있습니다. `Permissive`나 `Disabled`면 그대로 진행합니다.

### 3. 기존 실행 종료, 새 코드, 폴더 준비

기존 실행은 `compose.yaml`로 띄운 것이므로 이번 한 번만 `-f` 없이 종료합니다.

```bash
docker compose down
git pull --ff-only origin main
sudo mkdir -p /srv_db/postgres /srv_db/media
docker compose -f compose.prod.yaml config | grep srv_db
docker compose -f compose.prod.yaml build
```

`grep` 결과에 `source: /srv_db/postgres`와 `source: /srv_db/media`가 나와야 합니다.

### 4. 복사

```bash
docker compose -f compose.prod.yaml run --rm --no-deps -v coc-dashboard_postgres_data:/from:ro --entrypoint sh db -c 'test -z "$(ls -A /var/lib/postgresql/data)" && cp -a /from/. /var/lib/postgresql/data/ && echo DB_COPY_OK'
docker compose -f compose.prod.yaml run --rm --no-deps -v coc-dashboard_media_data:/from:ro --entrypoint sh backend -c 'test -z "$(ls -A /app/media)" && cp -a /from/. /app/media/ && echo MEDIA_COPY_OK'
```

각각 `DB_COPY_OK`, `MEDIA_COPY_OK`가 **화면에 나와야** 다음으로 진행합니다. 대상 폴더가 비어 있지 않으면 복사하지 않고 실패합니다. 원본 Docker 볼륨은 읽기 전용으로 연결하므로 바뀌지 않습니다.

### 5. 실행과 확인

```bash
docker compose -f compose.prod.yaml up -d --wait --wait-timeout 180
docker compose -f compose.prod.yaml ps
docker inspect "$(docker compose -f compose.prod.yaml ps -q db)" --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}'
docker compose -f compose.prod.yaml exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select username, is_staff from auth_user;" -c "select count(*) from ops_regions;"'
```

- `docker inspect` 결과에 `/srv_db/postgres -> /var/lib/postgresql/data`가 나와야 합니다.
- 계정 목록과 리전 개수가 2단계 결과와 같아야 합니다.
- 브라우저에서 ALB 주소로 로그인해 데이터를 확인합니다.

### 6. 정리 (며칠 운영 후)

문제가 없으면 예전 저장 위치를 지웁니다. 지우기 전에 스냅샷이 있는지 한 번 더 확인합니다.

```bash
docker volume rm coc-dashboard_postgres_data coc-dashboard_media_data
sudo rm -rf /srv/coc-dashboard/data /srv/coc-dashboard/backups
```

`/srv/coc-dashboard/app`과 `/srv_db`는 지우지 않습니다.

## 서버를 새로 만들 때

코드를 받고 `.env`를 넣은 뒤, 폴더를 한 번 만들고 평소 배포 명령을 사용합니다.

```bash
sudo mkdir -p /srv_db/postgres /srv_db/media
```

`/srv_db/postgres`가 비어 있으면 처음 실행할 때 빈 DB와 `admin` 계정이 만들어집니다. 기존 데이터를 쓰려면 스냅샷에서 `/srv_db`를 복원합니다.
