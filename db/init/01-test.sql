-- 기본 확인용 테이블입니다. 다시 실행해도 기존 테이블/데이터를 유지합니다.
CREATE TABLE IF NOT EXISTS public.test (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message TEXT NOT NULL UNIQUE
);

-- 조회 확인에 사용할 샘플 데이터 한 건을 넣습니다.
INSERT INTO public.test (message)
VALUES ('Hello PostgreSQL')
ON CONFLICT (message) DO NOTHING;
