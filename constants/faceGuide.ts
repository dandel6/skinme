// 타원 오버레이 파라미터의 단일 소스.
// FaceGuideOverlay(화면 표시)와 lib/faceCrop(촬영본 크롭)이 함께 사용하므로
// 여기를 수정하면 오버레이와 크롭이 항상 같이 움직인다.
export const FACE_GUIDE = {
  centerXRatio: 0.5, // 화면 너비 기준 중심 X. 0.5가 아니면 전면 카메라 미러링으로 크롭이 어긋날 수 있음
  centerYRatio: 0.42, // 화면 높이 기준 중심 Y
  radiusXRatio: 0.36, // 화면 너비 기준 가로 반지름
  radiusYRatio: 0.5, // 화면 너비 기준 세로 반지름
  cropPaddingRatio: 0.1, // 크롭 바운딩 박스 여유 패딩(반지름 대비 10%)
} as const;

export type EllipseParams = { cx: number; cy: number; rx: number; ry: number };

export function ellipseForScreen(
  screenWidth: number,
  screenHeight: number,
): EllipseParams {
  return {
    cx: screenWidth * FACE_GUIDE.centerXRatio,
    cy: screenHeight * FACE_GUIDE.centerYRatio,
    rx: screenWidth * FACE_GUIDE.radiusXRatio,
    ry: screenWidth * FACE_GUIDE.radiusYRatio,
  };
}

export type CropRect = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

/**
 * 화면 좌표의 타원 바운딩 박스(+패딩)를 촬영본 픽셀 좌표로 변환한다.
 * 프리뷰는 cover 방식(사진을 화면이 가득 차게 확대·중앙 배치)이라고 가정 -
 * CameraView 전체화면 프리뷰의 기본 동작과 일치.
 * 결과는 사진 경계로 클램프된다.
 */
export function faceCropRect(
  screenWidth: number,
  screenHeight: number,
  photoWidth: number,
  photoHeight: number,
): CropRect {
  const { cx, cy, rx, ry } = ellipseForScreen(screenWidth, screenHeight);
  const pad = 1 + FACE_GUIDE.cropPaddingRatio;
  const scale = Math.max(screenWidth / photoWidth, screenHeight / photoHeight);
  const offsetX = (photoWidth * scale - screenWidth) / 2;
  const offsetY = (photoHeight * scale - screenHeight) / 2;

  const left = (cx - rx * pad + offsetX) / scale;
  const top = (cy - ry * pad + offsetY) / scale;
  const width = (rx * 2 * pad) / scale;
  const height = (ry * 2 * pad) / scale;

  // round: 부동소수점 오차(예: 144*1.1=158.400…02)로 floor가 1px 어긋나는 것 방지.
  // 이후 width/height 클램프가 경계 초과를 막는다.
  const originX = Math.min(Math.max(0, Math.round(left)), photoWidth - 1);
  const originY = Math.min(Math.max(0, Math.round(top)), photoHeight - 1);
  return {
    originX,
    originY,
    width: Math.max(1, Math.min(Math.round(width), photoWidth - originX)),
    height: Math.max(1, Math.min(Math.round(height), photoHeight - originY)),
  };
}
