import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode as decodeJpeg } from 'jpeg-js';
import { CAPTURE } from '../constants/capture';
import { deletePhotoFile } from './faceCrop';
import { base64ToBytes } from './luminance';

// 온디바이스 프리게이트 - 촬영본을 API에 태우기 전에 클라이언트에서 품질 차단.
// 다운스케일 썸네일 1회 디코드로 밝기·색치우침·선명도를 측정한다(토큰 0원, <1초).
// 원칙: 과차단이 과통과보다 위험 → 극단만 차단. 측정 실패는 통과(서버 백스톱에 위임).
// 순수 함수 - 같은 이미지는 같은 판정(재현성). 얼굴 감지는 P1-B(네이티브 모듈) 별도.

export type PrecheckReason = 'too_dark' | 'too_bright' | 'color_cast' | 'blur';

// B트랙 원자료 + 임계 튜닝용. 사진 자체가 아니라 집계 통계라 개인정보 아님.
export type PrecheckMetrics = {
  luma: number; // 중앙영역 평균 휘도(0-255)
  bright_clip: number; // 중앙영역 과다노출 화소 비율(0-1)
  rg_ratio: number; // 평균 R/G
  bg_ratio: number; // 평균 B/G
  sharpness: number; // 중앙영역 라플라시안 분산
};

export type PrecheckResult =
  | { ok: true; reason: null; metrics: PrecheckMetrics }
  | { ok: false; reason: PrecheckReason; metrics: PrecheckMetrics }
  | { ok: true; reason: null; metrics: null; error: 'measure_failed' };

export async function precheckImage(photoUri: string): Promise<PrecheckResult> {
  const t = CAPTURE.precheck;
  const measureFailed = { ok: true, reason: null, metrics: null, error: 'measure_failed' } as const;

  let data: Uint8Array;
  let width: number;
  let height: number;
  try {
    const ctx = ImageManipulator.manipulate(photoUri);
    ctx.resize({ width: t.size, height: t.size });
    const rendered = await ctx.renderAsync();
    const saved = await rendered.saveAsync({ base64: true, compress: 0.6, format: SaveFormat.JPEG });
    if (saved.uri) await deletePhotoFile(saved.uri); // 축소 임시본 즉시 폐기(사진 수명 원칙)
    if (!saved.base64) return measureFailed;
    const decoded = decodeJpeg(base64ToBytes(saved.base64), { useTArray: true });
    data = decoded.data;
    width = decoded.width;
    height = decoded.height;
  } catch (error) {
    console.log('[precheck] decode failed', error);
    return measureFailed;
  }
  if (!width || !height) return measureFailed;

  // 전체 썸네일 루마 버퍼(라플라시안 이웃 접근용)
  const luma = new Float32Array(width * height);
  for (let p = 0, q = 0; p < luma.length; p += 1, q += 4) {
    luma[p] = (data[q] * 299 + data[q + 1] * 587 + data[q + 2] * 114) / 1000;
  }

  // 중앙 크롭 경계(얼굴 근사) - 배경·머리카락 skew 차단
  const r = Math.min(Math.max(t.centerCropRatio, 0.1), 1);
  const cw = Math.max(3, Math.round(width * r));
  const ch = Math.max(3, Math.round(height * r));
  const sx = Math.floor((width - cw) / 2);
  const sy = Math.floor((height - ch) / 2);

  let sumL = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let clip = 0;
  let n = 0;
  for (let y = sy; y < sy + ch; y += 1) {
    for (let x = sx; x < sx + cw; x += 1) {
      const q = (y * width + x) * 4;
      sumR += data[q];
      sumG += data[q + 1];
      sumB += data[q + 2];
      const L = luma[y * width + x];
      sumL += L;
      if (L > t.brightClipLevel) clip += 1;
      n += 1;
    }
  }
  const meanL = sumL / n;
  const meanG = sumG / n || 1; // 0나눗셈 방어
  const rg = sumR / n / meanG;
  const bg = sumB / n / meanG;
  const brightClip = clip / n;

  // 라플라시안 분산(중앙영역 내부 화소만 - 상하좌우 이웃 존재 보장)
  let lapSum = 0;
  let lapSq = 0;
  let ln = 0;
  const ix0 = Math.max(1, sx);
  const ix1 = Math.min(width - 1, sx + cw);
  const iy0 = Math.max(1, sy);
  const iy1 = Math.min(height - 1, sy + ch);
  for (let y = iy0; y < iy1; y += 1) {
    for (let x = ix0; x < ix1; x += 1) {
      const c = luma[y * width + x];
      const lap =
        4 * c -
        luma[y * width + (x - 1)] -
        luma[y * width + (x + 1)] -
        luma[(y - 1) * width + x] -
        luma[(y + 1) * width + x];
      lapSum += lap;
      lapSq += lap * lap;
      ln += 1;
    }
  }
  const lapMean = ln ? lapSum / ln : 0;
  const sharpness = ln ? lapSq / ln - lapMean * lapMean : 0;

  const metrics: PrecheckMetrics = {
    luma: Math.round(meanL * 10) / 10,
    bright_clip: Math.round(brightClip * 1000) / 1000,
    rg_ratio: Math.round(rg * 1000) / 1000,
    bg_ratio: Math.round(bg * 1000) / 1000,
    sharpness: Math.round(sharpness * 10) / 10,
  };

  // 판정(극단만). 우선순위: 밝기 → 색치우침 → 선명도.
  let reason: PrecheckReason | null = null;
  if (meanL < t.lumaMin) reason = 'too_dark';
  else if (meanL > t.lumaMax || brightClip > t.brightClipFrac) reason = 'too_bright';
  else if (bg < t.bgMin || bg > t.bgMax || rg > t.rgMax) reason = 'color_cast';
  else if (sharpness < t.sharpnessMin) reason = 'blur';

  return reason ? { ok: false, reason, metrics } : { ok: true, reason: null, metrics };
}
