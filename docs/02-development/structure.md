# 폴더 구조와 기능 추가·수정 방법

[문서 목록](../README.md) · [두 사람이 기능별로 나눠 개발하기](../03-collaboration/parallel-development.md)

**어떤 파일을 고쳐야 하는지, 새 기능 탭을 어떻게 추가하는지** 알고 싶을 때 읽습니다.

코드는 **공통**과 **기능**으로 나뉩니다. 기능 탭(인프라 자원, 운영 인력 등)은 화면·서버 모두 기능별 폴더 하나에 모여 있고, 공통 파일은 기능 목록을 자동으로 모읍니다. 그래서 새 기능을 추가하거나 한 기능을 고칠 때 다른 사람이 고치는 파일을 건드리지 않습니다.

## 1. 바꾸려는 것부터 찾기

| 바꾸려는 것 | 화면(frontend/src) | 서버(backend) |
| --- | --- | --- |
| 인프라 자원 탭 | `features/resources/` | `features/resources/` |
| 운영 인력 탭 | `features/staff/` | `features/staff/` |
| 운영 작업 탭 | `features/work/` | `features/work/` |
| 권역별 요청작업 탭·티켓·본문 이미지 | `features/regional_requests/` | `features/regional_requests/` |
| 리포트 탭 | `features/report/` | (기능별 데이터를 모아 보여 줌) |
| 변경 이력 탭 | `features/logs/` | `reporting/` (ChangeLog) |
| DB 관리 탭(공통데이터·DB 원본·사용자·권한) | `features/database/` | `database_admin/`, `reporting/` |
| 사이드바·상단바·홈 카드·탭 관리 | `app/` | `reporting/navigation.py` |
| 로그인·회원가입·팀원 초대 | `app/LoginPage.tsx`, `app/InviteDialog.tsx` | `core/`, `invites/` |
| 리전·서비스·인력 공통데이터 | `shared/api/operations.ts`, `features/database/CommonData.tsx` | `reporting/models.py` |
| 버튼·입력·표·모달 같은 공통 부품과 색상 | `shared/components/`, `shared/styles/` | — |
| 권한(관리자·옵저버·사용자)·행동 이력 | — | `core/roles.py`, `core/models.py` |
| 게시판·대시보드 API(화면 미연결) | — | `features/board/`, `features/dashboard/` |

화면 규칙은 [디자인 규칙](../../.codex/design-system.md)을 따릅니다.

## 2. 화면 폴더: frontend/src

```text
frontend/src/
├─ main.tsx                 화면 시작
├─ app/                     공통 뼈대 (함께 쓰는 파일)
│  ├─ App.tsx               로그인 여부에 따라 로그인 화면/워크스페이스 선택
│  ├─ AppShell.tsx          사이드바·상단바·탭 이동·저장 전 이동 확인
│  ├─ HomePage.tsx          홈 카드
│  ├─ TabPreferences.tsx    탭 관리 창
│  ├─ InviteDialog.tsx      팀원 초대 창
│  ├─ LoginPage.tsx         로그인·회원가입
│  └─ *.css                 뼈대·홈·탭 관리·초대·로그인 스타일
├─ features/                기능별 폴더 (담당자가 따로 고치는 곳)
│  ├─ registry.ts           features/*/feature.tsx를 자동으로 모음 (고치지 않음)
│  ├─ resources/ staff/ work/ regional_requests/ report/ logs/ database/
│  │  ├─ feature.tsx        이 기능의 등록 정보: 탭 이름·아이콘·순서·홈 카드·리포트·DB 관리 탭·화면
│  │  ├─ fields.ts          표·입력 열 정의 (있는 기능만)
│  │  ├─ *.tsx              이 기능의 화면 부품
│  │  ├─ api.ts             이 기능만 쓰는 API (있는 기능만)
│  │  └─ <기능>.css          이 기능의 스타일
└─ shared/                  여러 기능이 함께 쓰는 코드 (함께 쓰는 파일)
   ├─ api/                  서버 요청(client), 로그인, 초대, 공통데이터·현재값(operations), 목록 관리(records)
   ├─ auth/                 로그인 상태(AuthContext), 관리자 로그인 폼
   ├─ components/           Icon·Panel·Modal·DataTable·FieldInput·ErrorMessage 등
   ├─ sections/             현재값 목록 화면(SectionPage)·DB 관리 편집(SectionEditor)·목록 관리(RecordsAdmin)
   ├─ feature.ts            feature.tsx가 따르는 형식(FeatureDefinition)
   ├─ fields.ts             열 정의 도구(셀 표시·빈 행·행 복사·CSV)
   └─ styles/               tokens.css(색·글꼴), base.css(버튼·입력), sections.css(표·필터·모달)
```

