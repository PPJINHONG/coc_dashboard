# EC2 배포

[문서 목록](../README.md) · [설정값 관리](configuration.md)

**로컬과 EC2는 같은 `compose.yaml`과 같은 `.env`를 사용합니다.** 데이터(DB·첨부파일)는 Docker 볼륨에 있고, 배포할 때는 코드만 바꿉니다.

| 위치 | 내용 | 배포 때 |
| --- | --- | --- |
| `/srv/coc-dashboard/app` | Git에서 받은 코드와 `.env` | `git pull`로 갱신 |
| Docker 볼륨 `coc-dashboard_postgres_data` | 운영 DB | 그대로 유지 |
| Docker 볼륨 `coc-dashboard_media_data` | 게시판 첨부파일 | 그대로 유지 |

백업은 EC2 스냅샷으로 합니다. Docker 볼륨은 루트 디스크의 `/var/lib/docker/volumes/`에 있으므로 스냅샷에 포함됩니다.

## 평소 배포

EC2에 접속해서 실행합니다.

```bash
cd /srv/coc-dashboard/app
git pull --ff-only origin main
docker compose down
docker compose up --build -d
docker compose ps
```

- backend가 켜질 때 Django 마이그레이션(테이블 구조 변경)이 자동으로 적용됩니다. 데이터는 그대로 남습니다.
- `docker compose down -v`는 쓰지 않습니다. `-v`는 DB 볼륨까지 삭제합니다.
- 컬럼·테이블을 지우는 마이그레이션이 들어간 배포라면 배포 전에 EC2 스냅샷을 먼저 만듭니다.
- 빌드가 오래 걸려 서비스가 꺼져 있는 시간을 줄이고 싶다면 `docker compose build`를 `down`보다 먼저 실행합니다.

## 관리자 계정

backend가 켜질 때 `admin` 계정이 없으면 `admin` / `admin` 관리자 계정을 만듭니다. 이미 있으면 비밀번호를 포함해 아무것도 바꾸지 않습니다. 관리자만 `@` 없는 아이디를 쓰고, 다른 계정은 이메일 아이디를 사용합니다.

ALB가 외부에 열려 있으면 누구나 `admin`/`admin`을 시도할 수 있습니다. 비밀번호 변경이나 ALB 보안 그룹의 접속 IP 제한을 권장합니다.

## 한 번만: 기존 폴더 데이터를 Docker 볼륨으로 옮기기

이전 구조는 `compose.ec2.yaml`로 `/srv/coc-dashboard/data/postgres-restored`, `/srv/coc-dashboard/data/media-restored` 폴더를 연결했습니다. 새 구조로 처음 배포할 때 한 번만 아래 순서로 옮깁니다. 이 작업을 하지 않고 `up` 하면 **빈 DB로 시작합니다.**

명령은 한 줄씩 실행하고, 오류가 나면 다음으로 넘어가지 않습니다.

### 1. 시작 전 EC2 스냅샷

AWS 콘솔에서 EC2(루트 볼륨) 스냅샷을 먼저 만듭니다.

### 2. 기존 서비스 종료와 상태 확인

```bash
cd /srv/coc-dashboard/app
docker compose down
docker volume ls | grep coc-dashboard
df -h / /srv
```

`docker volume ls` 결과에 `coc-dashboard_postgres_data`나 `coc-dashboard_media_data`가 **이미 있으면 멈추고** 내용을 먼저 확인합니다. 예전에 만든 빈 볼륨이나 다른 데이터일 수 있습니다. `df -h`로 DB 폴더 크기만큼 디스크 여유가 있는지도 봅니다.

### 3. 새 코드와 `.env` 받기

```bash
git pull --ff-only origin main
```

`.env`를 로컬과 같은 내용으로 바꿉니다. 로컬 터미널에서 보내거나, EC2에서 `nano .env`로 내용을 붙여 넣습니다.

```bash
# 로컬 터미널 (bastion을 거치면 private EC2까지 한 번 더 옮깁니다)
scp -i <키.pem> .env ec2-user@<EC2_IP>:/srv/coc-dashboard/app/.env
```

EC2에서 확인합니다. `COMPOSE_FILE`, `POSTGRES_DATA_PATH`, `MEDIA_DATA_PATH` 줄이 남아 있으면 안 됩니다.

```bash
chmod 600 .env
grep -E "COMPOSE_FILE|DATA_PATH" .env
docker compose config --quiet
docker compose build
```

`grep`은 아무것도 출력하지 않아야 합니다.

### 4. DB와 첨부파일 복사

```bash
docker compose run --rm --no-deps -v /srv/coc-dashboard/data/postgres-restored:/from:ro --entrypoint sh db -c 'test -z "$(ls -A /var/lib/postgresql/data)" && cp -a /from/. /var/lib/postgresql/data/ && echo DB_COPY_OK'
docker compose run --rm --no-deps -v /srv/coc-dashboard/data/media-restored:/from:ro --entrypoint sh backend -c 'test -z "$(ls -A /app/media)" && cp -a /from/. /app/media/ && echo MEDIA_COPY_OK'
```

각각 `DB_COPY_OK`, `MEDIA_COPY_OK`가 나와야 합니다. 대상 볼륨이 비어 있지 않으면 복사하지 않고 실패합니다. 원본 폴더는 읽기 전용으로 연결하므로 바뀌지 않습니다.

### 5. 실행과 확인

```bash
docker compose up -d --wait --wait-timeout 180
docker compose ps
docker compose logs backend | grep 관리자
```

마지막 줄에 `기존 관리자 admin@admin 계정을 admin(으)로 변경했습니다.`가 나옵니다. 브라우저에서 ALB 주소로 접속해 `admin` / `admin`으로 로그인하고 기존 데이터·댓글·첨부파일이 보이는지 확인합니다.

### 6. 정리

며칠 운영해 문제가 없으면 예전 폴더 `/srv/coc-dashboard/data/postgres-restored`, `media-restored`는 지워도 됩니다. 지우기 전에 스냅샷이 있는지 한 번 더 확인합니다.

[Docker 볼륨 설명](https://docs.docker.com/engine/storage/volumes/)
