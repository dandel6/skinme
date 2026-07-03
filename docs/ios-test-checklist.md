# iOS 실기기 테스트 체크리스트

> 작성 기준: 코드베이스 iOS 분기 전수 조사 (2026-07-05). 빌드: `eas build --profile development --platform ios` (애플 계정 승인 후).
> W1에서 Android 우선으로 개발됨 - 아래는 iOS에서 동작이 다르거나 미검증인 지점 전부.

## P0 - 코어 루프 (촬영→분석→오늘 탭)

- [ ] **조도 게이트 폴백** (`hooks/useLuminanceGate.ts`): iOS는 조도 센서가 없어 항상 2초 주기 무음 스냅샷 폴백.
  - [ ] 스냅샷마다 프리뷰가 끊기는지 (끊기면 주기 완화 또는 vision-camera 전환 검토)
  - [ ] 셔터음 발생 여부 - `shutterSound` 옵션은 **Android 전용**이라 iOS에서 무시됨. 지역 강제 셔터음 기기(일본 설정 등)에서 2초마다 소리가 나면 폴백 재설계 필요
  - [ ] 게이트 임계값(luma 16/11)이 iOS 카메라 노출 특성에서도 적절한지
- [ ] **화면 플래시** (`hooks/useFlashCapture.ts`): `setBrightnessAsync`가 iOS에선 **기기 전역 밝기**를 바꾸고 잠금 전까지 지속.
  - [ ] 촬영 후 밝기 원복 정상 동작
  - [ ] 촬영 중 앱 강제 종료 → 밝기가 최대로 남는지 (남으면 앱 재시작 시 원복 로직 추가 검토)
  - [ ] 800ms 노출 적응이 iOS 전면 카메라에서 충분한지 (사후 휘도 판정 통과율)
- [ ] **연사 2컷**: 컷 간 간격 실측(수백 ms 목표), 2컷째 품질 저하 여부
- [ ] **타원 크롭 정합** (`constants/faceGuide.ts`): cover 프리뷰 매핑 가정이 iOS에서도 성립하는지 - 크롭 결과가 화면 타원과 일치하는지, `takePictureAsync`의 width/height가 EXIF 회전 반영값인지
- [ ] **분석 왕복**: 업로드→분석→저장, 429 rate limit 문구, 분석 실패 재촬영 플로우

## P0 - 신뢰 인프라·촬영 폴백·동의 게이트 (2026-07-06 변경분)

- [ ] **사진 처리 고지 게이트** (`app/capture.tsx` useFocusEffect + `lib/onboarding.ts` `consentAcknowledged` 플래그):
  - [ ] 신규 설치 → 온보딩 ③(사진 처리 고지)에서 `확인했어요` 후 촬영 진입되는지
  - [ ] **딥링크 `skinme://capture` 직접 진입** → 고지 미확인이면 단독 고지 화면(mode=consent)으로 유도되는지
  - [ ] **기존 설치**(플래그 없이 스캔 보유) → 첫 촬영 진입 시 고지 1회 노출
  - [ ] 고지 화면에서 **하드웨어 백**으로 나가면 촬영 재포커스 시 고지로 재유도되는지(우회 불가)
  - [ ] `확인했어요` 후 재-push 없이 촬영 진행(플래그 커밋 레이스 없음)
  - [ ] Pro 유저도 고지 대상(과금 무관), dev 촬영 모드(repro/same-image)만 예외
- [ ] **촬영 폴백** (`app/capture.tsx` 완화 임계 40):
  - [ ] 사후 폐기(너무 어두움) **3회 연속** → 완화 촬영 제안 패널 표시
  - [ ] `이대로 찍기` 수락 → 완화 임계(40)로 촬영, 결과에서 톤·색소 held 표시
  - [ ] 완화 촬영도 40 미만이면 재제안 없이 `captureFallbackStillDark`(창가/조명) 안내
  - [ ] 제안 표시 중 조도가 극단암흑으로 떨어지면 `이대로 찍기`가 촬영 안 함(사전 게이트 불가침)
  - [ ] crop_failed/capture_failed 실패가 끼면 연속 스트릭 초기화(제안 조기 발생 안 함)
