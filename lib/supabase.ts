import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { STRINGS } from '../constants/strings';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * URL/key 미설정 시 사용자에게 보여줄 에러(설정되어 있으면 null).
 * useScans·useSkinAnalysis가 이 값을 화면 에러로 승격시킨다 - 콘솔 경고로 끝나지 않음.
 */
export const supabaseConfigError: string | null =
  !supabaseUrl || !supabaseAnonKey ? STRINGS.configMissing : null;

if (supabaseConfigError) {
  console.log('[supabase] config missing: EXPO_PUBLIC_SUPABASE_URL / ANON_KEY');
}

// 미설정이어도 모듈 로드가 죽지 않도록 placeholder 사용(요청은 configError가 먼저 차단)
export const supabase = createClient(
  supabaseUrl || 'https://config-missing.invalid',
  supabaseAnonKey || 'config-missing',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// 앱 활성 상태에서만 토큰 자동 갱신 (Supabase RN 권장 패턴)
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

/**
 * 세션 보장. 성공 시 null, 실패 시 사용자에게 보여줄 한국어 에러 문구 반환.
 * 모든 분기를 콘솔에 남긴다(user id 또는 실패 사유).
 */
export async function ensureSignedIn(): Promise<string | null> {
  if (supabaseConfigError) {
    console.log('[supabase] ensureSignedIn blocked: config missing');
    return supabaseConfigError;
  }
  try {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.log('[supabase] getSession error:', sessionError.message);
    }
    if (data.session) {
      console.log('[supabase] session ok, user:', data.session.user.id);
      return null;
    }
    console.log('[supabase] no session - trying anonymous sign-in');
    const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError) {
      console.log(
        '[supabase] anonymous sign-in FAILED:',
        signInError.name,
        signInError.message,
        'status:',
        signInError.status ?? 'n/a',
      );
      return STRINGS.connectionFailed;
    }
    console.log('[supabase] anonymous sign-in ok, user:', signInData.user?.id ?? 'unknown');
    return null;
  } catch (error) {
    console.log(
      '[supabase] ensureSignedIn threw:',
      error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    );
    return STRINGS.connectionFailed;
  }
}
