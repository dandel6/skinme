// 개발자 전용 문자열 - __DEV__ require 체인에서만 로드되어 프로덕션 번들에서 제외됨.
// 유저 대면 문자열은 constants/strings.ts에 유지.
export const DEV_STRINGS = {
  devMenuTitle: '개발자 메뉴',
  devMenuClose: '닫기',
  devReproTest: '재현성 테스트',
  devSameImageTest: '동일 이미지 재분석 테스트',
  sameImageTitle: '동일 이미지 재분석',
  devViewRawScan: '최근 스캔 원본 보기',
  devVerdictPreview: '판정 미리보기',
  devMockPreview: '판정 미리보기 (mock)',
  devProBypassPrefix: 'Pro 우회',

  reproTitle: '재현성 테스트',
  reproBannerSuffix: '한 셔터 연사 2컷 분석',
  reproPass: 'PASS',
  reproFail: 'FAIL',
  reproMaxDiffLabel: '최대 차이',
  reproShot1: '1회',
  reproShot2: '2회',
  reproDiffLabel: '차이',
  reproExcludedNote: '측정 보류로 비교 제외',
  reproEmpty: '테스트 결과가 없어요',

  rawScanEmpty: '표시할 스캔이 없어요',

  previewBanner: '미리보기 - 실제 판정 아님',
  previewEmpty: '미리보기 데이터가 없어요',
  previewPickerTitle: '제품 선택',
  mockPickerTitle: '상태 선택',
  mockLabels: {
    improved: '개선',
    unchanged: '변화 없음',
    worsened: '악화',
    no_scans: '판정 불가',
    color_held: '색 보류',
  },
} as const;