### feature.tsx 하나로 화면 곳곳에 연결됩니다

`features/registry.ts`가 모든 `feature.tsx`를 자동으로 읽어 `order` 순서로 정렬합니다. 등록 정보에 적은 항목만 해당 위치에 나타납니다.

| feature.tsx 항목 | 나타나는 곳 |
| --- | --- |
| `id`, `label`, `icon`, `order` | 사이드바 메뉴, 주소 `#tab=<id>`, 상단 경로 |
| `adminOnly` | 관리자에게만 보이는 관리자 메뉴 |
| `hideable: false` | 탭 관리에서 숨길 수 없음(기본은 숨김 가능) |
| `english`, `description`, `homeCount` | 홈의 전체 기능 카드와 탭 관리 목록 |
| `featured` | 홈의 주요 기능 카드(미리보기 포함) |
| `report` | 리포트 화면에 들어갈 요약과 순서 |
| `admin` | DB 관리 → 기능별 설정의 하위 탭 |
| `Page` | 탭을 눌렀을 때 보이는 화면 |

`Page`는 공통데이터(`data`), 현재값(`snapshot`), 로그인 사용자(`user`), 이동(`navigate`), 다시 불러오기(`refresh`), 편집 중 표시(`setDirty`)를 받습니다. 형식은 `shared/feature.ts`에 있습니다.

### 화면 코드 규칙

- 기능 폴더는 `shared/`만 가져다 씁니다. **다른 기능 폴더를 import하지 않습니다.** 다른 기능의 내용이 필요하면 `Page`가 받는 `features` 목록을 씁니다(리포트·DB 관리가 이 방식).
- 기능 전용 스타일은 기능 폴더의 CSS에 두고, 클래스 이름은 기능 고유의 이름(예: `inventory-…`, `staff-…`)으로 시작합니다. 여러 기능이 쓰는 모양은 `shared/styles/`를 고칩니다.
- 기능 ID는 폴더 이름과 같게 둡니다. 다르면 브라우저 콘솔에 오류가 표시됩니다.

## 3. 서버 폴더: backend

```text
backend/
├─ config/                  설정·주소 (함께 쓰는 파일)
│  ├─ settings.py           features/ 아래 앱을 자동 등록
│  └─ urls.py               공통 주소 + 기능 앱 urls.py·admin_urls.py 자동 연결
├─ core/                    공통: 로그인·회원가입·내 정보, 권한(roles.py), 행동 이력(UserActivity), admin 계정 생성
├─ reporting/               공통: 리전·서비스·인력 공통데이터, 동시 수정 버전, 변경 이력, 현재값 조회, 탭 설정
│  ├─ registry.py           각 앱 feature.py를 모으는 장치 (Feature·Section 형식)
│  └─ admin_urls.py         /api/db-admin/sections/·common/ (관리자 저장)
├─ database_admin/          공통: DB 원본 조회(읽기 전용), 사용자·권한 관리
├─ invites/                 공통: 팀원 초대 링크
└─ features/                기능별 Django 앱 (담당자가 따로 고치는 곳)
   ├─ __init__.py           apps.py가 있는 하위 폴더를 찾는 함수 (고치지 않음)
   ├─ resources/ staff/ work/ regional_requests/
   │  ├─ apps.py            앱 등록 정보 (label = 폴더 이름)
   │  ├─ models.py          이 기능의 테이블
   │  ├─ migrations/        이 기능의 테이블 변경 기록 (앱마다 따로 번호가 붙음)
   │  ├─ serializers.py     API 응답·입력 형식
   │  ├─ feature.py         공통 API에 연결할 내용(아래 표)
   │  ├─ urls.py            /api/ 아래 이 기능 주소 (있는 기능만)
   │  ├─ admin_urls.py      /api/db-admin/ 아래 이 기능 관리 주소 (있는 기능만)
   │  └─ tests/             이 기능 테스트
   └─ board/ dashboard/     게시판·대시보드 API (화면은 아직 메뉴에 없음)
```

