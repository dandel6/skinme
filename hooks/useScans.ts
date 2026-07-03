import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { STRINGS } from '../constants/strings';
import { skinAnalysisSchema, type SkinAnalysis } from '../lib/analysis/schema';
import { supabase, supabaseConfigError } from '../lib/supabase';

export type ScanRow = {
  id: string;
  created_at: string;
  result: SkinAnalysis;
  lighting_ok: boolean;
};

/** 최근 10개 스캔 로드. zod 검증 실패 행은 렌더 대상에서 제외(미검증 JSON 렌더 금지). */
export function useScans() {
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // 설정 누락은 콘솔 경고가 아니라 화면 에러로 승격
    if (supabaseConfigError) {
      setLoadError(supabaseConfigError);
      setLoading(false);
      return;
    }
    try {
      setLoadError(null);
      const { data, error } = await supabase
        .from('scans')
        .select('id, created_at, result, lighting_ok')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      const rows: ScanRow[] = [];
      for (const row of data ?? []) {
        const parsed = skinAnalysisSchema.safeParse(row.result);
        if (parsed.success) {
          rows.push({
            id: row.id,
            created_at: row.created_at,
            result: parsed.data,
            lighting_ok: row.lighting_ok,
          });
        } else {
          console.log('[scans] invalid result row skipped', row.id);
        }
      }
      setScans(rows);
    } catch (error) {
      console.log('[scans] load failed', error instanceof Error ? error.message : 'unknown');
      setLoadError(STRINGS.scansLoadFailed);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { scans, loading, loadError, reload: load };
}
