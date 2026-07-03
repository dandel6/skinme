import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';
import {
  configurePurchases,
  fetchCustomerInfo,
  loginPurchases,
  onCustomerInfoUpdate,
  type CustomerInfo,
} from './purchases';

export const PRO_ENTITLEMENT_ID = 'pro';
const DEV_BYPASS_KEY = 'skinme.dev.proBypass';

// 모듈 레벨 미니 스토어 - 여러 화면이 같은 구독 상태를 공유
let realPro = false;
let ready = false;
let devBypass = false;
let configuredOk = false; // configure 성공 여부 - 포그라운드 재시도 판단
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};

function applyCustomerInfo(info: CustomerInfo | null): void {
  realPro = !!info?.entitlements.active[PRO_ENTITLEMENT_ID];
  ready = true;
  emit();
}

/** 구매/복원 응답을 상태에 반영 */
export function syncCustomerInfo(info: CustomerInfo | null): void {
  if (info) applyCustomerInfo(info);
}

/** 앱 시작 시 1회 (root layout) - configure + entitlement 동기화 + 변경 구독 */
export async function initPurchases(): Promise<void> {
  if (__DEV__) {
    try {
      devBypass = (await AsyncStorage.getItem(DEV_BYPASS_KEY)) === '1';
    } catch {
      devBypass = false;
    }
  }
  const configured = await configurePurchases();
  configuredOk = configured;
  if (!configured) {
    ready = true;
    emit();
    return;
  }
  // RevenueCat app_user_id를 supabase uid로 정렬 (webhook entitlements 매칭에 필수)
  try {
    const { data } = await supabase.auth.getUser();
    if (data.user) await loginPurchases(data.user.id);
  } catch {
    // logIn 실패해도 결제 흐름은 계속
  }
  onCustomerInfoUpdate(applyCustomerInfo);
  applyCustomerInfo(await fetchCustomerInfo());
}

// configure 실패(오프라인 시작 등) 시 포그라운드 복귀에 재시도 -
// Pro 유저가 그 실행 내내 무료로 남는 문제 방어.
AppState.addEventListener('change', (state) => {
  if (state === 'active' && !configuredOk) initPurchases();
});

export function isProActive(): boolean {
  return (__DEV__ && devBypass) || realPro;
}

export function isDevProBypassOn(): boolean {
  return __DEV__ && devBypass;
}

/** __DEV__ 페이월 우회 토글 (도그푸딩 연속성) - 프로덕션에선 no-op */
export async function setDevProBypass(on: boolean): Promise<void> {
  if (!__DEV__) return;
  devBypass = on;
  try {
    await AsyncStorage.setItem(DEV_BYPASS_KEY, on ? '1' : '0');
  } catch {
    // 저장 실패해도 세션 내에서는 유효
  }
  emit();
}

export function usePro(): { isPro: boolean; ready: boolean; devBypass: boolean } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((tick) => tick + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return { isPro: isProActive(), ready, devBypass: isDevProBypassOn() };
}
