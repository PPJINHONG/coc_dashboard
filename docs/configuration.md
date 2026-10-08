# 환경변수와 버전 관리

## 설정 위치

```text
.env.example  팀원용 설정 양식 (Git 포함)
.env          실제 환경변수와 이미지 버전 (Git 제외)
compose.yaml  실행 구성
```

Docker Compose는 프로젝트 루트의 .env를 자동으로 읽습니다. 실제 설정은 .env 한 곳에서 수정합니다.

```bash
# .env가 없을 때 한 번만 복사합니다.
cp .env.example .env
```

## 환경변수

| 변수 | 역할 |
| --- | --- |
| POSTGRES_DB | 최초 생성할 DB 이름 |
| POSTGRES_USER | 최초 생성할 DB 사용자 |
| POSTGRES_PASSWORD | DB 접속 비밀번호 |
| DJANGO_SECRET_KEY | Django 서명 키 |
| PYTHON_IMAGE | 백엔드 Python 이미지 |
| NODE_IMAGE | React 빌드용 Node 이미지 |
| NGINX_IMAGE | 프론트 실행용 Nginx 이미지 |
| POSTGRES_IMAGE | PostgreSQL 이미지 |

개인 설정은 Git에 올리지 않습니다. 초기화된 PostgreSQL 볼륨의 DB 사용자/비밀번호는 .env 수정만으로 자동 변경되지 않습니다.

## 변경할 파일

| 변경 내용 | 파일 |
| --- | --- |
| 실제 환경변수와 이미지 버전 | .env |
| 팀원에게 공유할 기본 설정 | .env.example |
| React/TypeScript/Vite 패키지 | frontend/package.json |
| npm 설치 잠금 | frontend/package-lock.json |
| Django/psycopg/Gunicorn 패키지 | backend/requirements.txt |
| 호스트 접속 포트 | compose.yaml |

이미지 갱신 시 태그와 digest를 함께 수정합니다. 공유할 변경은 .env.example에도 반영합니다. JS 패키지 변경 후 npm install --package-lock-only로 잠금 파일을 갱신합니다. Python 패키지 버전은 requirements.txt를 직접 수정합니다.

## 실행

프로젝트 루트에서 실행합니다.

```bash
docker compose config --quiet
docker compose up --build -d
```

`--env-file`이나 실행 스크립트 없이 루트 .env를 읽습니다. 셸 환경변수는 .env보다 우선합니다. [Docker 공식 설명](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)
