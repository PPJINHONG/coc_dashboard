# 프로젝트 켜고 끄기

[문서 목록](../README.md) · [쉬운 용어 사전](../01-start/glossary.md)

**처음 실행하거나, 코드를 수정한 뒤 다시 실행할 때** 읽습니다. 여기 있는 명령은 모두 `compose.yaml`이 있는 프로젝트 최상위 폴더에서 실행합니다.

## 1. 실행 준비

Docker Desktop을 켭니다. Docker Engine을 따로 쓰는 환경이라면 Engine이 실행 중이어야 합니다. 현재 프로젝트는 Docker Compose v2.17 이상을 사용합니다.

VS Code에서 `coc_dashboard` 폴더를 열고 **Terminal → New Terminal**로 터미널을 엽니다. 아래 명령으로 현재 폴더를 확인합니다.

```bash
pwd
```

마지막 부분이 `coc_dashboard`이고, 그 폴더에서 `compose.yaml`을 찾을 수 있으면 됩니다. 오류가 나면 다음 명령으로 넘어가지 말고 원인부터 확인합니다.

## 2. 내 컴퓨터의 설정 파일 준비

`.env`는 로컬과 EC2가 같은 내용을 쓰는 설정 파일입니다. Git에는 올리지 않으므로 팀원에게 받아 프로젝트 최상위 폴더에 둡니다. 설정을 바꿀 때는 [설정값 관리](configuration.md)를 읽습니다.

## 3. 설정 확인 후 켜기

먼저 설정 파일을 읽을 수 있는지 확인합니다. 비밀값은 출력하지 않습니다.

```bash
docker compose config --quiet
```

아무 메시지 없이 끝나면 검사에 통과한 것입니다. 오류가 있으면 설정을 수정한 뒤 다시 확인합니다.

그다음 프로젝트를 켭니다.

```bash
docker compose up --build -d
```

처음 실행하면 DB 볼륨(`coc-dashboard_postgres_data`)과 첨부파일 볼륨(`coc-dashboard_media_data`)이 자동으로 만들어집니다. 빈 DB에는 테이블 구조와 관리자 계정 `admin` / `admin`만 생깁니다. 이미 볼륨이 있으면 기존 데이터를 그대로 사용합니다.

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
docker compose down
docker compose up --build -d
```

상대방의 새 코드를 Git으로 가져온 뒤에도 같은 방법으로 반영합니다. DB·첨부파일은 볼륨에 남아 있고, backend가 켜질 때 새 마이그레이션(테이블 구조 변경)이 자동으로 적용됩니다.

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

`docker compose down -v`는 쓰지 않습니다. `-v`를 붙이면 DB·첨부파일 볼륨까지 삭제됩니다.

EC2도 같은 명령으로 배포합니다. [EC2 배포](ec2-deployment.md)를 참고하세요.
