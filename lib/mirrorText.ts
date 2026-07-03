// evidence 좌/우 표기의 거울 기준 정규화.
// 파이프라인의 촬영본은 비미러 원본 방향(CameraView mirror={false} 고정)이고
// 프롬프트 v0.8이 좌/우를 "이미지 기준"으로 서술하므로:
//   이미지 왼쪽 = 해부학적 오른쪽 = 유저가 거울에서 보는 오른쪽.
// → 표시 시 왼/오를 스왑하면 유저 거울 기준이 된다.
const SWAP_TOKEN = '\u0000'; // NUL - evidence 본문에 등장 불가한 문자

export function toMirrorBasis(text: string): string {
  return text
    .replaceAll('왼쪽', SWAP_TOKEN)
    .replaceAll('오른쪽', '왼쪽')
    .replaceAll(SWAP_TOKEN, '오른쪽')
    .replaceAll('좌측', SWAP_TOKEN)
    .replaceAll('우측', '좌측')
    .replaceAll(SWAP_TOKEN, '우측');
}

/** 좌/우 위치 언급 여부 - "위치는 거울 기준" 캡션 표시 판단용 */
export function mentionsSide(text: string): boolean {
  return /왼쪽|오른쪽|좌측|우측/.test(text);
}
