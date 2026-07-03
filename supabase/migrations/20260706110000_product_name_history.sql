-- 제품명 append-only 이력 - 자유 텍스트 정규화(B-트랙)의 원천 보존.
-- 트리거(SECURITY DEFINER)로 모든 name write(register INSERT · rename UPDATE)를 자동·원자 기록.
-- 클라이언트 코드 변경 없음 → 유저 플로우 불변. SECURITY DEFINER라 RLS로 코어 플로우를 막지 않음.
create table if not exists public.product_name_history (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null,
  raw_name text not null,
  recorded_at timestamptz not null default now()
);
create index if not exists product_name_history_product_idx
  on public.product_name_history (product_id, recorded_at);

alter table public.product_name_history enable row level security;
-- 읽기는 본인만. insert 정책 없음 = 클라이언트 직접 쓰기 불가(append-only 무결성 - 트리거만 기록).
drop policy if exists "pnh_select_own" on public.product_name_history;
create policy "pnh_select_own" on public.product_name_history
  for select using (auth.uid() = user_id);

create or replace function public.record_product_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') or (TG_OP = 'UPDATE' and new.name is distinct from old.name) then
    insert into public.product_name_history (product_id, user_id, raw_name, recorded_at)
    values (new.id, new.user_id, new.name, now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_record_product_name on public.products;
create trigger trg_record_product_name
  after insert or update of name on public.products
  for each row execute function public.record_product_name();

-- 백필: 기존 products의 현재 name을 최초 이력으로(중복 방지). recorded_at=등록시각.
insert into public.product_name_history (product_id, user_id, raw_name, recorded_at)
select p.id, p.user_id, p.name, p.started_at
from public.products p
where not exists (
  select 1 from public.product_name_history h where h.product_id = p.id
);

-- 롤백(down):
--   drop trigger if exists trg_record_product_name on public.products;
--   drop function if exists public.record_product_name();
--   drop table if exists public.product_name_history;
