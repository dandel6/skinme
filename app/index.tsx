import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { isOnboardingDone, setOnboardingDone } from '../lib/onboarding';
import { supabase, supabaseConfigError } from '../lib/supabase';

type Gate = 'loading' | 'onboarding' | 'today';

// 진입 게이트: 온보딩 플래그 미존재 + 스캔 0개인 첫 실행에만 온보딩.
// 플래그가 있으면 즉시 today. 기존 유저(스캔 보유)는 플래그가 없어도 온보딩 스킵.
export default function Index() {
  const [gate, setGate] = useState<Gate>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (await isOnboardingDone()) {
        if (!cancelled) setGate('today');
        return;
      }
      // 설정 누락 시 온보딩 건너뛰고 today로(=설정 오류 화면을 보여줌)
      if (supabaseConfigError) {
        if (!cancelled) setGate('today');
        return;
      }
      const { count } = await supabase
        .from('scans')
        .select('*', { count: 'exact', head: true });
      if (cancelled) return;
      if ((count ?? 0) > 0) {
        await setOnboardingDone(); // 기존 유저 - 이후 재판정 방지
        setGate('today');
      } else {
        setGate('onboarding');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (gate === 'loading') return <View style={{ flex: 1, backgroundColor: '#ffffff' }} />;
  return <Redirect href={gate === 'onboarding' ? '/onboarding' : '/today'} />;
}
