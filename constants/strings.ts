export const STRINGS = {
  tabToday: '오늘',
  tabVerdict: '리포트',

  captureGuide: '얼굴을 타원 안에 맞춰주세요',
  lowLight: '조금 더 밝은 곳으로 가면 바로 찍을 수 있어요.', // 사전게이트 저조도 안내(=GateHint)
  lightChecking: '조도 확인 중…',
  captureFailed: '촬영에 실패했어요. 다시 시도해주세요.',
  capturedTooDark: '얼굴이 너무 어둡게 나왔어요. 화면을 얼굴에 조금 더 가까이 해주세요',
  privacyNotice: '사진은 분석 후 즉시 삭제됩니다',
  // 촬영 폴백(3회 연속 폐기 후). 행동모드라 지표명 나열 없이 부분성공 프레임.
  captureFallbackOffer: '대부분 항목은 지금도 측정돼요. 색감 관련은 밝은 곳에서 이어서 볼 수 있어요.',
  captureFallbackOfferAccept: '이대로 찍기',
  captureFallbackOfferDismiss: '다시 맞춰볼게요',
  captureFallbackStillDark: '창가나 조명 아래로 옮기면 바로 찍을 수 있어요.', // 완화 촬영도 폐기 시(광원 특정 격상)
  captureFallbackHeldNote: '톤·색소는 다음에 밝은 곳에서 보면 채워져요.', // 결과 화면 held 카드용(배선 대기)
  // 온디바이스 프리게이트 차단 사유 (API 호출 전, 사유별 구체 안내 - 문제+행동, 유저 탓 없음)
  precheckBlockTooDark: '너무 어두워요 - 밝은 곳에서 다시 찍어주세요',
  precheckBlockTooBright: '너무 밝아요 - 조명이나 플래시에서 조금 떨어져서 다시 찍어주세요',
  precheckBlockColorCast: '조명 색이 한쪽으로 치우쳐 있어요 - 흰 조명이나 자연광에서 찍어주세요',
  precheckBlockBlur: '흔들렸어요 - 휴대폰을 고정하고 다시 찍어주세요',
  // 같은 사유 3회 연속 차단 시 우회(무한 차단 루프 금지). 사유 무관 중립 문구.
  precheckOverrideOffer:
    '여러 번 조건이 잘 안 맞았어요. 그대로 분석할 수도 있는데, 결과가 평소보다 부정확할 수 있어요.',
  precheckOverrideAccept: '그래도 분석하기',
  precheckOverrideDismiss: '다시 찍기',

  permissionTitle: '카메라 권한이 필요합니다',
  permissionBody: '피부 촬영을 위해 카메라 접근을 허용해주세요.',
  permissionButton: '권한 허용',
  permissionSettings: '설정에서 카메라 권한을 허용해주세요.',

  analyzing: '피부 데이터 측정 중...',
  analyzeMetrics: ['모공', '피부결', '트러블', '붉은기', '피부톤'],
  close: '닫기',
  stageUploading: '업로드 중…',
  stageAnalyzing: '분석 중…',
  stageSaving: '저장 중…',
  analysisFailed: '분석 실패, 다시 촬영해주세요',
  rateLimited: '잠시 후 다시 시도해주세요',
  retakeButton: '다시 촬영',
  connectionFailed: '연결 실패 - 네트워크를 확인해주세요',
  configMissing: '설정 오류 - 서버 주소가 비어 있어요 (.env 확인)',

  scoreLabel: '종합 점수',
  confidenceLabels: {
    high: '신뢰도 높음',
    mid: '신뢰도 중간',
    low: '신뢰도 낮음',
  },
  structuralSection: '피부 표면',
  colorSection: '피부 톤',
  oilMoistureLabel: '유수분',
  heldPrefix: '측정 보류',
  // P0 Phase 4 - 정직성 표기·처리 고지·유분 조명 안내
  honestyNote: '사진을 바탕으로 한 분석이라, 실제 피부와 조금 다를 수 있어요.',
  consentTitle: '사진은 이렇게 다뤄요',
  consentBody: '찍은 사진은 AI가 분석해요. 분석이 끝나면 원본은 바로 삭제하고, 결과 숫자만 보관해요.',
  consentAccept: '확인했어요',
  oilLightingNote: '유분은 조명에 따라 다르게 보일 수 있어요. 밝은 곳에서 보면 더 정확해요.',
  priorityTitle: '지금 우선순위 1가지',
  historyTitle: '스캔 히스토리',
  scansLoadFailed: '기록을 불러오지 못했어요',
  metricLabels: {
    pores: '모공',
    texture: '피부결',
    blemish: '트러블',
    redness: '붉은기',
    tone_evenness: '피부톤',
    pigment: '색소',
  },

  todayCaptureButton: '피부 촬영하기',
  emptyValueLine: '같은 조건으로 찍으면,\n피부 변화가 숫자로 보여요',
  emptyGuide: '아래 셔터를 눌러 첫 측정을 시작하세요',
  notMeasuredToday: '오늘 측정 전',
  notMeasuredHint: '아래 셔터를 눌러 오늘 상태를 기록하세요',

  verdictEmpty: '사용 중인 제품을 등록하면 14일 뒤\n효과를 알아볼 수 있어요',
  whyFourteenDays: '피부가 한 번 새로 돌아오는 시간, 2주. 그때가 돼야 효과가 눈에 보여요.',

  productRegister: '제품 등록',
  productNamePlaceholder: '제품 이름 (예: ○○ 세럼)',
  registerSubmit: '등록',
  registerCancel: '취소',
  registerFailed: '제품 등록에 실패했어요. 다시 시도해주세요.',
  productsLoadFailed: '제품 목록을 불러오지 못했어요',
  notifPermissionNote: '알림 권한이 꺼져 있어서 판정 알림 없이 진행돼요',

  verdictWaitingPrefix: '리포트',
  verdictWaitingHint: '리포트 전에 몇 번 더 측정하면 정확도가 올라가요',
  startVerdictEntry: '사용 중인 화장품, 효과 있을까?',
  startVerdictEntryStale: '오늘 피부부터 재볼까요?',
  registerBaselineNote: '방금 스캔이 리포트 기준선이 돼요',
  registerBaselineNoteNow: '지금 측정한 상태가 기준선이 돼요',
  renameAction: '이름 수정',
  deleteAction: '삭제',
  renameSubmit: '저장',
  renameFailed: '이름 수정에 실패했어요. 다시 시도해주세요.',
  deleteFailed: '삭제에 실패했어요. 다시 시도해주세요.',
  deleteCancel: '취소',
  verdictReady: '리포트 준비 완료',
  verdictReadyHint: '탭해서 리포트 보기',
  verdictDone: '리포트 완료',
  verdictNoScans: '리포트를 만들려면 최근 스캔이 필요해요',
  verdictNotReadyYet: '아직 리포트 시점이 아니에요 - 14일 뒤에 확인할 수 있어요',
  verdictSaveFailed: '리포트 저장에 실패했어요. 다시 시도해주세요.',
  verdictStartedPrefix: '시작',

  verdictOutcomeLabels: {
    improved: '개선',
    unchanged: '변화 없음',
    worsened: '악화',
  },
  baselineKindLabels: {
    pre_7d: '기준선: 시작 전 7일 스캔',
    first_scan_after_start: '기준선: 시작 시점 스캔',
  },
  colorHoldReasonInsufficient: '조명 양호 스캔 부족',
  verdictHoldPrefix: '집계 보류',

  reportTitle: '리포트',
  reportBaseline: '기준선',
  reportCurrent: '현재',
  reportLoadFailed: '리포트를 불러오지 못했어요',
  reportConfidenceLowNote: '측정이 많을수록 리포트가 정확해져요',
  shareButton: '결과 공유하기',
  shareScoreButton: '오늘 점수 공유',
  sharePreviewLabel: '공유 이미지 미리보기',
  shareCardCopy: '같은 조건으로 재면, 변화가 숫자로 보입니다',
  scoreCardLabel: '오늘 피부 점수',

  scoreBasisPrefix: '산정: ',

  capReached: '오늘 측정 완료 - 내일 다시',
  lockedDetail: '탭하여 상세 분석 보기',
  metricDetailCta: '지표별 근거·개선 가이드 보기 · Pro',

  paywallTitle: 'SkinMe Pro',
  paywallValues: ['지표별 근거 분석', '추이 그래프', '14일 효능 리포트'],
  paywallMonthly: '월간',
  paywallAnnual: '연간',
  paywallTrialNote: '한 달 무료 체험 후 자동 갱신 · 언제든 해지할 수 있어요',
  paywallCta: '무료 체험 시작',
  paywallRestore: '구매 복원',
  paywallRestoreDone: '구매를 복원했어요',
  paywallRestoreNone: '복원할 구매 내역이 없어요',
  paywallRestoreFailed: '복원 중 문제가 생겼어요 - 네트워크를 확인해주세요',
  paywallUnavailable: '스토어에 연결할 수 없어요 - 결제는 개발 빌드/스토어 빌드에서만 할 수 있어요',
  paywallFailed: '구매를 완료하지 못했어요. 다시 시도해주세요.',
  paywallLoadFailed: '상품 정보를 불러오지 못했어요',

  trendTitle: '추이',
  trendWeek: '주',
  trendMonth: '월',
  trendOverall: '종합',
  trendEmpty: '추이를 보려면 스캔이 2개 이상 필요해요',

  priorityRepeatPrefix: '어제도 우선순위',
  sampleReportLabel: '14일 뒤, 이런 답을 받아요',
  sampleWatermark: 'SAMPLE',
  reportNextTitle: '다음으로 확인할 제품이 있나요?',
  reportExtendTrack: '이 제품 4주 더 추적하기',
  cycleBadgeSuffix: '차 추적',
  ingredientSearchCopy: '검색어 복사',
  copiedToast: '복사됐어요',
  ingredientBridge: '이 성분을 시작했다면, 제품으로 등록하고 2주 뒤 효과를 확인하세요',
  ingredientPickTitle: '고르는 법',
  ingredientWhyTitle: '왜 지금 내 피부에',
  ingredientWhatTitle: '무슨 성분인지',

  weeklySummaryBody: '이번 주 피부 기록을 확인해보세요 - 숫자는 쌓일수록 정확해져요',

  onboardingSkip: '건너뛰기',
  onboardingNext: '다음',
  onboarding1Title: '당신의 거울은\n매일 거짓말을 합니다',
  onboarding1Body: '조명과 기분에 따라 피부는 매일 달라 보여요.\n그래서 같은 조건으로 재야 변화가 눈에 보여요.',
  onboarding2Title: '매번 같은 조건으로 찍어요',
  onboarding2Body: '타원 가이드 + 화면 플래시로 촬영을 고정해서,\n점수 변화가 곧 피부 변화가 돼요.',
  onboarding2Privacy: '사진은 분석 후 즉시 삭제됩니다',
  onboarding3Title: '지금 제일 궁금한 건?',
  onboarding3OptionA: '내 피부 상태 점수',
  onboarding3OptionB: '쓰는 화장품이 효과 있는지',

  settingsTitle: '설정',
  settingsWeeklySummary: '주간 요약 알림',
  settingsManageSubscription: '구독 관리',
  settingsRestore: '구매 복원',
  settingsPrivacy: '개인정보처리방침',
  settingsContact: '문의',
  settingsVersion: '앱 버전',
  settingsDeleteAll: '기록 전체 삭제',
  deleteAllConfirmMessage:
    '모든 스캔과 리포트 기록이 삭제돼요. 되돌릴 수 없어요.\n구독은 별개예요 - 해지는 스토어의 구독 관리에서 해주세요.',
  deleteAllFailed: '기록 삭제에 실패했어요. 다시 시도해주세요.',
  settingsDeleteAccount: '계정·데이터 완전 삭제',
  deleteAccountConfirmMessage:
    '계정과 모든 데이터가 영구 삭제돼요. 되돌릴 수 없어요.\n구독은 별개예요 - 해지는 스토어의 구독 관리에서 해주세요.',
  deleteAccountFailed: '계정 삭제에 실패했어요. 다시 시도해주세요.',
} as const;

