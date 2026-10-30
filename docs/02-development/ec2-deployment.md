# 현재 DB를 EC2에 옮기고, 같은 DB로 계속 재배포하기

[문서 목록](../README.md) · [설정값 관리](configuration.md)

**처음에는 현재 DB 내용을 EC2에 한 번 복원합니다. 그다음부터는 코드만 바꾸고, EC2의 같은 DB 폴더를 계속 연결합니다.**

## EC2에서 코드를 두는 곳과 데이터를 두는 곳

| EC2의 실제 경로 | 저장하는 내용 | 재배포 때 처리 |
| --- | --- | --- |
| `/srv/coc-dashboard/app` | Git에서 받은 프로그램 코드와 `.env` | 코드 갱신, 기존 `.env` 유지 |
| `/srv/coc-dashboard/data/postgres` | PostgreSQL의 실제 DB 파일 전체 | 그대로 유지·계속 연결 |
| `/srv/coc-dashboard/data/media` | 게시판 첨부파일 | 그대로 유지·계속 연결 |
| `/srv/coc-dashboard/backups` | 이전용 백업과 배포 전 백업 | 그대로 유지 |

DB 컨테이너 안의 `/var/lib/postgresql/data`는 **EC2의 `/srv/coc-dashboard/data/postgres`에 연결**됩니다. 컨테이너를 지우고 새로 만들어도 EC2의 이 폴더는 남고, 새 컨테이너가 같은 폴더를 다시 읽습니다. 운영 중 추가·수정한 데이터도 이곳에 저장됩니다.

이 연결은 `compose.ec2.yaml`에 설정했습니다. EC2의 `.env`에 아래 한 줄을 넣으면 일반 `docker compose` 명령과 `tools/deploy.py` 모두 이 설정을 사용합니다.

```dotenv
COMPOSE_FILE=compose.yaml:compose.ec2.yaml
```

로컬 컴퓨터는 `compose.yaml`만 사용하므로 현재 로컬 DB의 저장 공간은 바뀌지 않습니다.

## A. 현재 데이터를 EC2로 처음 옮기기 — 한 번만 실행

아래는 **Ubuntu EC2**, SSH 사용자 `ubuntu` 기준입니다. EC2에 Docker Engine, Docker Compose v2.17 이상, Python 3.9 이상, Git이 준비되어 있어야 합니다. `<EC2_IP>`, `<키.pem>`, `<저장소_URL>`, `<백업폴더명>`은 실제 값으로 바꿉니다. 각 명령이 성공한 뒤 다음 명령을 실행합니다.

### 1. EC2 터미널: 폴더와 코드 준비

로컬 터미널에서 EC2에 접속합니다.

```bash
ssh -i <키.pem> ubuntu@<EC2_IP>
```

EC2 터미널에서 처음 한 번 폴더를 만듭니다. `/srv/coc-dashboard`가 아직 없는 새 서버 기준입니다.

```bash
sudo mkdir -p /srv/coc-dashboard
sudo chown "$USER":"$USER" /srv/coc-dashboard
mkdir -p /srv/coc-dashboard/backups
chmod 700 /srv/coc-dashboard/backups
git clone <저장소_URL> /srv/coc-dashboard/app
```

저장소에는 이번 `compose.ec2.yaml`과 `tools/deploy.py` 변경이 포함되어 있어야 합니다. 데이터 폴더는 뒤의 `init-storage` 명령이 준비합니다.

### 2. 로컬 터미널: 현재 DB를 백업

**현재 데이터가 들어 있는 내 컴퓨터**의 프로젝트 최상위에서 실행합니다.

```bash
python3 tools/deploy.py backup
```

현재 DB의 테이블·내용·로그인 계정·관리자 권한·댓글·개인 설정과 첨부파일을 백업합니다. 백업 중에는 backend를 잠시 멈췄다가 다시 켭니다. 로컬 DB는 그대로 남습니다.

완료 메시지에 `.backups/20261030T...-...` 같은 폴더가 나옵니다. **그 폴더 이름을 아래 `<백업폴더명>`에 넣습니다.** 폴더 안에는 `database.dump`, `media.tar.gz`, `manifest.json` 세 파일이 있습니다. 이전할 최종 시점의 데이터로 백업하고, 이후 EC2로 접속을 전환할 때까지 원본에 새 데이터를 입력하지 않습니다.

### 3. 로컬 터미널: 백업과 현재 `.env`를 EC2에 전송

```bash
scp -i <키.pem> -r .backups/<백업폴더명> ubuntu@<EC2_IP>:/srv/coc-dashboard/backups/
scp -i <키.pem> .env ubuntu@<EC2_IP>:/srv/coc-dashboard/app/.env
```

이 `.env` 전송은 **새 EC2의 최초 설정 때만** 실행합니다. 이미 운영 중인 EC2의 `.env`를 로컬 설정으로 덮어쓰지 않습니다. `.env`와 백업은 Git에 올리지 않습니다.

### 4. EC2 터미널: EC2에서 사용할 저장 경로와 접속 주소 설정

```bash
cd /srv/coc-dashboard/app
chmod 600 .env
nano .env
```

기존 DB 이름·사용자·비밀번호·이미지 버전·Django 서명 키는 유지하고, 다음 항목을 추가하거나 해당 줄의 값을 수정합니다. 같은 이름을 중복해서 추가하지 않습니다. `<EC2_IP>`는 실제 공인 IP로 바꿉니다.

