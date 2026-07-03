import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ProductActionSheet } from '../../components/verdict/ProductActionSheet';
import { ProductCard } from '../../components/verdict/ProductCard';
import { RegisterModal } from '../../components/verdict/RegisterModal';
import { concurrentTrackingWarning, deleteConfirmMessage, STRINGS } from '../../constants/strings';
import { useDailyCap } from '../../hooks/useDailyCap';
import { useProducts, type ProductRow } from '../../hooks/useProducts';
import { usePro } from '../../lib/purchases/usePro';
import { COLORS, pressedStyle } from '../../lib/ui';
import { skinAnalysisSchema } from '../../lib/analysis/schema';
import { supabase } from '../../lib/supabase';
import {
  computeVerdict,
  DAY_MS,
  type ScanForVerdict,
} from '../../lib/verdict/computeVerdict';

export default function VerdictScreen() {
  const router = useRouter();
  const { products, loading, error, notifDenied, register, saveVerdict, rename, remove } =
    useProducts();
  const { isPro } = usePro();
  const { todayCount } = useDailyCap();
  const capped = !isPro && todayCount !== null && todayCount >= 1;
  const [modalVisible, setModalVisible] = useState(false);
  const [actionProduct, setActionProduct] = useState<ProductRow | null>(null);
  const [renameProduct, setRenameProduct] = useState<ProductRow | null>(null);
  const [noScansProductId, setNoScansProductId] = useState<string | null>(null);
  const [judgeError, setJudgeError] = useState<string | null>(null);
  const [judging, setJudging] = useState(false);

  // 삭제: 확인 다이얼로그 → 하드 삭제(판정 완료 제품 포함) + 알림 취소
  const confirmDelete = (product: ProductRow) => {
    setActionProduct(null);
    Alert.alert(STRINGS.deleteAction, deleteConfirmMessage(product.name), [
      { text: STRINGS.deleteCancel, style: 'cancel' },
      { text: STRINGS.deleteAction, style: 'destructive', onPress: () => remove(product.id) },
    ]);
  };

  // [판정 가능] 카드 탭 → 스캔 로드 → 판정 계산 → 저장 → 리포트
  const runVerdict = async (product: ProductRow) => {
    if (judging) return;
    setJudging(true);
    setNoScansProductId(null);
    setJudgeError(null);
    try {
      // 서버 시각으로 판정 가능 시점 검증(클라이언트 시계 조작 방어).
      // server_now RPC 미배포 시 nowData=null → 기존 동작(클라 시계)으로 안전 폴백.
      const { data: nowData } = await supabase.rpc('server_now');
      const serverNow = nowData ? new Date(nowData as string).getTime() : Date.now();
      if (new Date(product.verdict_at).getTime() > serverNow) {
        setJudgeError(STRINGS.verdictNotReadyYet);
        return;
      }
      const from = new Date(
        new Date(product.started_at).getTime() - 7 * DAY_MS,
      ).toISOString();
      const { data, error: dbError } = await supabase
        .from('scans')
        .select('created_at, lighting_ok, result')
        .gte('created_at', from)
        .lte('created_at', product.verdict_at)
        .order('created_at', { ascending: true });
      if (dbError) throw dbError;
      const scans: ScanForVerdict[] = [];
      for (const row of data ?? []) {
        const parsed = skinAnalysisSchema.safeParse(row.result);
        if (parsed.success) {
          scans.push({
            created_at: row.created_at,
            lighting_ok: row.lighting_ok,
            result: parsed.data,
          });
        }
      }
      const computation = computeVerdict({
        startedAt: product.started_at,
        verdictAt: product.verdict_at,
        scans,
      });
      if (computation.status === 'no_scans') {
        setNoScansProductId(product.id);
        return;
      }
      const saved = await saveVerdict(product.id, computation.verdict);
      if (saved) {
        router.push({ pathname: '/report', params: { productId: product.id } });
      }
    } catch (caught) {
      console.log('[verdict] run failed:', caught instanceof Error ? caught.message : String(caught));
      setJudgeError(STRINGS.scansLoadFailed);
    } finally {
      setJudging(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#111111" />
      </View>
    );
  }

  // 제품 등록은 Pro 기능 - 비구독자는 등록 시도 시 페이월 (기존 제품 열람은 유지)
  const registerButton = (
    <Pressable
      style={pressedStyle(styles.registerButton)}
      onPress={() =>
        isPro
          ? setModalVisible(true)
          : router.push({ pathname: '/paywall', params: { source: 'register' } })
      }
    >
      <Text style={styles.registerButtonText}>{STRINGS.productRegister}</Text>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      {products.length === 0 ? (
        <View style={styles.center}>
          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <View style={styles.emptyBlock}>
              <Text style={styles.empty}>{STRINGS.verdictEmpty}</Text>
              <Text style={styles.whyDays}>{STRINGS.whyFourteenDays}</Text>
            </View>
          )}
          {registerButton}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {error && <Text style={styles.error}>{error}</Text>}
          {judgeError && <Text style={styles.error}>{judgeError}</Text>}
          {notifDenied && <Text style={styles.note}>{STRINGS.notifPermissionNote}</Text>}
          {products.map((product) => (
            <View key={product.id} style={styles.cardWrap}>
              <ProductCard
                product={product}
                // n차 추적: 같은 이름 중 시작이 더 이른 행의 수 + 1
                cycle={
                  products.filter(
                    (p) => p.name === product.name && p.started_at < product.started_at,
                  ).length + 1
                }
                onRunVerdict={runVerdict}
                onOpenReport={(p) =>
                  router.push({ pathname: '/report', params: { productId: p.id } })
                }
                onLongPress={setActionProduct}
              />
              {noScansProductId === product.id && (
                <View style={styles.noScans}>
                  <Text style={styles.noScansText}>{STRINGS.verdictNoScans}</Text>
                  <Pressable
                    style={pressedStyle(styles.captureButton)}
                    onPress={() =>
                      capped
                        ? router.push({ pathname: '/paywall', params: { source: 'cap' } })
                        : router.push('/capture')
                    }
                  >
                    <Text style={styles.captureButtonText}>
                      {capped ? STRINGS.capReached : STRINGS.todayCaptureButton}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
          <View style={styles.footer}>{registerButton}</View>
        </ScrollView>
      )}
      <RegisterModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        warning={(() => {
          const pending = products.find((p) => p.verdict === null);
          return pending ? concurrentTrackingWarning(pending.name) : undefined;
        })()}
        onSubmit={register}
      />
      <ProductActionSheet
        product={actionProduct}
        onClose={() => setActionProduct(null)}
        onRename={(p) => {
          setActionProduct(null);
          setRenameProduct(p);
        }}
        onDelete={confirmDelete}
      />
      <RegisterModal
        visible={renameProduct !== null}
        onClose={() => setRenameProduct(null)}
        initialName={renameProduct?.name}
        title={STRINGS.renameAction}
        submitLabel={STRINGS.renameSubmit}
        onSubmit={async (name) => {
          if (!renameProduct) return false;
          return rename(renameProduct.id, name);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 32,
    backgroundColor: '#ffffff',
  },
  content: {
    padding: 20,
    gap: 12,
    paddingBottom: 48,
  },
  cardWrap: {
    gap: 8,
  },
  emptyBlock: {
    alignItems: 'center',
    gap: 12,
  },
  empty: {
    color: '#6B7280',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  whyDays: {
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  error: {
    color: '#B91C1C',
    fontSize: 14,
    textAlign: 'center',
  },
  note: {
    color: '#92400E',
    fontSize: 12,
    textAlign: 'center',
  },
  noScans: {
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    alignItems: 'center',
  },
  noScansText: {
    color: '#92400E',
    fontSize: 13,
  },
  captureButton: {
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 12,
  },
  registerButton: {
    height: 52,
    paddingHorizontal: 36,
    borderRadius: 26,
    backgroundColor: COLORS.accent, // 주요 CTA - 포인트 컬러
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
