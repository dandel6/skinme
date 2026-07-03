-- B-트랙 전방호환(유저 비가시): 정규화 앵커 + 스캔 캡처 컨텍스트 컬럼.
-- 지금은 채우지 않는다(canonical_product_id). capture_context는 analyze-skin이 채우기 시작.
alter table public.products add column if not exists canonical_product_id uuid;
create index if not exists products_canonical_idx on public.products (canonical_product_id);

alter table public.scans add column if not exists capture_context jsonb;

-- 롤백(down):
--   drop index if exists public.products_canonical_idx;
--   alter table public.products drop column if exists canonical_product_id;
--   alter table public.scans drop column if exists capture_context;
