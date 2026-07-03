# W3 전체 코드베이스 정밀 감사

- 일자: 2026-07-05 · 산출물: 본 보고서 1건 (코드 무변경)
- 방법: CLAUDE.md 확정 설계·스코프 밖·백로그 정독 후, 전 소스 read/grep 실측으로 파일·라인 앵커 확보. 확정 설계에 대한 재설계 제안 없음 - 결함·리스크만.
- 등급: **P0** 출시 차단 / **P1** 출시 전 권장 / **P2** 백로그

---

## 1. 보안·프라이버시

### [P1] 사전 게이트 폴백 스냅샷 원본이 삭제되지 않음 - "폐기 사진도 파일 삭제" 원칙 위반
- 파일: `app/capture.tsx:62-76` (`sampleSnapshot` - `takePictureAsync` 후 `photo.uri`를 삭제하는 코드 없음)
- 재현: iOS(센서 없음) 또는 조도 센서 미탑재 Android에서 촬영 화면 체류 → 2초마다 저화질 전면 셀카가 캐시에 생성·잔존. 5분 체류 시 ~150장 누적.
- 방향: `photoAverageLuminance` 측정 직후 `deletePhotoFile(photo.uri)` 호출. `lib/photoQuality.ts:18-22`의 `saveAsync` 축소본(`saved.uri`)도 동일하게 측정 후 삭제.

### [P1] scans INSERT 정책이 클라이언트 직접 삽입을 허용 - 위조 스캔 경로
- 파일: `supabase/migrations/20260704000000_scans_products.sql:36-37` (`scans_insert_own`), 서버 삽입은 `supabase/functions/analyze-skin/index.ts:180-184`
- 재현: anon key + 본인 JWT로 REST에서 `scans`에 임의 `result` JSON insert → 분석을 거치지 않은 점수로 판정·추이 오염 가능 (zod 스키마만 맞추면 클라이언트 검증 통과).
- 방향: edge function의 insert를 service role 클라이언트로 전환하고 `scans_insert_own` 정책 제거. (분석 경로가 유일한 쓰기 경로가 됨 - 확정 설계 변경 아님, 쓰기 경로 봉인.)

### [P1] 기록 전체 삭제가 auth 계정·analysis_requests를 남김
- 파일: `app/settings.tsx:49-58` (scans·products만 삭제), `supabase/migrations/20260705090000_canary_and_rate_limit.sql:17-27` (`analysis_requests`는 delete 정책 자체가 없고 FK cascade도 없음)
- 재현: 기록 전체 삭제 실행 → `auth.users` 익명 행과 `analysis_requests`의 user_id 행이 영구 잔존.
- 방향: service role edge function에서 `auth.admin.deleteUser`(scans/products는 FK cascade) + `analysis_requests` 삭제까지 원자 처리. 축 5의 계정 삭제 요건과 하나로 해결 가능.

### [P2] 분석 응답 전체 JSON을 콘솔에 로그 - 프로덕션 console.log 잔존
- 파일: `lib/analysis/useSkinAnalysis.ts:61` (`JSON.stringify(data)` - 피부 평가 evidence 전문 포함), 전 소스 console.log 63건(19파일, grep 실측)
- 재현: 프로덕션 빌드도 Metro는 console.log를 제거하지 않음 - adb logcat으로 열람 가능.
- 방향: `babel-plugin-transform-remove-console`(prod만) 또는 로그 유틸로 승격. base64 금지 원칙은 전 구간 준수 확인됨.

### 양호 확인 (조치 불요)
- 시크릿: ANTHROPIC_API_KEY·SERVICE_ROLE은 edge function `Deno.env`에서만 참조(grep 전수), `.env` gitignore 처리, `.env.example`에 금지 주석 존재. 클라이언트에는 anon key만.
- RLS 커버리지 전수: scans S/I/D(U 불요·미존재), products S/I/U/D, analysis_requests I/S, canary_logs 정책 없음(=service role 전용, 의도됨). 익명 유저 경계는 전부 `auth.uid() = user_id`.
- 이미지 본류: 원본 연사 2컷 즉시 삭제(`capture.tsx:120`), 실패 시 크롭본 폐기(`:122`, `:161-164`), 분석 후 삭제(`:210`) - 위 폴백 스냅샷 건 제외하면 수명 관리 정상.
- 익명 세션 유실(기기 초기화 시 데이터 접근 불능)은 백로그 "세션 persist 점검"에 이미 등재 - 중복 제안하지 않음.

