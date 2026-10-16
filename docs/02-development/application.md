# 어떤 파일을 수정하면 되나요?

[문서 목록](../README.md) · [쉬운 용어 사전](../01-start/glossary.md)

**프로젝트 폴더의 역할을 알고 싶을 때** 읽습니다. 모든 파일을 이해한 뒤 시작할 필요는 없습니다. 바꾸려는 기능에 해당하는 파일부터 확인하세요.

## 1. 바꾸려는 것부터 찾기

| 바꾸려는 것 | 먼저 볼 파일 |
| --- | --- |
| 첫 화면 문구와 구성 | `frontend/src/App.tsx` |
| 화면 색상·글자·간격 | `frontend/src/styles.css` |
| 서버 기본 안내 페이지 | `backend/core/templates/core/home.html` |
| 데이터를 읽어서 돌려주는 처리 | `backend/core/views.py` |
| 돌려주는 데이터의 항목 구성 | `backend/core/serializers.py` |
| 서버의 접속 주소 | `backend/config/urls.py` |
| DB 접속 같은 서버 설정 | `backend/config/settings.py`와 `.env` |
| DB 첫 생성용 SQL | `db/init/01-test.sql` |
| 실행할 프로그램과 연결 방법 | `compose.yaml` |

## 2. 화면 폴더: frontend

React는 화면을 만드는 도구이고, TypeScript는 코드의 값과 사용법이 맞는지 검사하는 언어입니다. `.tsx`는 화면 구성과 코드를 함께 적는 파일입니다.

```text
frontend/
├─ src/
│  ├─ App.tsx          기본 화면
│  ├─ main.tsx         화면을 시작하는 코드
│  └─ styles.css       색상·배치·글자 모양
├─ index.html          화면이 들어갈 바탕
├─ package.json        사용할 프로그램과 실행 명령 목록
├─ package-lock.json   설치할 세부 버전 기록
├─ tsconfig.json       TypeScript 검사 설정
├─ vite.config.ts      화면 코드 준비 도구인 Vite 설정
├─ nginx.conf          화면 제공과 서버 요청 전달 설정
└─ Dockerfile          화면 실행 묶음을 만드는 순서
```

화면을 만들 때 Node가 준비 작업을 하고, 준비된 화면 파일은 Nginx가 브라우저에 보냅니다. 실제 화면 제공 컨테이너에는 Node가 들어 있지 않으므로 그 안에서 npm 명령을 실행하지 않습니다.

## 3. 서버 폴더: backend

Django는 서버를 만드는 도구입니다. 이 프로젝트에서는 Django REST Framework라는 추가 도구로 데이터 요청을 처리합니다. 문서에서 `DRF`라고 나오면 이 도구를 뜻합니다.

```text
backend/
├─ config/
│  ├─ settings.py      서버와 DB 연결 설정
│  ├─ urls.py          주소와 처리 코드를 연결
│  └─ wsgi.py          실행 프로그램과 Django를 연결
├─ core/
│  ├─ apps.py          core 기능 묶음 등록 정보
│  ├─ views.py         요청을 받고 결과를 만드는 코드
│  ├─ serializers.py   응답 데이터 형식을 정하는 코드
│  └─ templates/core/home.html  서버 기본 화면
├─ manage.py           서버 관리 명령의 시작 파일
├─ requirements.txt    사용할 Python 프로그램 목록
└─ Dockerfile          서버 실행 묶음을 만드는 순서
```

Gunicorn은 컨테이너 안에서 Django를 실행하는 프로그램입니다. 루트 `.env`는 실제 설정값을 보관하고, `backend/config/`는 그 값을 읽어 쓰는 서버 코드를 담습니다.

## 4. 데이터 폴더: db

```text
db/
├─ init/01-test.sql    처음에 표와 예제 데이터 만들기
└─ queries/test.sql   예제 데이터 읽기
```

현재 `test`라는 표에 번호와 메시지를 저장합니다. 서버는 Docker 내부의 `db:5432`로 DB에 연결합니다. 이 주소는 컨테이너끼리 쓰는 주소이며 브라우저에 입력하는 주소가 아닙니다.

표의 내용과 적용 방법은 [데이터 확인하기](database.md)에 있습니다.

## 5. 브라우저 요청은 어디로 가나요?

Nginx가 접속 주소를 보고 요청을 나눠 보냅니다.

| 주소 | 처리하는 부분 |
| --- | --- |
| `/` | React 화면 |
| `/backend/` | Django 기본 화면 |
| `/api/` | API 안내 화면으로 이동 |
| `/api/docs/` | API 목록과 실행 화면 |
| `/api/schema/` | 다른 도구가 읽는 API 설명 데이터 |
| `/api/test/` | 서버가 DB에서 조회한 데이터 |

화면 코드에서 `fetch('/api/test/')`를 쓰면 지금 접속한 사이트의 `/api/test/`에 요청합니다. 내부 서버 이름인 `backend:8000`을 브라우저 코드에 쓸 필요는 없습니다.

## 6. 수정한 뒤 확인

프로젝트 최상위에서 실행합니다.

```bash
docker compose up --build -d
```

그다음 바꾼 화면이나 API 주소를 열어봅니다. 서버 기본 설정도 확인하려면 실행 중인 서버에 다음 검사를 요청합니다.

```bash
docker compose exec backend python manage.py check
```

문제가 없다는 결과가 나오는지 확인합니다. 이 검사는 설정 일부를 확인하며 모든 기능의 정상 동작을 보장하지는 않습니다.
