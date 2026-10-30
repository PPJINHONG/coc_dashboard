# 설정값과 사용하는 프로그램 관리

[문서 목록](../README.md) · [쉬운 용어 사전](../01-start/glossary.md)

**DB 이름, 비밀번호, 실행 프로그램 버전을 바꿀 때** 읽습니다. 환경변수는 코드 안에 직접 적는 대신 바깥에서 전달하는 설정값을 뜻합니다.

## 1. 어느 파일을 바꾸나요?

| 파일 | 용도 | GitHub에 올리나요? |
| --- | --- | --- |
| `.env` | 내 컴퓨터에서 실제 사용하는 값 | 아니요 |
| `.env.example` | 팀원이 보고 준비하는 공통 양식 | 예 |
| `compose.yaml` | 어떤 프로그램을 어떤 설정으로 실행할지 정하는 파일 | 예 |

세 파일은 모두 프로젝트 최상위 폴더에 있습니다. `.env`가 처음부터 없다면 [실행 안내](docker-compose.md)의 2단계로 만듭니다. 이미 있는 `.env`에 양식을 덮어쓰면 내 설정을 잃을 수 있으므로 필요한 항목만 직접 반영합니다.

## 2. 설정 이름은 무엇을 뜻하나요?

값 자체는 이 문서에 적지 않습니다. 각자 `.env`에서 확인합니다.

| 이름 | 쉬운 설명 |
| --- | --- |
| `POSTGRES_DB` | 사용할 데이터 보관소의 이름 |
| `POSTGRES_USER` | DB에 접속할 사용자 이름 |
| `POSTGRES_PORT` | 로컬 PC에서 DB에 직접 접속할 포트. 기본 `5433` |
| `POSTGRES_PASSWORD` | DB 접속 비밀번호 |
| `COMPOSE_FILE` | 로컬 `compose.yaml`, EC2 `compose.yaml:compose.ec2.yaml`로 고정 경로 설정까지 적용 |
| `POSTGRES_DATA_PATH` | EC2의 실제 DB 폴더. 기본 `/srv/coc-dashboard/data/postgres`. 재배포 때 같은 경로 유지 |
| `MEDIA_DATA_PATH` | EC2의 실제 첨부파일 폴더. 기본 `/srv/coc-dashboard/data/media`. 재배포 때 같은 경로 유지 |
| `POSTGRES_VOLUME_NAME` | 로컬 DB 외부 볼륨 이름. 기본 `coc-dashboard_postgres_data`. EC2 경로 연결 모드에서는 사용하지 않음 |
| `MEDIA_VOLUME_NAME` | 로컬 첨부파일 외부 볼륨 이름. 기본 `coc-dashboard_media_data`. EC2 경로 연결 모드에서는 사용하지 않음 |
| `FRONTEND_BIND_ADDRESS` | 웹 공개 주소. 로컬 기본 `127.0.0.1`, EC2 직접 접속 `0.0.0.0` |
| `FRONTEND_PORT` | 웹 접속 포트. 기본 `8080`, EC2 예시 `80` |
| `DJANGO_SECRET_KEY` | 서버가 서명 등에 사용하는 비밀 키 |
| `DJANGO_ALLOWED_HOSTS` | 허용할 호스트명/IP를 쉼표로 구분. 기본 `localhost,127.0.0.1,backend`. 프로토콜·포트는 제외하며 EC2 IP/도메인을 추가 |
| `DEVELOPMENT_AUTH_BYPASS` | `true`이면 개발 중 로그인 없이 운영 데이터를 조회. `false`이면 기존 로그인 복구. 생략 시 `false` |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | 로그인 요청을 허용할 브라우저 접속 주소. 프로토콜·포트를 포함해 쉼표로 구분. 기본 localhost/127.0.0.1:8080이며 EC2 IP·도메인·포트에 맞춰 설정 |
| `PYTHON_IMAGE` | 서버 실행에 쓸 Python 환경 묶음 |
| `NODE_IMAGE` | 화면 코드를 준비할 때 쓸 Node 환경 묶음 |
| `NGINX_IMAGE` | 준비된 화면을 브라우저에 보내는 환경 묶음 |
| `POSTGRES_IMAGE` | DB 실행에 쓸 PostgreSQL 환경 묶음 |

## 3. 새 설정 항목을 추가할 때

현재 환경은 `DEVELOPMENT_AUTH_BYPASS=false`로 로그인·회원가입을 사용합니다. 비로그인 사용자는 로그인 화면으로 이동하며 운영 데이터는 인증된 사용자만 조회합니다. 데이터 수정은 실제 관리자의 DB 탭에서만 가능합니다. 운영 데이터의 DB 접속·init 구조는 [운영 데이터 설계](operations.md)를 참고하세요.

[관리자 DB 관리](database-admin.md)는 개발 모드에서도 실제 관리자 로그인이 필요합니다. 기능별 설정에서 업무 데이터·계정을 관리하고 원본 테이블은 읽기 전용으로 조회합니다.

EC2 최초 데이터 이전, 고정 데이터 폴더 준비, 이후 백업을 포함한 배포는 [EC2 배포와 데이터 보존](ec2-deployment.md)을 따릅니다. `.env`의 기존 값은 유지하고 새 항목만 필요한 경우 추가합니다. 로컬 기본값으로 기존 DB와 로그인 설정을 계속 사용합니다. 터미널에서 같은 이름으로 설정한 환경변수는 `.env`보다 우선할 수 있습니다.
