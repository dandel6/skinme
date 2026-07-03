// rc-webhook - RevenueCat 웹훅 수신. entitlements.is_pro를 갱신해 서버측 무료 캡의 근거로 쓴다.
// ⚠️ app_user_id가 supabase uid와 일치해야 함(앱에서 Purchases.logIn(uid) 필수 - usePro 참고).
// ⚠️ RevenueCat 대시보드 > Webhooks에 이 함수 URL + Authorization 헤더(= RC_WEBHOOK_AUTH)를 등록.
// 페이로드 타입 매핑은 시작점 - 실제 RevenueCat 이벤트로 검증 후 조정할 것.
import { createClient } from 'npm:@supabase/supabase-js@2';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Pro 부여/유지 이벤트
const PRO_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'PRODUCT_CHANGE',
]);
// Pro 상실 이벤트 (CANCELLATION은 자동갱신만 끈 것 - 만료까지 유지하므로 여기 아님)
const NONPRO_TYPES = new Set(['EXPIRATION']);

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    const secret = Deno.env.get('RC_WEBHOOK_AUTH') ?? '';
    if (!secret || req.headers.get('Authorization') !== `Bearer ${secret}`) {
      return json({ error: 'unauthorized' }, 401);
    }
    const body = await req.json().catch(() => null);
    const event = body?.event;
    const appUserId = event?.app_user_id;
    const type = event?.type;
    if (typeof appUserId !== 'string' || typeof type !== 'string') {
      return json({ error: 'bad_request' }, 400);
    }
    let isPro: boolean | null = null;
    if (PRO_TYPES.has(type)) isPro = true;
    else if (NONPRO_TYPES.has(type)) isPro = false;
    if (isPro === null) return json({ ok: true, ignored: type }, 200); // 그 외 타입은 상태 무변경

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const { error } = await admin
      .from('entitlements')
      .upsert({ user_id: appUserId, is_pro: isPro, updated_at: new Date().toISOString() });
    if (error) {
      console.log('[rc-webhook] upsert failed:', error.message);
      return json({ error: 'upsert_failed' }, 500);
    }
    return json({ ok: true }, 200);
  } catch (error) {
    console.log('[rc-webhook] error:', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'internal' }, 500);
  }
});
