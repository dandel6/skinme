import AsyncStorage from '@react-native-async-storage/async-storage';

// 온보딩 상태·응답은 전부 로컬(AsyncStorage)에만 저장한다 - 서버 전송 없음, 개인정보 아님.
// 분기(a/b)는 첫 화면 강조 용도, 퍼널 카운터는 dev 확인용(외부 전송 없음)뿐 다른 용도 없음.
const DONE_KEY = 'skinme.onboardingDone';
const CHOICE_KEY = 'skinme.onboardingChoice'; // 'a' | 'b'
const FUNNEL_KEY = 'skinme.onboardingFunnel'; // { [event]: count }
// 사진 처리 고지 확인 - 온보딩 완료와 별개 플래그. 온보딩을 안 거친 경로(딥링크,
// 동의 도입 이전 기존 유저)도 촬영 진입 시 이 플래그로 고지 노출을 강제한다.
const CONSENT_KEY = 'skinme.consentAcknowledged';

export type OnboardingChoice = 'a' | 'b';
export type FunnelEvent =
  | 'step1_view'
  | 'step2_view'
  | 'consent_view'
  | 'step3_view'
  | 'skip'
  | 'choice_a'
  | 'choice_b';

export async function isOnboardingDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DONE_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setOnboardingDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(DONE_KEY, '1');
  } catch {
    // 저장 실패해도 흐름은 계속 (다음 실행에 온보딩이 한 번 더 뜰 수 있을 뿐)
  }
}

export async function isConsentAcknowledged(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CONSENT_KEY)) === '1';
  } catch {
    return false; // 판독 실패 시 미확인으로 간주 - 고지가 한 번 더 뜰 뿐
  }
}

export async function setConsentAcknowledged(): Promise<void> {
  try {
    await AsyncStorage.setItem(CONSENT_KEY, '1');
  } catch {
    // 저장 실패 시 다음 촬영 진입에 고지가 다시 뜬다 (안전 방향 실패)
  }
}

export async function setOnboardingChoice(choice: OnboardingChoice): Promise<void> {
  try {
    await AsyncStorage.setItem(CHOICE_KEY, choice);
  } catch {
    // 무시 - 분기 강조는 부가 기능
  }
}

export async function getOnboardingChoice(): Promise<OnboardingChoice | null> {
  try {
    const value = await AsyncStorage.getItem(CHOICE_KEY);
    return value === 'a' || value === 'b' ? value : null;
  } catch {
    return null;
  }
}

/** 퍼널 이벤트 카운트 +1 (로컬 전용, dev 확인용). 실패해도 조용히 무시. */
export async function recordFunnel(event: FunnelEvent): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(FUNNEL_KEY);
    const counts: Record<string, number> = raw ? JSON.parse(raw) : {};
    counts[event] = (counts[event] ?? 0) + 1;
    await AsyncStorage.setItem(FUNNEL_KEY, JSON.stringify(counts));
  } catch {
    // 계측 실패는 사용자 흐름에 영향 없음
  }
}

/** dev 메뉴에서 퍼널 카운트 열람용. */
export async function getFunnel(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(FUNNEL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