---

## 2. 결제·수익 경로

### [P1] 무료 일 1회 캡이 서버에서 강제되지 않음 - 원가 방어가 클라이언트 신뢰에 의존
- 파일: `supabase/functions/analyze-skin/index.ts:138-151` (10회/시 rate limit만 존재, 일 캡 없음), `hooks/useDailyCap.ts:5-14` (실패 시 null=fail-open), `components/CaptureTabButton.tsx:30` (fail-open 동일)
- 재현: ① RPC만 실패하는 네트워크 상태(또는 앱 조작)에서 캡 무시 촬영 ② anon JWT로 edge function 직접 반복 호출 - 서버는 시간당 10회까지 통과 → 이론상 무료 유저 일 240회 분석(원가 ≈ 정상 유저 240배).
- 방향: edge function에서 non-Pro 유저에 한해 `scans_today_count() >= 1`이면 429/402 반환. 서버가 Pro 여부를 알아야 하므로 RevenueCat webhook(또는 서버 API 조회)으로 entitlement를 DB에 적재하는 배선이 선행 필요.
- P0가 아닌 근거: 10회/시 백스톱이 존재하고, 우회에는 REST 직접 호출 수준의 의도적 조작이 필요.

### [P1] 딥링크로 캡 우회 진입 가능 - capture 라우트 자체에 캡 검사 없음
- 파일: `app.json:6` (`"scheme": "skinlog"`), `app/capture.tsx` 전체 (todayCount 검사 없음 - 캡 검사는 진입 버튼들에만: `CaptureTabButton.tsx:35`, `verdict.tsx:155`)
- 재현: 캡 도달 무료 유저가 `skinlog://capture` 딥링크(또는 알림·외부 링크 경유)로 진입 → 촬영·분석·저장 전부 정상 동작.
- 방향: capture 화면 mount 시 `fetchTodayCount()` 재검사 후 캡이면 페이월로 replace. (위 서버 강제가 되면 이 항목은 UX 방어선으로 격하.)

### [P1] configure 실패 시 Pro 복구 경로 없음 - 재시도 부재
- 파일: `lib/purchases/usePro.ts:42-47` (`configured` false면 `ready=true`로 종료, 이후 재시도 없음), `lib/purchases/purchases.ts:31-47`
- 재현: 앱 시작 시점에 일시 오류로 `configure` throw → Pro 유저가 이번 실행 내내 무료 취급(재시작 전까지). RevenueCat 로컬 캐시는 configure 성공이 전제라 도움 안 됨.
- 방향: AppState active 복귀 시 미구성 상태면 `initPurchases` 재시도. 구매 복원 버튼도 `purchasesAvailable()` false일 때 안내 문구 분화.

### [P2] 오프라인 복원 실패가 "복원할 구매 내역이 없어요"로 오도
- 파일: `lib/purchases/purchases.ts:88-95` (에러를 null로 흡수), `app/settings.tsx:84-87`, `app/paywall.tsx:61-74`
- 재현: 기내모드에서 구매 복원 → 네트워크 실패인데 "내역 없음" 표기 → Pro 유저가 구매 상태를 오인.
- 방향: restore 실패(throw)와 내역 없음(null 아님, entitlement 부재)을 구분해 문구 분리.

### [P2] today 탭 등록 핸들러의 도달 불능 분기
- 파일: `app/(tabs)/today.tsx:97-108` - `capped`는 `!isPro && …`(:59)인데 `else if (capped)`는 `isPro === true`인 분기에서만 평가되므로 항상 false. 기능 영향 없음(Pro는 캡 비대상)이나 의도 오독 소지.
- 방향: 죽은 분기 제거 또는 주석으로 의도 명시.

