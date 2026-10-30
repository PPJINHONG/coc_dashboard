# 프로젝트 켜고 끄기

[문서 목록](../README.md) · [쉬운 용어 사전](../01-start/glossary.md)

**처음 실행하거나, 코드를 수정한 뒤 다시 실행할 때** 읽습니다. 여기 있는 명령은 모두 `compose.yaml`이 있는 프로젝트 최상위 폴더에서 실행합니다.

## 1. 실행 준비

Docker Desktop을 켭니다. Docker Engine을 따로 쓰는 환경이라면 Engine이 실행 중이어야 합니다. 현재 프로젝트는 Docker Compose v2.17 이상과 Python 3.9 이상을 사용합니다.

VS Code에서 `coc_dashboard` 폴더를 열고 **Terminal → New Terminal**로 터미널을 엽니다. 아래 명령으로 현재 폴더를 확인합니다.

```bash
pwd
```

마지막 부분이 `coc_dashboard`이고, 그 폴더에서 `compose.yaml`을 찾을 수 있으면 됩니다. 오류가 나면 다음 명령으로 넘어가지 말고 원인부터 확인합니다.

## 2. 내 컴퓨터의 설정 파일 준비

`.env.example`은 팀원에게 공유하는 빈 양식이고, `.env`는 내 컴퓨터가 실제로 사용하는 설정 파일입니다.

아래 명령은 `.env`가 없을 때만 양식을 복사합니다. 이미 있으면 그대로 둡니다.

```bash
if [ ! -f .env ]; then
  cp .env.example .env
fi
```

별도 문구 없이 끝나도 정상입니다. `.env`의 실제 비밀번호나 키는 GitHub에 올리지 않습니다. 설정을 바꿀 때는 [설정값 관리](configuration.md)를 읽습니다.

## 3. 설정 확인 후 켜기

먼저 설정 파일을 읽을 수 있는지 확인합니다. 비밀값은 출력하지 않습니다.

```bash
docker compose config --quiet
```

아무 메시지 없이 끝나면 검사에 통과한 것입니다. 오류가 있으면 설정을 수정한 뒤 다시 확인합니다.

그다음 프로젝트를 켭니다.

```bash
python3 tools/deploy.py init-storage
docker compose up --build -d
```

`init-storage`는 최초 설치에서만 외부 DB·첨부파일 볼륨을 준비합니다. 기존 볼륨은 그대로 유지합니다. 기존 서버의 볼륨을 찾지 못하면 이름을 먼저 확인하고, 새 볼륨을 만들어 대신 사용하지 않습니다. 현재 데이터와 함께 EC2로 옮길 때는 [EC2 배포와 데이터 보존](ec2-deployment.md)의 복원 순서를 따릅니다.

기존 버전이 실행 중이라면 이 변경을 처음 반영할 때도 5단계의 `deploy`를 사용합니다. 기존 컨테이너 안의 첨부파일을 백업하고 새 영구 볼륨으로 옮긴 뒤 컨테이너를 재생성합니다.

- `up`: 필요한 컨테이너를 만들고 실행합니다.
- `--build`: 현재 코드를 반영해 실행에 필요한 묶음을 만듭니다.
- `-d`: 실행을 유지하면서 터미널은 다른 명령에 쓸 수 있게 합니다.

처음에는 필요한 프로그램을 내려받아 시간이 걸릴 수 있습니다. 끝나면 실행 상태를 확인합니다.

```bash
docker compose ps
```

`frontend`, `backend`, `db`가 실행 중인지 봅니다. `Up` 또는 `running`은 실행 중이라는 뜻입니다. 이것만으로 모든 기능이 정상이라고 판단하지 말고 브라우저에서도 확인합니다.

## 4. 브라우저에서 확인

| 확인할 것 | 주소 |
| --- | --- |
| 기본 화면 | http://localhost:8080 |
| 서버 기본 화면 | http://localhost:8080/backend/ |
| 데이터 조회 | http://localhost:8080/api/operations/current/ |
| 데이터 요청 안내 화면 | http://localhost:8080/api/docs/ |

켜자마자 연결되지 않으면 잠시 후 다시 확인합니다. DB가 실제 요청을 받을 준비가 되기 전에 서버가 켜질 수 있습니다.

## 5. 코드를 수정한 뒤 반영

현재 구성에서는 파일을 저장하는 것만으로 실행 중인 화면이 갱신되지는 않습니다. 아래 명령을 다시 실행하고 브라우저를 새로고침합니다.

```bash
python3 tools/deploy.py deploy
```

상대방의 새 코드를 Git으로 가져온 뒤에도 같은 방법으로 반영합니다. 기존 DB가 실행된 상태에서 새 이미지 빌드 → DB·첨부파일 백업 → 컨테이너 재생성 → 상태 검사 순서로 처리합니다. 백업은 Git에서 제외된 `.backups/`에 저장합니다.

## 6. 안 켜지거나 오류가 생겼을 때

실행 기록을 확인합니다.

```bash
docker compose logs --tail=100 frontend backend db
```

마지막 기록에서 `error`, `failed`와 관련된 내용을 찾습니다. 기록을 상대에게 전달할 때 실제 키나 비밀번호가 포함되지 않았는지 확인합니다.

| 상황 | 먼저 확인할 것 |
| --- | --- |
| Docker에 연결할 수 없다는 오류 | Docker Desktop이 켜져 있는지 |
| 설정값이 없다는 오류 | `.env`와 [설정 안내](configuration.md) |
| 8080 번호를 이미 사용 중이라는 오류 | 다른 프로그램이 같은 번호를 쓰는지 |
| 화면은 열리는데 데이터 조회 실패 | [DB 확인 방법](database.md) |
| 코드를 바꿨는데 예전 화면 | 5단계 실행 후 브라우저 새로고침 여부 |

접속 번호를 바꿔야 한다면 `.env`의 `FRONTEND_PORT`와 `DJANGO_CSRF_TRUSTED_ORIGINS`를 함께 바꿉니다. [설정 안내](configuration.md)를 참고하고 이후 브라우저 주소에도 바꾼 번호를 사용합니다.

## 7. 작업을 마치고 끄기

```bash
docker compose down
```

프로젝트 컨테이너를 종료하고 제거합니다. DB 데이터는 별도의 저장 공간인 볼륨에 남기므로 다시 켤 때 이어서 사용합니다.

현재 DB·첨부파일은 외부 볼륨이므로 Compose 삭제 대상에서 제외됩니다. 그래도 배포·종료 명령에는 `-v`를 붙이지 않으며 Docker 볼륨을 직접 삭제하지 않습니다.

이 문서는 로컬 실행 기준입니다. EC2는 `compose.ec2.yaml`을 함께 적용해 코드 밖의 고정 폴더(`/srv/coc-dashboard/data/postgres`)에 DB를 저장합니다. [최초 이전과 이후 재배포 순서](ec2-deployment.md)를 따릅니다.
