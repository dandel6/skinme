-- SkinMe 최소 스키마 (CLAUDE.md) - scans, products + RLS(본인 행만 select/insert)

-- 초기 단계 멱등 재실행용 (데이터 없음 전제). 이전 실패한 push가 일부 테이블만
-- 생성했을 수 있으므로 정리 후 재생성한다.
drop table if exists public.products;
drop table if exists public.scans;

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  result jsonb not null,
  lighting_ok boolean not null
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  started_at timestamptz not null default now(),
  -- generated column은 timestamptz+interval이 immutable이 아니라 불가(42P17).
  -- insert 시점 now() 기준 default로 대체 - started_at도 now() default라 의미 동일.
  -- 주의: started_at을 명시 insert하면 verdict_at도 함께 명시할 것.
  verdict_at timestamptz not null default (now() + interval '14 days'),
  verdict jsonb
);

create index scans_user_created_idx on public.scans (user_id, created_at desc);
create index products_user_idx on public.products (user_id);

alter table public.scans enable row level security;
alter table public.products enable row level security;

create policy "scans_select_own" on public.scans
  for select using (auth.uid() = user_id);
create policy "scans_insert_own" on public.scans
  for insert with check (auth.uid() = user_id);

create policy "products_select_own" on public.products
  for select using (auth.uid() = user_id);
create policy "products_insert_own" on public.products
  for insert with check (auth.uid() = user_id);