### [P2] iOS RevenueCat 키 미배선 (계획된 상태)
- 파일: `lib/purchases/purchases.ts:34-35` (Android 키만, iOS는 빈 문자열 → configure 생략 로그 `:37`)
- W3 후반 iOS 작업 시 체크리스트: iOS 키 추가 전 iOS 빌드를 배포하면 페이월이 전면 "스토어 연결 불가"로 뜸.

---

## 3. 견고성

### [P1] 분석 호출에 타임아웃·취소가 없음 - AnalyzingView 무한 대기 시 탈출 불가
- 파일: `lib/analysis/useSkinAnalysis.ts:43-45` (`functions.invoke`에 타임아웃 없음), `app/capture.tsx:174-216` (AnalyzingView 렌더 중 닫기 버튼 없음 - X버튼은 카메라 상태 전용 `:249-255`)
- 재현: 업로드 도중 네트워크가 응답 없이 유실되는 상태(엘리베이터 등) → invoke가 영원히 pending → 유저는 분석 애니메이션에 갇힘, 강제종료만 가능.
- 방향: AbortController + 상한(예: 60초) 후 `AnalysisErrorView`로 전환. 크롭본 삭제는 기존 onRetake 경로 재사용.

### [P2] 강제종료 시 잔존물 정리 루틴 없음
- 크롭본: 분석 중 앱 강제종료 → 캐시에 크롭 셀카 잔존 (`capture.tsx:127`에서 확정된 uri). 다음 실행 시 정리 없음.
- iOS 밝기: 플래시 중 강제종료 → 기기 전역 최대 밝기 잔존 (`hooks/useFlashCapture.ts:22-26`에 리스크 문서화됨, 복구 로직은 없음).
- 방향: 앱 시작 시 1회 - 캐시 디렉토리의 자사 임시 이미지 삭제 + (iOS) 밝기 원복은 저장해둔 값이 없어 불가하므로 시스템 밝기로 재설정하지 않고 문서화 유지가 현실적. 크롭본 정리만 권장.

### [P2] 알림 예약의 부분 실패 시나리오
- 파일: `lib/notifications.ts:117-126` - `rescheduleVerdictNotification`이 취소 후 재예약인데, 취소 성공·재예약 실패 시 알림이 소실됨(개명 흐름). `hooks/useProducts.ts:99-104` - insert 성공 후 알림 예약 전 앱 종료 시 알림 없는 제품(고아 아님, 미예약).
- 재현: 개명 직후 권한이 회수된 상태 등 저빈도.
- 방향: 재예약 실패 시 콘솔 외 사용자 노출은 불요하나, verdict 탭 진입 시 "예약 알림 없음 + verdict_at 미래" 제품을 감지해 재예약하는 자가치유 1줄이면 고아·미예약 모두 해소.

### [P2] notifDenied 안내가 등록한 화면에서 보이지 않는 경우
- 파일: `hooks/useProducts.ts:37,100` (인스턴스 로컬 state), 안내 렌더는 `app/(tabs)/verdict.tsx:133`뿐
- 재현: 오늘 탭(RegisterModal)이나 리포트 화면에서 등록 + 알림 거부 → `notifDenied`는 그 화면의 훅 인스턴스에만 설정되고 verdict 탭 인스턴스는 별개라 안내 미노출.
- 방향: notifDenied를 등록 결과 반환값으로 승격해 호출 화면에서 표시하거나, 모듈 스토어로 공유.

### [P2] 기록 전체 삭제의 비원자성
- 파일: `app/settings.tsx:49-58` - scans 삭제 성공 후 products 삭제 실패 시 부분 삭제 상태로 종료(재시도는 가능).
- 방향: 단일 RPC(또는 축 1의 계정 삭제 edge function)로 원자화.

---

## 4. 데이터 정합

