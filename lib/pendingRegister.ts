// "새로 측정하고 판정 시작하기" 플로우: 촬영 완료 후 오늘 탭 복귀 시
// 등록 모달을 자동으로 열기 위한 1회성 플래그.
let pending = false;

export function setPendingRegister(): void {
  pending = true;
}

export function consumePendingRegister(): boolean {
  const value = pending;
  pending = false;
  return value;
}
