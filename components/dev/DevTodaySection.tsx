import { useState, type ReactNode } from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import type { ProductRow } from '../../hooks/useProducts';
import type { SkinAnalysis } from '../../lib/analysis/schema';
import {
  MOCK_STATES,
  mockPreview,
  runVerdictPreview,
  setPreview,
  type MockState,
} from '../../lib/dev/preview';
import { DEV_STRINGS } from '../../lib/dev/strings';
import { setDevProBypass, usePro } from '../../lib/purchases/usePro';
import { setRawScan } from '../../lib/repro';
import { DevMenu } from './DevMenu';
import { DevPickerSheet } from './DevPickerSheet';

type Props = {
  latestResult: SkinAnalysis | null;
  products: ProductRow[];
  children: ReactNode; // 히스토리 영역 - 3초 길게 누르면 개발자 메뉴
};

/** 오늘 탭의 개발자 진입점 전체 - __DEV__ require 체인에서만 로드됨 */
export function DevTodaySection({ latestResult, products, children }: Props) {
  const router = useRouter();
  const { devBypass } = usePro();
  const [menuVisible, setMenuVisible] = useState(false);
  const [productPickerVisible, setProductPickerVisible] = useState(false);
  const [mockPickerVisible, setMockPickerVisible] = useState(false);

  const openRealPreview = async (productId: string) => {
    setProductPickerVisible(false);
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    try {
      const payload = await runVerdictPreview(product);
      setPreview(payload);
      router.push('/verdict-preview');
    } catch (error) {
      console.log('[dev] verdict preview failed:', error instanceof Error ? error.message : String(error));
    }
  };

  const openMockPreview = (state: string) => {
    setMockPickerVisible(false);
    setPreview(mockPreview(state as MockState));
    router.push('/verdict-preview');
  };

  return (
    <>
      <Pressable delayLongPress={3000} onLongPress={() => setMenuVisible(true)}>
        {children}
      </Pressable>
      <DevMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        rawScanAvailable={latestResult !== null}
        previewAvailable={products.length > 0}
        onReproTest={() => {
          setMenuVisible(false);
          router.push({ pathname: '/capture', params: { mode: 'repro' } });
        }}
        onSameImageTest={() => {
          setMenuVisible(false);
          router.push({ pathname: '/capture', params: { mode: 'same-image' } });
        }}
        onViewRawScan={() => {
          if (!latestResult) return;
          setRawScan(latestResult);
          setMenuVisible(false);
          router.push('/raw-scan');
        }}
        onVerdictPreview={() => {
          setMenuVisible(false);
          setProductPickerVisible(true);
        }}
        onMockPreview={() => {
          setMenuVisible(false);
          setMockPickerVisible(true);
        }}
        proBypassOn={devBypass}
        onToggleProBypass={() => {
          setDevProBypass(!devBypass); // 도그푸딩 연속성 - 페이월 우회
        }}
      />
      <DevPickerSheet
        visible={productPickerVisible}
        title={DEV_STRINGS.previewPickerTitle}
        options={products.map((p) => ({ key: p.id, label: p.name }))}
        onSelect={openRealPreview}
        onClose={() => setProductPickerVisible(false)}
      />
      <DevPickerSheet
        visible={mockPickerVisible}
        title={DEV_STRINGS.mockPickerTitle}
        options={MOCK_STATES.map((state) => ({
          key: state,
          label: DEV_STRINGS.mockLabels[state],
        }))}
        onSelect={openMockPreview}
        onClose={() => setMockPickerVisible(false)}
      />
    </>
  );
}