### [P1] 판정 실행 가능 여부를 클라이언트 시계로 판정 - 14일 고정의 우회 경로
- 파일: `components/verdict/ProductCard.tsx:9-11` (`now >= verdict_at`이면 ready), `app/(tabs)/verdict.tsx:52-98` (`runVerdict`에 서버 시각 재검증 없음)
- 재현: 기기 시계를 +14일로 변경 → 등록 직후 [리포트 준비 완료] → 판정 실행·저장(비교군=방금 스캔 1개, 기준선=같은 스캔) → outcome "변화 없음"이 영구 저장되고 카드가 done으로 고정.
- 방향: `runVerdict`에서 서버 now() RPC로 `verdict_at` 경과를 확인 후 진행. (확정 설계인 14일 고정을 지키는 방어 - 설계 변경 아님.)
- 부수 확인: 조기 판정 시 기준선과 비교군이 동일 스캔이 될 수 있음(위 재현). 서버 검증 하나로 함께 봉인됨.

### [P2] D-n 계산이 클라이언트 시계·비KST 경계
- 파일: `app/(tabs)/today.tsx:67-69` (`Math.ceil((verdict_at - Date.now())/DAY_MS)`), `components/verdict/ProductCard.tsx:31`
- 재현: 자정 전후·시간대 변경 시 D-n이 캡 기준(서버 KST)과 하루 어긋나 보일 수 있음. 표기 문제일 뿐 판정 로직엔 무영향.
- 방향: 표기용이므로 유지 가능. 통일하려면 서버 now() 1회 조회 후 오프셋 보정.

### [P2] n차 추적 뱃지 - 동일 이름·동일 started_at 동률
- 파일: `app/(tabs)/verdict.tsx:139-143` (`started_at < product.started_at` 엄격 비교)
- 재현: 같은 이름을 같은 밀리초에 2건 등록(사실상 수동 재현 불가, "4주 더 추적"은 now라 충돌 없음) → 둘 다 1차 표기.
- 방향: 동률 시 id 보조 정렬 1줄. 실질 위험 낮음.

### [P2] 비교군 창(판정 전 7일) 밖 지연 실행 엣지
- 파일: `lib/verdict/computeVerdict.ts:76-81` - 비교군은 항상 `verdict_at` 이전 7일. D+1~7에만 스캔하고 D+15에 실행하면 no_scans("최근 스캔이 필요해요")인데, 유저의 최신 스캔은 존재하므로 문구가 오해될 수 있음.
- 방향: 로직은 확정 설계 부합 - 문구만 "리포트 기간(마지막 7일) 스캔이 필요해요"류로 정밀화 검토.

### 양호 확인
- `computeVerdict` 미방어 입력 점검: invalid 날짜는 NaN 비교로 전부 제외되어 `no_scans` 수렴, 빈 색 표본 방어(`:133`) 존재, 0나눗셈 경로 없음 - 세션 내 노드 테스트 17/17과 합치.
- 미검증 JSON 렌더 금지: scans(`hooks/useScans.ts:37`)·products.verdict(`hooks/useProducts.ts:55`)·report(`app/report.tsx:31`) 전 경로 zod 검증 확인.

---

## 5. 스토어 심사 (Google Play 우선)

### [P0] 개인정보처리방침·문의처가 placeholder
- 파일: `app/settings.tsx:22-23` (`https://example.com/skinlog/privacy`, `contact@skinlog.example`)
- 재현: 설정 → 개인정보처리방침 탭 → example.com 이동. Play Console은 스토어 등록정보에 유효한 처리방침 URL을 요구(카메라·건강 관련 데이터라 데이터 보안 폼도 연동) - 제출 차단.
- 방향: 실제 호스팅된 처리방침 URL·문의 메일로 교체 (코드 내 TODO 주석 이미 존재).

### [P0] 앱 아이콘이 Expo 템플릿 기본 아이콘
- 파일: `assets/icon.png` (이미지 실측 - Expo 기본 파란 'Λ' 시안), `app.json:8,19-24` (adaptive icon 4종도 템플릿, 배경 `#E6F4FE`)
- 재현: 빌드 설치 시 런처에 Expo 템플릿 아이콘 노출 - 제출물 완성도 미달로 사실상 차단.
- 방향: 아이콘 4종(icon/foreground/background/monochrome) 교체. UI 원칙(민트 1색)과 정합 권장.

