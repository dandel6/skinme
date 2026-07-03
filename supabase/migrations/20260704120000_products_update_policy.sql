-- 판정 결과 저장(products.verdict update)을 위한 RLS 정책 추가.
-- 초기 마이그레이션은 select/insert만 있었음 - update가 없으면 verdict 저장이
-- 조용히 0행 업데이트로 끝난다.
drop policy if exists "products_update_own" on public.products;
create policy "products_update_own" on public.products
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
