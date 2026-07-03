import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { STRINGS } from '../constants/strings';
import {
  cancelVerdictNotification,
  rescheduleVerdictNotification,
  scheduleMilestoneNotification,
  scheduleVerdictNotification,
} from '../lib/notifications';
import { ensureSignedIn, supabase, supabaseConfigError } from '../lib/supabase';
import { verdictSchema, type Verdict } from '../lib/verdict/computeVerdict';

export type ProductRow = {
  id: string;
  name: string;
  started_at: string;
  verdict_at: string;
  verdict: Verdict | null; // 검증 통과한 것만 (미검증 JSON 렌더 금지)
};

/** 마일스톤 알림 문구용 총 스캔 수 (실패 시 0) */
async function fetchScanTotal(): Promise<number> {
  const { count, error } = await supabase
    .from('scans')
    .select('*', { count: 'exact', head: true });
  if (error) {
    console.log('[products] scan count failed:', error.message);
    return 0;
  }
  return count ?? 0;
}

export function useProducts() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifDenied, setNotifDenied] = useState(false);

  const load = useCallback(async () => {
    if (supabaseConfigError) {
      setError(supabaseConfigError);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const { data, error: dbError } = await supabase
        .from('products')
        .select('id, name, started_at, verdict_at, verdict')
        .order('started_at', { ascending: false });
      if (dbError) throw dbError;
      const rows: ProductRow[] = (data ?? []).map((row) => {
        let verdict: Verdict | null = null;
        if (row.verdict !== null) {
          const parsed = verdictSchema.safeParse(row.verdict);
          if (parsed.success) verdict = parsed.data;
          else console.log('[products] invalid verdict json skipped:', row.id);
        }
        return {
          id: row.id,
          name: row.name,
          started_at: row.started_at,
          verdict_at: row.verdict_at,
          verdict,
        };
      });
      setProducts(rows);
    } catch (caught) {
      console.log('[products] load failed:', caught instanceof Error ? caught.message : String(caught));
      setError(STRINGS.productsLoadFailed);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /** 제품 등록(이름만). 성공 시 verdict_at 알림 예약 후 목록 갱신. */
  const register = useCallback(
    async (name: string): Promise<boolean> => {
      try {
        const authError = await ensureSignedIn();
        if (authError) {
          setError(authError);
          return false;
        }
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) throw userError ?? new Error('no user');
        const { data, error: insertError } = await supabase
          .from('products')
          .insert({ user_id: userData.user.id, name })
          .select('id, name, verdict_at')
          .single();
        if (insertError) throw insertError;
        const scheduled = await scheduleVerdictNotification(data.id, data.name, data.verdict_at);
        setNotifDenied(!scheduled);
        if (scheduled) {
          // D-7 반환점 알림 - 제품당 총 2건(리포트 도착 + 반환점), 매일 알림 금지 유지
          await scheduleMilestoneNotification(data.id, await fetchScanTotal(), data.verdict_at);
        }
        await load();
        return true;
      } catch (caught) {
        console.log('[products] register failed:', caught instanceof Error ? caught.message : String(caught));
        setError(STRINGS.registerFailed);
        return false;
      }
    },
    [load],
  );

  /** 판정 결과를 products.verdict에 저장 (RLS: update policy 필요) */
  const saveVerdict = useCallback(
    async (productId: string, verdict: Verdict): Promise<boolean> => {
      try {
        const { error: updateError } = await supabase
          .from('products')
          .update({ verdict })
          .eq('id', productId);
        if (updateError) throw updateError;
        await load();
        return true;
      } catch (caught) {
        console.log('[products] saveVerdict failed:', caught instanceof Error ? caught.message : String(caught));
        setError(STRINGS.verdictSaveFailed);
        return false;
      }
    },
    [load],
  );

  /** 제품 이름 수정 + 예약 알림 문구 갱신(취소 후 재예약) */
  const rename = useCallback(
    async (productId: string, name: string): Promise<boolean> => {
      try {
        const { data, error: updateError } = await supabase
          .from('products')
          .update({ name })
          .eq('id', productId)
          .select('id, name, verdict_at')
          .single();
        if (updateError) throw updateError;
        await rescheduleVerdictNotification(data.id, data.name, data.verdict_at, await fetchScanTotal());
        await load();
        return true;
      } catch (caught) {
        console.log('[products] rename failed:', caught instanceof Error ? caught.message : String(caught));
        setError(STRINGS.renameFailed);
        return false;
      }
    },
    [load],
  );

  /** 하드 삭제 + 예약 알림 취소. 판정 완료 제품도 삭제 가능. */
  const remove = useCallback(
    async (productId: string): Promise<boolean> => {
      try {
        const { error: deleteError } = await supabase
          .from('products')
          .delete()
          .eq('id', productId);
        if (deleteError) throw deleteError;
        await cancelVerdictNotification(productId);
        await load();
        return true;
      } catch (caught) {
        console.log('[products] delete failed:', caught instanceof Error ? caught.message : String(caught));
        setError(STRINGS.deleteFailed);
        return false;
      }
    },
    [load],
  );

  return { products, loading, error, notifDenied, register, saveVerdict, rename, remove, reload: load };
}
