import { Platform } from 'react-native';
import type PurchasesType from 'react-native-purchases';
import type {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';

export type { CustomerInfo, PurchasesPackage };

// react-native-purchases는 네이티브 모듈 - Expo Go에는 없음.
// lazy require + 가드로 Go에서도 앱이 죽지 않게 한다(결제는 dev build 전용).
let cached: typeof PurchasesType | null | undefined;

function getNative(): typeof PurchasesType | null {
  if (cached !== undefined) return cached;
  try {
    cached = (require('react-native-purchases') as { default: typeof PurchasesType }).default;
  } catch {
    console.log('[purchases] 네이티브 모듈 없음 - Expo Go에서는 결제 불가(dev build 필요)');
    cached = null;
  }
  return cached;
}

export function purchasesAvailable(): boolean {
  return getNative() !== null;
}

/** 앱 시작 시 1회. Android 우선 - 키 미설정/모듈 부재 시 false (앱 흐름은 계속). */
export async function configurePurchases(): Promise<boolean> {
  const purchases = getNative();
  if (!purchases) return false;
  const apiKey =
    Platform.OS === 'android' ? (process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '') : '';
  if (!apiKey) {
    console.log('[purchases] API 키 미설정 - configure 생략 (iOS는 W3 후반)');
    return false;
  }
  try {
    purchases.configure({ apiKey });
    return true;
  } catch (error) {
    console.log('[purchases] configure failed:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

export function onCustomerInfoUpdate(listener: (info: CustomerInfo) => void): void {
  getNative()?.addCustomerInfoUpdateListener(listener);
}

/** RevenueCat app_user_id를 supabase uid로 정렬 - webhook의 entitlements 매칭에 필수. */
export async function loginPurchases(userId: string): Promise<void> {
  const purchases = getNative();
  if (!purchases) return;
  try {
    await purchases.logIn(userId);
  } catch (error) {
    console.log('[purchases] logIn failed:', error instanceof Error ? error.message : String(error));
  }
}

export async function fetchCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    return (await getNative()?.getCustomerInfo()) ?? null;
  } catch (error) {
    console.log('[purchases] getCustomerInfo failed:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/** current offering에서 월간/연간 패키지 조회 - 상품 ID 하드코딩 금지, offering 기반 */
export async function fetchProPackages(): Promise<{
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
} | null> {
  const purchases = getNative();
  if (!purchases) return null;
  try {
    const offerings: PurchasesOfferings = await purchases.getOfferings();
    const current = offerings.current;
    if (!current) return { monthly: null, annual: null };
    return { monthly: current.monthly ?? null, annual: current.annual ?? null };
  } catch (error) {
    console.log('[purchases] getOfferings failed:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/** 구매 - 취소/실패는 throw (호출부에서 userCancelled 판별) */
export async function purchasePro(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
  const purchases = getNative();
  if (!purchases) return null;
  const { customerInfo } = await purchases.purchasePackage(pkg);
  return customerInfo;
}

/** 복원 결과 - failed=true는 네트워크/스토어 오류(≠ 내역 없음). 호출부가 문구를 분화한다. */
export async function restorePro(): Promise<{ info: CustomerInfo | null; failed: boolean }> {
  const purchases = getNative();
  if (!purchases) return { info: null, failed: false }; // 네이티브 없음 = 복원할 것 없음(오류 아님)
  try {
    return { info: await purchases.restorePurchases(), failed: false };
  } catch (error) {
    console.log('[purchases] restore failed:', error instanceof Error ? error.message : String(error));
    return { info: null, failed: true };
  }
}
