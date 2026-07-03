-- analysis_requests 자동 정리 - rate limit 판정엔 최근 1시간만 필요.
-- 2일 초과분을 매일 삭제(무한 증가 방지).
-- ⚠️ pg_cron 확장이 활성화돼 있어야 함(Supabase 대시보드 > Database > Extensions에서 pg_cron 켜기).
select cron.schedule(
  'analysis-requests-cleanup',
  '30 18 * * *', -- 매일 UTC 18:30 (KST 03:30)
  $$ delete from public.analysis_requests where created_at < now() - interval '2 days'; $$
);
