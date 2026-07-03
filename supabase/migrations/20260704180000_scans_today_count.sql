-- 무료 캡 판정용: 오늘(KST, 서버 시계 기준) 본인 스캔 수.
-- 날짜 경계를 서버 now()로 계산하므로 클라이언트 시계 조작이 무의미하다.
create or replace function public.scans_today_count()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::int
  from public.scans
  where user_id = auth.uid()
    and created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
$$;
