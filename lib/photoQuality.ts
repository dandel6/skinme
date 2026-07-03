import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { deletePhotoFile } from './faceCrop';
import { averageLuminance, base64ToBytes } from './luminance';

// 측정 실패 단계 구분 - null이 "미측정"인지 "실패(어느 단계)"인지 데이터로 남기기 위함.
export type LuminanceError =
  | 'render_failed' // ImageManipulator resize/render/save 예외
  | 'empty_base64' // saveAsync가 base64를 반환하지 않음
  | 'decode_failed' // jpeg-js 디코드 예외(EOI 손상 등)
  | 'nan_result'; // 디코드는 됐으나 평균이 유한수가 아님(데이터 길이 불일치 등)

export type LuminanceResult =
  | { value: number; error: null }
  | { value: null; error: LuminanceError };

/**
 * 사진 파일을 size×size로 축소해 평균 휘도(0-255)를 계산한다.
 * centerCropRatio < 1이면 중앙 크롭만 측정(타원 영역 근사).
 * 실패 시 value=null + 단계별 error. 호출부는 판정 보류(통과)하되 error를 기록한다.
 */
export async function measureLuminance(
  photoUri: string,
  size: number,
  centerCropRatio = 1,
): Promise<LuminanceResult> {
  let base64: string;
  try {
    const context = ImageManipulator.manipulate(photoUri);
    context.resize({ width: size, height: size });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      base64: true,
      compress: 0.4,
      format: SaveFormat.JPEG,
    });
    // 휘도 측정은 base64만 사용 - 디스크에 남은 축소 임시본은 즉시 폐기(사진 수명 원칙).
    if (saved.uri) await deletePhotoFile(saved.uri);
    if (!saved.base64) return { value: null, error: 'empty_base64' };
    base64 = saved.base64;
  } catch (error) {
    console.log('[photoQuality] render failed', error);
    return { value: null, error: 'render_failed' };
  }
  try {
    const value = averageLuminance(base64ToBytes(base64), centerCropRatio);
    if (!Number.isFinite(value)) return { value: null, error: 'nan_result' };
    return { value, error: null };
  } catch (error) {
    console.log('[photoQuality] decode failed', error);
    return { value: null, error: 'decode_failed' };
  }
}

/** 값만 필요한 사전게이트용 얇은 래퍼(하위호환). 실패 사유는 무시하고 null 반환. */
export async function photoAverageLuminance(
  photoUri: string,
  size: number,
  centerCropRatio = 1,
): Promise<number | null> {
  return (await measureLuminance(photoUri, size, centerCropRatio)).value;
}
