import { decode as decodeJpeg } from 'jpeg-js';

const B64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const B64_LOOKUP = (() => {
  const table = new Uint8Array(128);
  for (let i = 0; i < B64_CHARS.length; i += 1) {
    table[B64_CHARS.charCodeAt(i)] = i;
  }
  return table;
})();

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  // 패딩(=) 제거로 길이가 4의 배수가 아닐 수 있다. 말단 2·3자 그룹까지 디코드해야
  // JPEG 끝 바이트(EOI FF D9)가 보존된다 - 유실 시 jpeg-js가 EOI를 못 찾고 throw.
  const fullGroups = Math.floor(clean.length / 4);
  const remainder = clean.length - fullGroups * 4; // 0, 2, 또는 3 (1은 부정 인코딩)
  const tailBytes = remainder === 2 ? 1 : remainder === 3 ? 2 : 0;
  const bytes = new Uint8Array(fullGroups * 3 + tailBytes);
  let out = 0;
  let i = 0;
  for (let g = 0; g < fullGroups; g += 1, i += 4) {
    const a = B64_LOOKUP[clean.charCodeAt(i)];
    const b = B64_LOOKUP[clean.charCodeAt(i + 1)];
    const c = B64_LOOKUP[clean.charCodeAt(i + 2)];
    const d = B64_LOOKUP[clean.charCodeAt(i + 3)];
    bytes[out++] = (a << 2) | (b >> 4);
    bytes[out++] = ((b & 15) << 4) | (c >> 2);
    bytes[out++] = ((c & 3) << 6) | d;
  }
  if (remainder >= 2) {
    const a = B64_LOOKUP[clean.charCodeAt(i)];
    const b = B64_LOOKUP[clean.charCodeAt(i + 1)];
    bytes[out++] = (a << 2) | (b >> 4);
    if (remainder === 3) {
      const c = B64_LOOKUP[clean.charCodeAt(i + 2)];
      bytes[out++] = ((b & 15) << 4) | (c >> 2);
    }
  }
  return bytes;
}

// Rec.601 정수 근사 평균 휘도(0-255). 축소본(32~64px) 기준이라 수 ms 내 완료.
// centerCropRatio < 1이면 중앙 크롭(가로·세로 각 비율)만 측정 - 타원 영역 근사.
export function averageLuminance(
  jpegBytes: Uint8Array,
  centerCropRatio = 1,
): number {
  const { data, width, height } = decodeJpeg(jpegBytes, { useTArray: true });
  if (width === 0 || height === 0) return 0;
  const ratio = Math.min(Math.max(centerCropRatio, 0.01), 1);
  const cropWidth = Math.max(1, Math.round(width * ratio));
  const cropHeight = Math.max(1, Math.round(height * ratio));
  const startX = Math.floor((width - cropWidth) / 2);
  const startY = Math.floor((height - cropHeight) / 2);
  let sum = 0;
  for (let y = startY; y < startY + cropHeight; y += 1) {
    for (let x = startX; x < startX + cropWidth; x += 1) {
      const offset = (y * width + x) * 4;
      sum +=
        (data[offset] * 299 + data[offset + 1] * 587 + data[offset + 2] * 114) /
        1000;
    }
  }
  return sum / (cropWidth * cropHeight);
}