### feature.py로 공통 API에 연결합니다

```python
# backend/features/<기능>/feature.py
FEATURE = Feature(
    tabs=('resources',),                          # 탭 관리에서 숨길 수 있는 화면 탭 ID
    tables={'infra_resources': '인프라 자원'},      # DB 관리 > DB 원본에 보여 줄 테이블
    sections=(Section(key='resources', model=..., serializer=..., unique_fields=('region', 'service')),),
    totals=totals,                                # /api/operations/current/ 의 totals에 더할 값
)
```

| 항목 | 연결되는 곳 |
| --- | --- |
| `sections` | `/api/operations/current/`의 `<key>` 목록, 관리자 저장 `PUT /api/db-admin/sections/<key>/` |
| `totals` | `/api/operations/current/`의 `totals` |
| `tables` | `/api/db-admin/` 원본 테이블 허용 목록 |
| `tabs` | `/api/navigation/preferences/`의 `hidden_tabs` 허용값 |

공통 앱도 같은 방식으로 `core/feature.py`(계정 테이블), `reporting/feature.py`(공통데이터 테이블, 리포트·변경 이력 탭)를 둡니다.

### 서버 코드 규칙

- 기능 앱은 공통 앱(`core`, `reporting`, `database_admin`, `invites`)만 import합니다. **다른 기능 앱을 import하지 않습니다.**
- 공통 앱은 기능 앱을 직접 import하지 않습니다. 기능 목록은 `feature.py`로 모으고, 계정 아이디 변경처럼 기능이 따라 바꿔야 하는 일은 `core.signals.username_changed` 같은 공통 신호로 알립니다.
- 테이블 구조 변경은 그 기능 앱의 마이그레이션으로만 합니다. 자세한 규칙은 [데이터 확인과 DB 구조 변경](database.md)을 봅니다.

## 4. 새 기능 탭 추가 순서

예: `backup` 기능을 추가합니다.

1. 서버: `backend/features/backup/`에 `__init__.py`, `apps.py`(`name = 'features.backup'`, `label = 'backup'`), `models.py`, `migrations/__init__.py`를 만들고 아래 명령으로 마이그레이션 파일을 내 PC 폴더에 만듭니다(컨테이너 안이 아니라 `backend/`에 바로 생깁니다).

   ```bash
   docker compose run --rm --no-deps -v "$PWD/backend:/app" --entrypoint python backend manage.py makemigrations backup
   ```
2. 서버: 목록 저장·조회가 필요하면 `serializers.py`와 `feature.py`(`sections`, `tabs`, `tables`)를, 별도 API가 필요하면 `urls.py`를 둡니다. 설정·주소 파일은 고치지 않습니다.
3. 화면: `frontend/src/features/backup/feature.tsx`를 만들고 `id: "backup"`, 메뉴 이름·아이콘·`order`·`Page`를 적습니다. 목록형이면 `shared/sections/SectionPage`와 `SectionAdmin`을 재사용합니다.
4. 테스트: `backend/features/backup/tests/`에 둡니다.
5. 반영·확인: `docker compose down` → `docker compose up --build -d` 후 사이드바·홈·탭 관리·DB 관리에 나타나는지 확인합니다.

기존 기능을 고칠 때는 그 기능 폴더(화면·서버) 안의 파일만 바꾸면 됩니다. 공통 파일을 바꿔야 하면 [협업 규칙](../03-collaboration/parallel-development.md)에 따라 먼저 알립니다.

## 5. 브라우저 요청은 어디로 가나요?

```text
브라우저 localhost:8080 → frontend(Nginx)
├─ /          React 화면
├─ /api/      backend:8000 (Django REST Framework)
└─ /backend/  API 문서(/api/docs/)로 이동
```

화면 코드는 `/api/...`처럼 같은 사이트 주소로 요청합니다. 내부 주소 `backend:8000`, `db:5432`는 컨테이너끼리만 씁니다.

## 6. 수정한 뒤 확인

```bash
docker compose down
docker compose up --build -d
docker compose exec backend pytest
```

화면 빌드에는 TypeScript 검사가 포함되므로 `up --build`가 실패하면 화면 코드 오류부터 봅니다. 테스트는 임시 DB(`test_<DB이름>`)를 만들어 실행하므로 실제 데이터는 바뀌지 않습니다.
