-- 서버 시각 RPC - 클라이언트 시계 조작 방어용(판정 가능 시점 검증).
-- 판정(computeVerdict)은 확정 설계라 무변경 - 이 함수는 "판정 실행 가능 여부"만 게이트한다.
create or replace function public.server_now()
returns timestamptz
language sql
stable
as $$
  select now();
$$;
