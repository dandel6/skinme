// 개발자 전용 라우트 셸 - 프로덕션에서는 본문 모듈이 번들에서 제외되고 null 렌더.
const Inner = __DEV__
  ? (require('../components/dev/RawScanView') as typeof import('../components/dev/RawScanView'))
      .RawScanView
  : null;

export default function RawScanScreen() {
  return Inner ? <Inner /> : null;
}
