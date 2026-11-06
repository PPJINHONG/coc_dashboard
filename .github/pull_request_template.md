## 변경 내용

<!-- 어떤 문제를 해결하며, 사용자 동작이 어떻게 바뀌는지 설명해 주세요. -->

## 바꾼 범위

- 기능 폴더: <!-- 예: frontend/src/features/resources, backend/features/resources -->
- 공통 파일: <!-- app/, shared/, 공통 앱, 설정을 바꿨다면 이유. 없으면 "없음" -->
- DB 마이그레이션: <!-- 앱 이름과 파일. 컬럼·테이블 삭제나 값 이전이 있으면 배포 전 스냅샷 필요 -->

## 검증

- [ ] 최신 main을 내 브랜치에 합친 뒤 `docker compose up --build -d`
- [ ] `docker compose exec backend pytest`
- [ ] 바꾼 기능과 상대 기능 화면 확인
- [ ] CI(Compose build) 통과
- [ ] 구조·설정 변경 시 관련 docs 갱신
