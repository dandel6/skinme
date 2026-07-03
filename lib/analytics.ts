import { supabase, supabaseConfigError } from './supabase';

// 퍼널 전환 계측 - fire-and-forget. 실패는 조용히 무시(사용자 흐름에 영향 없음).
// ⚠️ props에는 유저 식별자(user_id) 외 개인정보 금지, 사진 관련 데이터 절대 금지.
export type AnalyticsEvent =
  | 'paywall_shown'
  | 'paywall_plan_selected'
  | 'purchase_started'
  | 'purchase_completed'
  | 'purchase_cancelled'
  | 'restore_attempted'
  | 'restore_succeeded'
  // 촬영 퍼널(P0 Phase 2 계측). props에 사진·휘도 원본값 금지, 범주형 사유만.
  | 'capture_gate_fail' // 촬영본이 사후 판정/크롭에서 폐기됨. props.reason로 사유 구분
  | 'capture_retry' // 분석 에러 후 재촬영 선택
  | 'capture_abandoned' // 촬영 완료 없이 화면 이탈
  | 'capture_fallback_offered' // (Phase 3) 3회 실패 후 완화 임계 촬영 제안
  | 'capture_fallback_accepted' // (Phase 3) 완화 임계 촬영 수락
  | 'consent_acknowledged' // (Phase 4-3) 온보딩 사진 처리 고지 '확인했어요' 탭
  | 'precheck_blocked' // (P1-A) 온디바이스 프리게이트 차단. props.reason로 사유 구분
  | 'precheck_override_used'; // (P1-A) 3회 연속 차단 후 '그래도 분석하기' 우회

export type PaywallSource = 'cap' | 'register' | 'locked_section' | 'deeplink' | 'unknown';

export function track(event: AnalyticsEvent, props?: Record<string, string>): void {
  if (supabaseConfigError) return;
  // await하지 않는다 - 계측은 UI를 막지 않는다.
  void (async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return; // 세션 없으면 스킵
      await supabase
        .from('analytics_events')
        .insert({ user_id: userId, event, props: props ?? null });
    } catch {
      // 계측 실패 무시
    }
  })();
}
