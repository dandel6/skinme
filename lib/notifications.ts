import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { milestoneNotificationBody, STRINGS, verdictNotificationBody } from '../constants/strings';

const MILESTONE_BEFORE_MS = 7 * 24 * 60 * 60 * 1000; // D-7 반환점
const WEEKLY_SUMMARY_KIND = 'weekly_summary'; // 제품 알림(productId 태그)과 구분되는 식별자
const WEEKLY_SUMMARY_PREF_KEY = 'skinme.weeklySummaryEnabled';

// 포그라운드에서도 배너 표시 (판정 완료 알림 1건뿐 - 매일 알림 금지 원칙)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * 제품 등록 시 verdict_at 시각에 1회성 로컬 알림 예약.
 * 권한은 이 시점에 요청. 거부/실패 시 false 반환 - 등록 흐름은 막지 않는다.
 * content.data.productId로 태깅해 취소/재예약 시 식별한다.
 */
export async function scheduleVerdictNotification(
  productId: string,
  productName: string,
  verdictAtIso: string,
): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('[notif] permission not granted:', status);
      return false;
    }
    const date = new Date(verdictAtIso);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      console.log('[notif] verdict_at is past or invalid - skip scheduling');
      return false;
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SkinMe',
        body: verdictNotificationBody(productName),
        data: { productId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      },
    });
    console.log('[notif] scheduled verdict notification at', verdictAtIso);
    return true;
  } catch (error) {
    console.log('[notif] schedule failed:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * D-7 마일스톤 알림 1회 (verdict_at - 7일). 매일 알림 금지 원칙 유지 -
 * 제품당 예약은 리포트 도착 1건 + 반환점 1건뿐.
 * scanCount는 예약 시점 값(로컬 알림은 정적 콘텐츠 - 발화 시점 실측치 아님).
 */
export async function scheduleMilestoneNotification(
  productId: string,
  scanCount: number,
  verdictAtIso: string,
): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return; // 권한은 verdict 알림 예약에서 이미 요청됨
    const date = new Date(new Date(verdictAtIso).getTime() - MILESTONE_BEFORE_MS);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      console.log('[notif] milestone date is past - skip');
      return;
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SkinMe',
        body: milestoneNotificationBody(scanCount),
        data: { productId }, // 취소/재예약은 verdict 알림과 동일 태그로 일괄 처리
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      },
    });
    console.log('[notif] scheduled milestone notification at', date.toISOString());
  } catch (error) {
    console.log('[notif] milestone schedule failed:', error instanceof Error ? error.message : String(error));
  }
}

/** 해당 제품의 예약 알림 전부 취소 (삭제/재예약용). 실패해도 흐름은 막지 않는다. */
export async function cancelVerdictNotification(productId: string): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const request of scheduled) {
      if (request.content.data?.productId === productId) {
        await Notifications.cancelScheduledNotificationAsync(request.identifier);
        console.log('[notif] cancelled notification for product', productId);
      }
    }
  } catch (error) {
    console.log('[notif] cancel failed:', error instanceof Error ? error.message : String(error));
  }
}

/** 주간 요약 알림 on/off 설정값 (기본 on). */
export async function isWeeklySummaryEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(WEEKLY_SUMMARY_PREF_KEY)) !== '0';
  } catch {
    return true;
  }
}

/** 설정 토글 - 저장 후 즉시 예약/취소 반영. */
export async function setWeeklySummaryEnabled(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(WEEKLY_SUMMARY_PREF_KEY, on ? '1' : '0');
  } catch {
    // 저장 실패해도 아래 예약/취소는 시도
  }
  if (on) await scheduleWeeklySummary();
  else await cancelWeeklySummary();
}

/**
 * 주 1회(일요일 20시) 요약 알림 예약. 매일 알림 금지 원칙 - 주 1건이 상한.
 * 설정 off·권한 미허용·이미 예약됨이면 조용히 스킵(권한 요청은 하지 않음).
 */
export async function scheduleWeeklySummary(): Promise<void> {
  try {
    if (!(await isWeeklySummaryEnabled())) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return; // 권한은 제품 등록 시 이미 요청됨
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    if (scheduled.some((r) => r.content.data?.kind === WEEKLY_SUMMARY_KIND)) return; // 중복 방지
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SkinMe',
        body: STRINGS.weeklySummaryBody,
        data: { kind: WEEKLY_SUMMARY_KIND },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1, // 1=일요일
        hour: 20,
        minute: 0,
      },
    });
    console.log('[notif] scheduled weekly summary (Sun 20:00)');
  } catch (error) {
    console.log('[notif] weekly summary schedule failed:', error instanceof Error ? error.message : String(error));
  }
}

/** 주간 요약 알림만 취소 (제품 알림은 productId 태그라 영향 없음). */
export async function cancelWeeklySummary(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const request of scheduled) {
      if (request.content.data?.kind === WEEKLY_SUMMARY_KIND) {
        await Notifications.cancelScheduledNotificationAsync(request.identifier);
      }
    }
  } catch (error) {
    console.log('[notif] weekly summary cancel failed:', error instanceof Error ? error.message : String(error));
  }
}

/** 기록 전체 삭제 시 - 예약된 알림 전부 취소 (주간 요약 포함) */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[notif] all scheduled notifications cancelled');
  } catch (error) {
    console.log('[notif] cancel all failed:', error instanceof Error ? error.message : String(error));
  }
}

/** 이름 수정 시 알림 문구 갱신 - 기존(리포트+마일스톤) 취소 후 둘 다 재예약 */
export async function rescheduleVerdictNotification(
  productId: string,
  productName: string,
  verdictAtIso: string,
  scanCount: number,
): Promise<void> {
  await cancelVerdictNotification(productId); // data.productId 태그 일괄 취소
  await scheduleVerdictNotification(productId, productName, verdictAtIso);
  await scheduleMilestoneNotification(productId, scanCount, verdictAtIso);
}