### [P0] 프로덕션 빌드에 환경변수 주입 배선 없음 - 빌드하면 전 기능 불능
- 파일: `eas.json:14-16` (production 프로필에 env 없음), `.gitignore:34` (`.env` 제외 - EAS 업로드에서 빠짐), `lib/supabase.ts:14-15` (미설정 시 전 화면 configMissing)
- 재현: 지금 상태로 `eas build --profile production` → 빌드엔 `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY`/`REVENUECAT_ANDROID_KEY` 부재 → 첫 화면부터 "설정 오류" + 결제 전면 불능.
- 방향: EAS 환경변수(대시보드 또는 `eas env`)에 3개 키 등록, 또는 eas.json production `env` 블록. 제출 전 preview 빌드로 실기기 확인 1회.

### [P1] 계정 삭제 요건 - 익명 계정이지만 Play 정책 대조 필요
- 근거: 기록 전체 삭제(인앱)는 있으나 auth 계정은 잔존(축 1 참조), 웹 기반 삭제 요청 경로 없음. Play "데이터 삭제" 정책은 계정 생성 앱에 인앱+웹 삭제 경로를 요구 - 익명 auth가 "계정 생성"으로 분류되는지 데이터 보안 폼 작성 시 판단 필요.
- 방향: 축 1의 계정 삭제 edge function + 처리방침 페이지에 삭제 안내 문단이면 양쪽 충족.

### [P2] 스플래시 미구성
- 파일: `app.json:30-40` plugins에 expo-splash-screen 없음, `assets/splash-icon.png`는 자산만 존재
- 영향: 시작 시 흰 화면. 심사 차단 아님, 품질 항목.

### [P2] Android 12+ 정확 알람 정책 - DATE 트리거 지연 가능성 (검증 항목)
- 파일: `lib/notifications.ts:43-47,80-84` (DATE 트리거 2건)
- 내용: Doze/정확 알람 제한으로 14일 뒤 알림이 수 시간 지연될 수 있음 - 세션 내 실측 없음, 실기기 체크리스트에 "알림 도착 시각 확인" 추가 권장.
- 결제 표기 양호 확인: 실청구액 대형 표기+월 환산 병기(`app/paywall.tsx:94-96`), 자동 갱신·해지 문구(`constants/strings.ts:112`), 구독 관리 딥링크(`app/settings.tsx:25-28`) - Cal AI 반면교사 원칙 충족. 스토어 상품 설정(14일 체험) 문구 일치만 제출 시 대조.

---

## 6. 성능·비용

### [P1] 스키마 이중 사본 - 드리프트 시 "서버 저장 성공 + 클라이언트 실패 표시"로 Anthropic·캡 이중 낭비
- 파일: `lib/analysis/schema.ts` vs `supabase/functions/analyze-skin/schema.ts` (수동 동기화 사본 2벌 - glob 실측), 실패 경로 `lib/analysis/useSkinAnalysis.ts:63-70`
- 재현: 한쪽 스키마만 수정 배포 → 서버는 검증 통과·scans 저장·200 응답까지 완료했는데 클라이언트 재검증 실패 → 유저에게 "분석 실패, 다시 촬영" → 재촬영으로 Anthropic 중복 호출 + 스캔 중복 저장 + 무료 유저는 캡까지 소모된 상태. 드리프트면 전 유저 동시 발생.
- 방향: sync-prompt처럼 스키마도 단일 소스에서 생성·sha 대조하는 체크 추가(이미 있는 sync 패턴 재사용). 또는 클라이언트는 safeParse 실패 시 에러 대신 로그+서버 응답 신뢰.

### [P2] scans_today_count RPC 중복 호출
- 파일: `hooks/useDailyCap.ts:27-31` (오늘 탭 focus마다) + `app/(tabs)/verdict.tsx:33` (verdict 탭 focus마다) + `components/CaptureTabButton.tsx:20-28` (pathname 변경마다)
- 재현: 탭 1회 전환에 동일 RPC 2~3회. 기능 문제 없음, DB 왕복 낭비.
- 방향: 모듈 스토어(usePro 패턴)로 카운트 공유 + 촬영 완료 시점만 invalidate.

