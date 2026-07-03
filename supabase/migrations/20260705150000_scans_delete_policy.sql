-- 기록 전체 삭제(설정 화면)를 위한 scans delete 정책 - 본인 행만.
-- products delete 정책은 20260704150000에 존재.
drop policy if exists "scans_delete_own" on public.scans;
create policy "scans_delete_own" on public.scans
  for delete using (auth.uid() = user_id);
