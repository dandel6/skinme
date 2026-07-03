-- 제품 삭제(하드 삭제)를 위한 RLS 정책 - 본인 행만.
-- select/insert(초기), update(20260704120000)는 기존 존재.
drop policy if exists "products_delete_own" on public.products;
create policy "products_delete_own" on public.products
  for delete using (auth.uid() = user_id);
