-- "기록 전체 삭제"에서 본인 계측 이벤트도 함께 지울 수 있도록 delete 정책 추가
-- (프라이버시: 기록 삭제 시 analytics_events 잔존 방지 - 보안감사 F3).
drop policy if exists "analytics_delete_own" on public.analytics_events;
create policy "analytics_delete_own" on public.analytics_events
  for delete using (auth.uid() = user_id);
