import { useCallback, useEffect, useState } from 'react';
import { skinAnalysisSchema, type SkinAnalysis } from '../lib/analysis/schema';
import { supabase, supabaseConfigError } from '../lib/supabase';

export type TrendScan = { t: number; result: SkinAnalysis };

/** 추이 그래프용: 기간 내 스캔(시간 오름차순, 최대 200개). zod 검증 실패 행 제외. */
export function useTrendScans(periodDays: 7 | 30) {
  const [scans, setScans] = useState<TrendScan[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (supabaseConfigError) {
      setLoading(false);
      return;
    }
    try {
      const from = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('scans')
        .select('created_at, result')
        .gte('created_at', from)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      const rows: TrendScan[] = [];
      for (const row of data ?? []) {
        const parsed = skinAnalysisSchema.safeParse(row.result);
        if (parsed.success) {
          rows.push({ t: new Date(row.created_at).getTime(), result: parsed.data });
        }
      }
      setScans(rows);
    } catch (caught) {
      console.log('[trend] load failed:', caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [periodDays]);

  useEffect(() => {
    load();
  }, [load]);

  return { scans, loading, reload: load };
}