- [ ] **post_luma 기록** (`lib/luminance.ts` base64 수리 + `lib/photoQuality.ts` 사유 기록):
  - [ ] **밝은 환경** 촬영 스캔에서 `capture_context.post_luma`에 숫자 기록되는지(기존 null 대량 발생 해소)
  - [ ] 측정 실패 시 `post_luma_error`(render_failed/empty_base64/decode_failed/nan_result) 기록 - ⚠️ **`analyze-skin` 재배포 필요**(`--use-api`)
- [ ] **정직성/유분 안내** (`ScoreHeader`/`MetricGrid`):
  - [ ] 결과 화면 하단 `honestyNote` 상시 표시
  - [ ] `lighting !== good` 스캔에서만 유분 조명 안내(`oilLightingNote`) 노출
  - [ ] 색 지표 보류 시 `colorHeldNote`("색 지표는 다음에…") 표시

## P1 - 결제·경계 (W3 핵심)

- [ ] **RevenueCat iOS 키 미설정 상태**: 현재 `configurePurchases`가 iOS에서 키 없음으로 스킵됨(`lib/purchases/purchases.ts`) → 페이월이 "스토어 연결 불가"로 뜨는지 확인. **iOS 출시 전 `EXPO_PUBLIC_REVENUECAT_IOS_KEY` 추가 + configure 분기 구현 필요**
- [ ] App Store Connect 상품 2종(월/연, 14일 체험) 연결 후: offering 조회·구매·복원·취소 플로우
- [ ] 설정 > 구독 관리 딥링크 (`apps.apple.com/account/subscriptions`) 열림
- [ ] 무료 캡: KST 자정 경계 동작 (서버 판정이라 동일해야 하나 확인)

## P2 - 알림·UI

- [ ] **알림 권한**: iOS는 커스텀 권한 문구 키가 없음(시스템 다이얼로그 고정 문구) - 제품 등록 시 요청 타이밍이 어색하지 않은지
- [ ] 14일 예약 알림(DATE 트리거) 발화 - 단기 테스트: 제품 등록 직후 `verdict_at`를 SQL로 몇 분 뒤로 당겨 확인
- [ ] 포그라운드 배너 표시 (`shouldShowBanner/List`는 iOS 14+ 매핑)
- [ ] **탭바 중앙 셔터 돌출**: iOS 홈 인디케이터(safe area)와 겹침 - `tabBarStyle` 높이 62 고정이 노치 기기에서 하단 인셋을 침범하는지. **침범 시 `useSafeAreaInsets`로 height/paddingBottom 보정 필요** (알려진 리스크)
- [ ] 가이드 타원 위치(cy=화면높이 42%)가 노치/다이나믹 아일랜드 기기에서 적절한지
- [ ] RegisterModal 키보드(behavior=padding) 정상
- [ ] 카운트업·스프링·스캔라인 애니메이션 프레임 드랍 여부

## P3 - 기타

- [ ] 개발자 메뉴(3초 롱프레스, dev build만): 재현성/동일 이미지/미리보기/원본 보기 - 원본 보기 폰트 Menlo 적용 확인
- [ ] 페이월/설정/리포트 화면 레이아웃 (Dynamic Type 큰 글꼴 포함)
- [ ] 다크 모드: 현재 라이트 고정 (`userInterfaceStyle: "light"`) - 의도대로 강제되는지

## 알려진 iOS 분기 코드 목록 (조사 결과)

| 위치 | 분기 내용 | 리스크 |
|---|---|---|
| `hooks/useLuminanceGate.ts` | Android=조도 센서 / iOS=2초 스냅샷 폴백 | 프리뷰 끊김·셔터음·배터리 |
| `hooks/useFlashCapture.ts` | 밝기 API가 iOS에선 기기 전역·잠금까지 지속 | 크래시 시 밝기 미원복 |
| `lib/purchases/purchases.ts` | iOS API 키 미구현(W3 후반) → configure 스킵 | 페이월 동작 불가 (예정된 갭) |
| `app/settings.tsx` | 구독 관리 URL 플랫폼 분기 | 낮음 |
| `components/verdict/RegisterModal.tsx` | KeyboardAvoidingView iOS=padding | 낮음 |
| `components/dev/RawScanView.tsx` | 폰트 iOS=Menlo | 낮음 (dev 전용) |
| 촬영 옵션 `shutterSound` | Android 전용 - iOS 무시 | 지역 강제 셔터음 |
| `app/(tabs)/_layout.tsx` 탭바 높이 62 고정 | iOS safe area 미보정 가능성 | **중간 - 확인 후 보정** |
