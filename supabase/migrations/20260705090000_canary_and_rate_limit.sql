-- 운영 안정성: 카나리아 로그 + 분석 rate limit 카운트 테이블

-- 1) 모델 드리프트 감시 로그 - 서비스 롤 전용(정책 없음 = 클라이언트 접근 불가)
create table public.canary_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  image_name text not null,
  result jsonb not null,
  scores jsonb not null, -- 지표별 점수 평탄화 (held 색 지표는 null)
  warn boolean not null default false,
  warn_detail jsonb -- [{metric, prev, curr, delta}] - ±5 초과 변동
);
create index canary_logs_image_time_idx on public.canary_logs (image_name, created_at desc);
alter table public.canary_logs enable row level security;

-- 2) 분석 요청 카운트(시간당 rate limit 판정용) - 실패한 시도도 집계
create table public.analysis_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
create index analysis_requests_user_time_idx on public.analysis_requests (user_id, created_at desc);
alter table public.analysis_requests enable row level security;
create policy "analysis_requests_insert_own" on public.analysis_requests
  for insert with check (auth.uid() = user_id);
create policy "analysis_requests_select_own" on public.analysis_requests
  for select using (auth.uid() = user_id);
