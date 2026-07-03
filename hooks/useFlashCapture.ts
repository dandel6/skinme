import { useCallback, useRef, useState } from 'react';
import * as Brightness from 'expo-brightness';
import type { CameraView } from 'expo-camera';
import { CAPTURE } from '../constants/capture';
import { deletePhotoFile } from '../lib/faceCrop';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type CapturedPhoto = {
  uri: string;
  width: number;
  height: number;
};

/**
 * 화면 백색 플래시 연사 촬영 시퀀스:
 * 셔터 → 화면 전체 흰색 오버레이 + 밝기 최대 → 800ms 유지 →
 * 플래시를 유지한 채 count컷 연속 촬영(간격 최소화) → 밝기 원복.
 * 연사는 촬영 유래 분산 제거용 - 정상 플로우는 1컷째만 사용한다.
 * 성공 시 count개의 사진, 실패 시 null(부분 촬영분은 내부에서 폐기).
 *
 * ⚠️ iOS 동작 차이 (expo-brightness/expo-camera 문서 기준, 실기기 확인 필요):
 * - setBrightnessAsync: Android는 현재 액티비티 한정(앱 이탈 시 자동 원복)이지만
 *   iOS는 기기 전역 밝기를 바꾸며 기기 잠금 전까지 지속 - 촬영 중 앱이 강제 종료되면
 *   finally의 원복이 실행되지 않아 최대 밝기로 남는다. 별도 권한은 불필요
 *   (WRITE_SETTINGS는 Android setSystemBrightnessAsync 전용 - 우리는 미사용).
 * - takePictureAsync의 shutterSound 옵션은 Android 전용 - iOS는 무시되며,
 *   일부 지역(일본 등) 기기는 OS 강제 셔터음이 날 수 있다.
 * - iOS 연사 2컷의 컷 간 간격·프리뷰 끊김은 기기별 측정 필요.
 */
export function useFlashCapture(cameraRef: React.RefObject<CameraView | null>) {
  const [flashOn, setFlashOn] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const busyRef = useRef(false);

  const capture = useCallback(
    async (count: 1 | 2): Promise<CapturedPhoto[] | null> => {
      if (busyRef.current || !cameraRef.current) return null;
      busyRef.current = true;
      setCapturing(true);
      let previousBrightness: number | null = null;
      const photos: CapturedPhoto[] = [];
      try {
        try {
          previousBrightness = await Brightness.getBrightnessAsync();
        } catch (error) {
          console.log('[flash] read brightness failed', error);
        }
        setFlashOn(true);
        try {
          await Brightness.setBrightnessAsync(CAPTURE.flashBrightness);
        } catch (error) {
          console.log('[flash] set brightness failed', error);
        }
        await delay(CAPTURE.flashHoldMs); // 전면 카메라 노출이 화면광에 적응할 시간
        for (let shot = 0; shot < count; shot += 1) {
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.9,
            shutterSound: false,
          });
          if (!photo?.uri) break;
          photos.push({ uri: photo.uri, width: photo.width, height: photo.height });
        }
        if (photos.length !== count) {
          for (const photo of photos) await deletePhotoFile(photo.uri); // 부분 실패분 폐기
          return null;
        }
        return photos;
      } catch (error) {
        console.log('[flash] capture failed', error);
        for (const photo of photos) await deletePhotoFile(photo.uri);
        return null;
      } finally {
        if (previousBrightness !== null) {
          try {
            await Brightness.setBrightnessAsync(previousBrightness);
          } catch (error) {
            console.log('[flash] restore brightness failed', error);
          }
        }
        setFlashOn(false);
        setCapturing(false);
        busyRef.current = false;
      }
    },
    [cameraRef],
  );

  return { flashOn, capturing, capture };
}
