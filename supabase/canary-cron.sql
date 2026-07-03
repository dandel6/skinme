-- 카나리아 일일 스케줄 설정 (Dashboard > SQL Editor에서 1회 실행)
-- ⚠️ 플레이스홀더 2곳을 실제 값으로 교체: <PROJECT_REF>, <CANARY_SECRET>
-- (시크릿은 migrations에 커밋하지 않기 위해 이 파일은 수동 실행용 템플릿)

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 매일 UTC 00:00 (KST 09:00) 실행
select cron.schedule(
  'canary-skin-daily',
  '0 0 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/canary-skin',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-canary-secret', '<CANARY_SECRET>'
    ),
    body := '{}'::jsonb
  )
  $$
);

-- 확인: select * from cron.job;
-- 해제: select cron.unschedule('canary-skin-daily');
