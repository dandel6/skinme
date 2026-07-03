// 개발자 전용 라우트 셸 - 프로덕션에서는 본문 모듈이 번들에서 제외되고 null 렌더.
const Inner = __DEV__
  ? (require('../components/dev/VerdictPreviewView') as typeof import('../components/dev/VerdictPreviewView'))
      .VerdictPreviewView
  : null;

export default function VerdictPreviewScreen() {
  return Inner ? <Inner /> : null;
}