```dotenv
COMPOSE_FILE=compose.yaml:compose.ec2.yaml
POSTGRES_DATA_PATH=/srv/coc-dashboard/data/postgres
MEDIA_DATA_PATH=/srv/coc-dashboard/data/media

FRONTEND_BIND_ADDRESS=0.0.0.0
FRONTEND_PORT=80
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend,<EC2_IP>
DJANGO_CSRF_TRUSTED_ORIGINS=http://<EC2_IP>
DEVELOPMENT_AUTH_BYPASS=false
```

도메인을 쓰면 IP 대신 실제 도메인을 넣습니다. `DJANGO_ALLOWED_HOSTS`에는 호스트명만, `DJANGO_CSRF_TRUSTED_ORIGINS`에는 프로토콜을 포함한 실제 브라우저 주소를 넣습니다. EC2 보안 그룹에는 웹 포트 `80`과 관리용 SSH를 허용합니다. DB 포트는 기존처럼 EC2 내부 `127.0.0.1`에만 연결됩니다.

### 5. EC2 터미널: 현재 데이터를 복원하고 실행

```bash
docker compose config --quiet
python3 tools/deploy.py init-storage
docker compose up -d --wait db
python3 tools/deploy.py restore /srv/coc-dashboard/backups/<백업폴더명>
docker compose up --build -d --wait --wait-timeout 180
docker compose ps
```

- `init-storage`: EC2에 위에서 지정한 데이터 폴더를 만듭니다. 기존 파일은 삭제하지 않습니다.
- `up ... db`: DB만 먼저 켜서 복원할 준비를 합니다.
- `restore`: 내 컴퓨터에서 가져온 DB 내용과 첨부파일을 EC2에 넣습니다. 기존 데이터가 있는 대상에는 덮어쓰지 않으며 백업 파일과 복원한 테이블별 행 수를 검증합니다.
- 마지막 `up`: 복원된 DB를 연결한 상태로 프로그램을 켭니다. 필요한 Django 마이그레이션을 적용하며 샘플 데이터는 만들지 않습니다.

**복원이 끝나기 전에 backend를 먼저 켜지 않습니다.** 먼저 켜면 DB에 실행 기록 등이 생겨 빈 DB 보호 검사에 걸립니다.

### 6. EC2 터미널과 브라우저: 실제 저장 위치와 데이터 확인

아래 명령은 비밀번호 없이 DB 컨테이너가 연결한 실제 EC2 경로만 출력합니다.

```bash
docker inspect "$(docker compose ps -q db)" --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Source}}{{end}}{{end}}'
```

출력이 다음과 같으면 요청한 위치에 연결된 것입니다.

```text
/srv/coc-dashboard/data/postgres
```

브라우저에서 `http://<EC2_IP>`에 접속해 **기존 계정으로 로그인**하고 현재 데이터·댓글·첨부파일을 확인합니다. 이후 입력하는 데이터도 이 EC2 경로에 계속 저장됩니다.

## B. 새 버전의 코드를 재배포하기 — 이후에는 이것만 실행

**운영 중인 EC2 터미널**에서 실행합니다. 배포할 코드가 `main` 브랜치에 반영되어 있는 예시입니다.

```bash
cd /srv/coc-dashboard/app
git pull --ff-only origin main
python3 tools/deploy.py deploy --backup-dir /srv/coc-dashboard/backups
```

다른 브랜치로 운영한다면 `main`을 해당 브랜치로 바꿉니다. Git 업데이트가 실패하면 배포 명령을 실행하지 말고 먼저 해결합니다.

이 명령은 새 코드 빌드 → 기존 운영 DB·첨부파일 백업 → 컨테이너 재생성 → 상태 확인을 수행합니다. **DB는 계속 `/srv/coc-dashboard/data/postgres`를 사용합니다.** 최초에 가져온 로컬 백업을 다시 복원하지 않습니다. EC2 운영 중 새로 쌓인 데이터도 그대로 이어서 사용합니다. 재기동 동안 짧은 중단은 있습니다.

재배포 때 유지해야 할 것은 다음과 같습니다.

- EC2의 기존 `.env`와 `COMPOSE_FILE`, `POSTGRES_DATA_PATH`, `MEDIA_DATA_PATH` 설정.
- `/srv/coc-dashboard/data` 전체. 코드 폴더를 새로 준비하더라도 이 폴더는 유지합니다.
- 기존 DB 이름·사용자·비밀번호. `.env`만 바꿔도 이미 생성된 DB 계정은 자동 변경되지 않습니다.
- PostgreSQL 17 계열. 메이저 버전 업그레이드는 별도 이전 작업으로 진행합니다.

`restore`는 최초 이전 때만 사용합니다. 평소 배포에 데이터 폴더 삭제·DB 초기화·`down -v`를 넣지 않습니다. DB 구조를 바꾸는 새 마이그레이션은 적용되므로, 데이터 삭제를 포함한 마이그레이션은 배포 전에 별도로 확인해야 합니다. 배포 실패 시 기존 데이터와 사전 백업을 보존하며 자동 덮어쓰기나 자동 롤백은 하지 않습니다.

## 코드 재배포와 EC2 자체 삭제는 구분합니다

위 설정은 **같은 EC2에서 코드를 재배포할 때 같은 DB 경로를 계속 사용하는 구성**입니다. EC2 자체 삭제까지 대비하려면 해당 경로가 있는 EBS의 `종료 시 삭제`를 끄고, 백업을 서버 외부에도 보관합니다. [AWS EBS 보존 안내](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/preserving-volumes-on-termination.html)

[Docker 경로 연결 설명](https://docs.docker.com/engine/storage/bind-mounts/) · [Compose 설정 병합](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/)
