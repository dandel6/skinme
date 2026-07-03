// delete-account - 인증된 유저의 모든 데이터 + auth 계정을 완전 삭제(Play 데이터 삭제 요건).
// scans/products는 auth.users FK cascade로도 지워지지만, FK 없는 테이블(analysis_requests·
// analytics_events)까지 명시 삭제 후 계정을 제거한다.
import { createClient } from 'npm:@supabase/supabase-js@2';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    // 요청자 본인 확인 (JWT 스코프)
    const authed = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) return json({ error: 'unauthorized' }, 401);
    const uid = userData.user.id;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    // 본인 데이터 전수 삭제
    await admin.from('scans').delete().eq('user_id', uid);
    await admin.from('products').delete().eq('user_id', uid);
    await admin.from('analysis_requests').delete().eq('user_id', uid);
    await admin.from('analytics_events').delete().eq('user_id', uid);
    await admin.from('entitlements').delete().eq('user_id', uid);
    // auth 계정 제거 (이 시점에 남은 FK 데이터는 cascade)
    const { error: delError } = await admin.auth.admin.deleteUser(uid);
    if (delError) {
      console.log('[delete-account] deleteUser failed:', delError.message);
      return json({ error: 'delete_failed' }, 500);
    }
    return json({ ok: true }, 200);
  } catch (error) {
    console.log('[delete-account] error:', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'internal' }, 500);
  }
});
