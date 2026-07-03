-- 퍼널 전환 계측 (자체 테이블). 유저 식별자(user_id) 외 개인정보 금지,
-- 사진 관련 데이터는 props에도 절대 금지. 집계는 서비스 롤(대시보드 SQL)로 수행.
create table public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  event text not null,
  props jsonb,
  created_at timestamptz not null default now()
);
create index analytics_events_event_time_idx on public.analytics_events (event, created_at desc);

alter table public.analytics_events enable row level security;
create policy "analytics_insert_own" on public.analytics_events
  for insert with check (auth.uid() = user_id);
create policy "analytics_select_own" on public.analytics_events
  for select using (auth.uid() = user_id);
