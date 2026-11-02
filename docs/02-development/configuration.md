# 설정값과 사용하는 프로그램 관리

[문서 목록](../README.md) · [쉬운 용어 사전](../01-start/glossary.md)

**DB 이름, 비밀번호, 접속 주소, 실행 프로그램 버전을 바꿀 때** 읽습니다.

## 1. 어느 파일을 바꾸나요?

| 파일 | 용도 | GitHub에 올리나요? |
| --- | --- | --- |
| `.env` | 비밀번호·키·접속 주소. 로컬과 EC2가 같은 내용을 사용 | 아니요. 팀이 직접 공유 |
| `compose.yaml` | 로컬(개발) 실행 파일. 이미지 버전, 데이터는 Docker 볼륨 | 예 |
| `compose.prod.yaml` | EC2 운영 실행 파일. 데이터는 `/srv_db`. `-f compose.prod.yaml`로 사용 | 예 |

서비스 설정(이미지 버전, 환경변수, 포트 등)을 바꿀 때는 `compose.yaml`과 `compose.prod.yaml`을 함께 바꿉니다.

`.env`를 바꾸면 로컬과 EC2의 `.env`를 같이 바꿉니다.

## 2. `.env` 설정 이름

값 자체는 이 문서에 적지 않습니다.

| 이름 | 설명 |
| --- | --- |
| `POSTGRES_DB` | DB 이름 |
| `POSTGRES_USER` | DB 접속 사용자 |
| `POSTGRES_PASSWORD` | DB 접속 비밀번호 |
| `POSTGRES_PORT` | 같은 PC/EC2 안에서 DB에 직접 접속할 포트. `127.0.0.1`에만 열립니다. 기본 `5433` |
| `DJANGO_SECRET_KEY` | 서버가 로그인 세션 서명에 쓰는 키. 바꾸면 모두 다시 로그인해야 합니다 |
| `FRONTEND_BIND_ADDRESS` | 웹 연결을 받을 주소. ALB가 EC2로 연결하려면 `0.0.0.0` |
| `FRONTEND_PORT` | 웹 포트. 기본 `8080`. ALB 대상 그룹 포트와 같아야 합니다 |
| `DJANGO_ALLOWED_HOSTS` | 브라우저 접속 호스트명(쉼표 구분, `http://`·포트 제외). localhost와 ALB DNS를 함께 넣습니다 |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | 로그인 요청을 허용할 접속 주소(쉼표 구분, `http://` 포함). `http://localhost:8080`과 `http://ALB_DNS`를 함께 넣습니다 |
| `DEVELOPMENT_AUTH_BYPASS` | `true`면 로그인 없이 조회. 기본 `false` |

`POSTGRES_DB`·`POSTGRES_USER`·`POSTGRES_PASSWORD`는 DB를 처음 만들 때만 적용됩니다. 이미 있는 DB의 비밀번호는 `.env`를 바꿔도 자동으로 바뀌지 않습니다.

`FRONTEND_BIND_ADDRESS=0.0.0.0`이면 로컬 PC에서도 같은 네트워크의 다른 기기가 8080으로 접속할 수 있습니다.

## 3. 이미지 버전

Python·Node.js·Nginx·PostgreSQL 이미지 버전은 `compose.yaml`에 적혀 있습니다. 태그는 사람이 읽는 버전이고 `@sha256:`은 정확한 이미지 내용을 고정합니다. 업데이트할 때는 태그와 digest를 함께 바꿉니다. PostgreSQL은 17 계열을 유지합니다. 메이저 버전 변경은 별도 데이터 이전 작업이 필요합니다.

## 4. 참고

현재 환경은 `DEVELOPMENT_AUTH_BYPASS=false`로 로그인·회원가입을 사용합니다. 데이터 수정은 실제 관리자의 DB 탭에서만 가능합니다. 운영 데이터의 DB 접속·init 구조는 [운영 데이터 설계](operations.md), 관리자 화면은 [관리자 DB 관리](database-admin.md)를 참고하세요. 배포는 [EC2 배포](ec2-deployment.md)를 따릅니다.

터미널에서 같은 이름으로 설정한 환경변수는 `.env`보다 우선합니다.
