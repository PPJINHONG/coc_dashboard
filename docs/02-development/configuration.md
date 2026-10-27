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
| `POSTGRES_PASSWORD` | DB 접속 비밀번호 |
| `DJANGO_SECRET_KEY` | 서버가 서명 등에 사용하는 비밀 키 |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | (선택) 로그인 요청을 허용할 브라우저 접속 주소. 쉼표로 구분하며, 없으면 `http://localhost:8080`을 사용합니다. 접속 포트를 바꿨을 때만 설정합니다. |
| `PYTHON_IMAGE` | 서버 실행에 쓸 Python 환경 묶음 |
| `NODE_IMAGE` | 화면 코드를 준비할 때 쓸 Node 환경 묶음 |
| `NGINX_IMAGE` | 준비된 화면을 브라우저에 보내는 환경 묶음 |
| `POSTGRES_IMAGE` | DB 실행에 쓸 PostgreSQL 환경 묶음 |

## 3. 새 설정 항목을 추가할 때

예를 들어 새 기능에 설정값 하나가 더 필요해졌다면 다음을 함께 수정합니다.

1. `.env.example`에 항목 이름과 공유 가능한 예시를 추가합니다.
2. 코드를 실행하는 `compose.yaml`이나 해당 코드에서 그 항목을 사용하도록 연결합니다.
3. 이 문서에 항목의 뜻과 사용법을 적습니다.
4. 두 사람 모두 자기 `.env`에 필요한 실제 값을 추가합니다.

실제 비밀번호·키·토큰은 양식, 코드, PR 설명, 작업 보고에 넣지 않습니다.

## 4. 다른 프로그램을 추가하거나 버전을 바꿀 때

| 바꾸려는 대상 | 수정할 파일 |
| --- | --- |
| 화면에서 가져다 쓰는 프로그램 | `frontend/package.json` |
| 화면 프로그램의 설치 버전 기록 | `frontend/package-lock.json` |
| 서버에서 가져다 쓰는 프로그램 | `backend/requirements.txt` |
| Docker 실행 환경의 공통 버전 | `.env.example`과 각자의 `.env` |
| 브라우저 접속 번호 | `compose.yaml` |

`package-lock.json`은 두 사람이 같은 세부 버전을 설치하도록 기록한 파일입니다. `package.json`을 바꿨다면 두 파일이 맞아야 합니다. Node와 npm이 설치된 터미널에서 다음을 실행해 기록을 갱신합니다.

```bash
cd frontend
npm install --package-lock-only
cd ..
```

`cd frontend`는 화면 폴더로 이동하고, `cd ..`는 다시 프로젝트 최상위로 돌아오는 명령입니다. 이 명령은 설치 버전 기록을 갱신하는 용도입니다. 실제 실행 반영은 아래 재빌드까지 진행합니다.

Docker 이미지 이름에는 버전 표시인 태그와 정확한 대상을 가리키는 `sha256` 식별값이 함께 들어갈 수 있습니다. 환경 묶음을 갱신할 때는 기존 양식에 맞춰 둘 다 확인합니다.

## 5. 바꾼 설정 확인과 실행 반영

프로젝트 최상위에서 하나씩 실행합니다.

```bash
docker compose config --quiet
```

아무 메시지 없이 끝나면 설정 확인을 통과한 것입니다. 그다음 다시 빌드하고 실행합니다.

```bash
docker compose up --build -d
```

DB의 사용자·비밀번호는 이미 만들어진 DB에서 `.env`만 바꾼다고 변경되지 않습니다. 기존 데이터에 적용하는 작업은 별도로 정해야 합니다. [DB 안내](database.md)를 참고하세요.

터미널에 같은 이름의 설정값을 미리 등록했다면 `.env`보다 그 값이 먼저 사용될 수 있습니다. `.env`를 바꿔도 예상대로 반영되지 않을 때 이 부분도 확인합니다. [Docker 공식 설명](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)
