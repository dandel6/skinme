import type { RefObject } from 'react';
import type ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { deletePhotoFile } from './faceCrop';

/**
 * <ViewShot> 컴포넌트 ref로 캡처 → OS 공유 시트로 내보낸다(리포트·오늘점수 공용).
 * captureRef(raw View)는 안드로이드 뷰 평탄화 시 백지로 찍히므로 ViewShot.capture() 사용.
 * 공유 실패·취소는 조용히 복귀(에러 화면 금지). 캡처 임시 파일은 공유 후 삭제.
 */
export async function shareViewShot(ref: RefObject<ViewShot | null>): Promise<void> {
  try {
    const shot = ref.current;
    if (!shot || typeof shot.capture !== 'function') return;
    const uri = await shot.capture();
    if (!uri) return;
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    }
    await deletePhotoFile(uri); // 캡처 임시 파일 즉시 삭제 (이미지 수명 원칙)
  } catch (error) {
    console.log('[share] failed:', error instanceof Error ? error.message : String(error));
  }
}
