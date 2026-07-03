import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase, supabaseConfigError } from '../lib/supabase';

/** 서버(KST) 기준 오늘 스캔 수. 실패 시 null(fail-open). */
export async function fetchTodayCount(): Promise<number | null> {
  if (supabaseConfigError) return null;
  const { data, error } = await supabase.rpc('scans_today_count');
  if (error) {
    console.log('[cap] scans_today_count failed:', error.message);
    return null;
  }
  return typeof data === 'number' ? data : Number(data ?? 0);
}

/**
 * 무료 촬영 캡(일 1회) 판정 - scans_today_count RPC(서버 시계·KST 기준).
 * 로드 실패 시 null → 호출부는 캡 미적용(fail-open)으로 처리.
 */
export function useDailyCap() {
  const [todayCount, setTodayCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    setTodayCount(await fetchTodayCount());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { todayCount, reload: load };
}
