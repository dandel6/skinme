import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { computeStreak } from '../lib/streak';
import { supabase, supabaseConfigError } from '../lib/supabase';

/**
 * 측정 스트릭 표시용 경량 훅 - created_at만 최근 60일 조회(점수 데이터 미포함).
 * 계산은 lib/streak의 순수함수. 실패 시 스트릭 0(조용히).
 */
export function useStreak(): { days: number; includesToday: boolean } {
  const [streak, setStreak] = useState<{ days: number; includesToday: boolean }>({
    days: 0,
    includesToday: false,
  });

  const load = useCallback(async () => {
    if (supabaseConfigError) return;
    const from = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('scans')
      .select('created_at')
      .gte('created_at', from)
      .order('created_at', { ascending: false })
      .limit(60);
    if (error) {
      console.log('[streak] load failed:', error.message);
      return;
    }
    setStreak(computeStreak((data ?? []).map((row) => row.created_at), Date.now()));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return streak;
}