### [P2] 스캔 로드 2벌 - useScans(10개) + useTrendScans(최대 200개)
- 파일: `hooks/useScans.ts:29-33`, `hooks/useTrendScans.ts:19-24` (Pro 오늘 탭에서 동시 실행)
- 방향: 추이는 `result` 전체가 아니라 필요한 점수만 select하거나, 30일 초과분 미조회 유지 확인 정도로 충분. 우선순위 낮음.

### [P2] analysis_requests 무한 증가
- 파일: `supabase/migrations/20260705090000:17-22` - 정리 루틴 없음(시간당 판정에는 최근 1시간만 필요).
- 방향: pg_cron 일일 삭제 잡(`created_at < now() - interval '2 days'`) 1줄.

### [P2] rate limit 기록 insert 실패 무시 - 이중 fail-open
- 파일: `supabase/functions/analyze-skin/index.ts:152-157` - 카운트 조회 실패(:146)와 기록 실패(:155) 모두 통과. 둘 다 실패하는 장애 상황에선 rate limit 부재 상태로 Anthropic 호출 계속.
- 방향: 기록 실패가 반복되는 상황은 DB 장애 - 그 경우 분석도 거부(fail-closed)하는 편이 원가 방어와 일관.

### 양호 확인
- 리렌더: usePro 모듈 스토어·AnalyzingView native driver·TrendChart 재쿼리 조건 등 점검 - 규모 대비 유의미한 낭비 경로 없음.
- Anthropic 재시도는 invalid 1회로 상한(`analyze-skin/index.ts:169-173`), no_face는 재시도 없음 - 규칙 준수.

---

## P0/P1 요약표

| 등급 | 축 | 항목 | 앵커 |
|---|---|---|---|
| **P0** | 심사 | 개인정보처리방침·문의처 placeholder | `app/settings.tsx:22-23` |
| **P0** | 심사 | 앱 아이콘 Expo 템플릿 기본 | `assets/icon.png`, `app.json:8,19-24` |
| **P0** | 심사 | 프로덕션 빌드 env 미주입 → 전 기능 불능 | `eas.json:14-16`, `.gitignore:34` |
| P1 | 보안 | 폴백 스냅샷 원본 미삭제 (프라이버시 원칙 위반) | `app/capture.tsx:62-76` |
| P1 | 보안 | scans 클라이언트 직접 insert 가능 (위조 스캔) | `migrations/20260704000000:36-37` |
| P1 | 보안 | 전체 삭제가 auth 계정·analysis_requests 잔존 | `app/settings.tsx:49-58` |
| P1 | 결제 | 무료 일 1회 캡 서버 미강제 | `analyze-skin/index.ts:138-151` |
| P1 | 결제 | 딥링크 `skinlog://capture` 캡 우회 | `app/capture.tsx` (캡 검사 부재) |
| P1 | 결제 | configure 실패 시 Pro 복구 재시도 없음 | `lib/purchases/usePro.ts:42-47` |
| P1 | 견고성 | 분석 타임아웃·취소 없음 → 무한 대기 | `useSkinAnalysis.ts:43-45` |
| P1 | 정합 | 판정 가능 판정이 클라이언트 시계 의존 | `ProductCard.tsx:9-11`, `verdict.tsx:52-98` |
| P1 | 심사 | 계정 삭제 요건 정책 대조 (웹 삭제 경로 없음) | 축 1 삭제 건과 동일 해법 |
| P1 | 비용 | zod 스키마 이중 사본 드리프트 → 이중 과금 경로 | `lib/analysis/schema.ts` ↔ `functions/analyze-skin/schema.ts` |

권장 착수 순서: P0 3건(제출 물리 차단) → 계정 삭제 edge function(보안 P1 2건+심사 P1 1건 동시 해소) → 서버 캡 강제(RevenueCat webhook 선행) → 분석 타임아웃·스냅샷 삭제(각 소규모).
