import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initPurchases } from '../lib/purchases/usePro';
import { ensureSignedIn } from '../lib/supabase';

export default function RootLayout() {
  // 앱 시작 시 익명 로그인(세션 있으면 유지) + RevenueCat 동기화
  useEffect(() => {
    ensureSignedIn();
    initPurchases();
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="capture"
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        />
        <Stack.Screen name="report" options={{ title: '리포트' }} />
        <Stack.Screen
          name="paywall"
          options={{ title: 'SkinMe Pro', presentation: 'modal' }}
        />
        <Stack.Screen name="settings" options={{ title: '설정' }} />
        {/* 개발자 전용 라우트 옵션 - 프로덕션에서는 화면이 null을 렌더 */}
        {__DEV__ && <Stack.Screen name="repro-report" options={{ title: '재현성 테스트' }} />}
        {__DEV__ && <Stack.Screen name="raw-scan" options={{ title: '스캔 원본' }} />}
        {__DEV__ && (
          <Stack.Screen name="verdict-preview" options={{ title: '판정 미리보기' }} />
        )}
      </Stack>
    </>
  );
}