export function verdictNotificationBody(productName: string): string {
  return `『${productName}』 2주 리포트가 도착했어요`;
}

export function milestoneNotificationBody(scanCount: number): string {
  return `반환점이에요. 지금까지 ${scanCount}회 측정 - 몇 번 더 재면 리포트가 더 정확해져요`;
}

export function reportDdayBanner(productName: string, daysLeft: number): string {
  return `『${productName}』 리포트까지 D-${daysLeft}`;
}

export function priorityContinuityLine(
  metricLabel: string,
  previousScore: number,
  currentScore: number,
): string {
  return `어제도 우선순위 - ${metricLabel} ${Math.round(previousScore)}→${Math.round(currentScore)}`;
}

// 결과 화면 색 지표 보류 안내. held 개수(1~3) 무관하게 성립하는 집합 표현 + 긍정 프레임.
export const colorHeldNote = '색 지표는 다음에 밝은 곳에서 보면 채워져요.';

export function deleteConfirmMessage(productName: string): string {
  return `『${productName}』 리포트 기록이 삭제돼요. 되돌릴 수 없어요`;
}

// 동시 추적 경고 - 등록 차단 아님, 해석 오류 예방용 안내
export function concurrentTrackingWarning(productName: string): string {
  return `아직 『${productName}』 추적이 끝나지 않았어요. 동시에 쓰면 어느 쪽 효과인지 구분이 어려워요`;
}

// 측정 스트릭 - 보상 표시만(끊김 경고 없음)
export function streakContinueLabel(days: number): string {
  return `${days}일 연속 측정`;
}
export function streakResumeLabel(days: number): string {
  return `어제까지 ${days}일 연속 - 오늘 재면 이어져요`;
}
