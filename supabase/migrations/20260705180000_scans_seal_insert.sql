-- 스캔 위조 차단: 클라이언트 직접 insert 경로 봉인.
-- analyze-skin edge function(service role)만 scans에 쓴다 → 분석을 거치지 않은 위조 점수 차단.
-- select/delete 정책은 유지(본인 행 열람·삭제). insert만 제거.
-- ⚠️ 배포 순서: analyze-skin(service-role insert) 먼저 배포 → 그다음 이 마이그레이션 push.
drop policy if exists "scans_insert_own" on public.scans;
