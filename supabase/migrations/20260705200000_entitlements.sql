-- Pro 구독 상태 (RevenueCat webhook이 갱신). 서버측 무료 캡 판정의 근거.
-- 쓰기는 service role(webhook)만 - select 정책만 두고 insert/update 정책은 없음.
create table public.entitlements (
  user_id uuid primary key,
  is_pro boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;
create policy "entitlements_select_own" on public.entitlements
  for select using (auth.uid() = user_id);
