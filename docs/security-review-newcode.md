# 신규 코드 보안감사 (2026-07-05 세션 추가분)

대상: 이번 세션에 추가한 코드 - 계정삭제·RevenueCat webhook·analytics 계측·스캔 봉인·공유 카드·서버 캡.
근거: 세션 내 작성 코드 실측(파일 인용). ⚠️ edge fn/마이그레이션은 여기서 런타임 검증 불가 - 배포 후 확인 필요.
등급: [High 출시 전 필수 / Med 권장 / Low 여유 / Info 참고]

---

## F1 [Med] rc-webhook - 공유 시크릿 유출 시 Pro 권한 위조
- 파일: `supabase/functions/rc-webhook/index.ts` (Authorization Bearer만 검증 후 `event.app_user_id`를 그대로 신뢰해 `is_pro` upsert)
- 위험: `RC_WEBHOOK_AUTH`가 유출·약하면 공격자가 위조 요청으로 **임의 user_id를 Pro로** 만들 수 있음 → 페이월·무료 캡 우회. RevenueCat 암호 서명 검증은 없음(RC 표준이 Authorization 헤더라 시크릿이 강하면 허용).
- 조치: 32자+ 강한 랜덤 시크릿, 유출 시 즉시 로테이트, 로그에 시크릿 금지. (선택) RevenueCat IP 알로우리스트.

## F2 [Med] 서버 캡 - entitlements 신선도 의존 + 이벤트 매핑 미검증
- 파일: `supabase/functions/analyze-skin/index.ts` 캡 블록(`ENFORCE_SERVER_CAP` 게이트), `rc-webhook`의 PRO_TYPES/NONPRO_TYPES
- 위험: ① 캡을 webhook 채우기 전에 켜면 Pro 오탐(캡당함) - 이미 플래그+배포 5단계로 방어. ② 이벤트 타입 매핑이 시작점 추정이라, 실제 RC 페이로드와 다르면 is_pro가 stale(과다/과소 부여)될 수 있음.
- 조치: 5단계 순서 준수(webhook 검증 후 캡 on). 실제 RC 이벤트 1건씩으로 매핑 검증 후 조정.

## F3 [Low] "기록 전체 삭제"가 analytics_events·entitlements를 남김 + analytics 무한 증가
- 파일: `app/settings.tsx` `handleDeleteAll`(scans·products만 삭제), `lib/analytics.ts`(정리 루틴 없음)
- 위험: "기록 전체 삭제"해도 `analytics_events` 잔존 → 프라이버시 기대 불일치. 또 analytics_events는 보존정책 없어 무한 증가(운영).
- 조치: `handleDeleteAll`에 analytics_events 삭제 추가(entitlements는 구독 진실이라 유지), analytics 보존 pg_cron 잡 추가. 계정 완전삭제(`delete-account`)는 이미 둘 다 지움 - OK.

## F4 [Low] delete-account - JWT 즉시 무효화 안 됨 / 비원자적
- 파일: `supabase/functions/delete-account/index.ts`
- 위험: `auth.admin.deleteUser` 후에도 기존 JWT는 만료(~1h)까지 유효. 클라이언트가 즉시 signOut(`app/settings.tsx`)해서 실무상 무해. 삭제가 순차(트랜잭션 아님) - 중간 실패 시 데이터는 지워졌는데 계정 남을 수 있음(재시도 가능).
- 조치: 현행 수용 가능. 필요 시 데이터 삭제 실패도 로깅, 재시도 안내 유지.

## F5 [Low] analytics props 크기·내용 미검증
- 파일: `lib/analytics.ts` (`props: Record<string,string>` 클라 제공분을 그대로 insert)
- 위험: 악의적 클라가 본인 행에 거대/임의 문자열 기록 가능(자기 저장소 낭비). RLS로 타인 행은 불가라 영향 제한적.
- 조치: (선택) props 크기 상한 또는 check 제약. 우선순위 낮음.

## F6 [Info] rc-webhook 시크릿 비교가 상수시간 아님
- `!==` 문자열 비교 - 타이밍 사이드채널. 32자 랜덤 베어러엔 실질 무의미. 참고만.

## F7 [Low] 공유 카드 캡처 임시파일
- 파일: `lib/shareReport.ts` (캡처 PNG → 공유 → 삭제). 공유 중 앱 강제종료 시 앱 전용 캐시에 PNG 잔존. **내용은 점수뿐(사진·evidence 없음)** 이라 민감도 낮음. 정상 경로는 삭제됨.
- 조치: 앱 시작 시 임시 이미지 정리(P2 기존 항목)와 함께 처리하면 해소.

## F8 [Info] server_now RPC는 인증 유저에 공개
- 서버 시각 노출뿐 - 무해.

## F9 [Low→중요 인지] 무료 캡은 ENFORCE_SERVER_CAP=1 전까지 여전히 클라 전용
- 서버 캡 경로는 만들었지만 기본 off. 그 전까지 무료 캡은 클라이언트 게이트만이라 우회 가능(감사 원항목 미해소 상태). "무료 캡 서버화 완료"로 오인 금지 - 5단계까지 마쳐야 실제 강제.

---

## 양호 확인 (신규 코드)
- **스캔 봉인**: `analyze-skin`이 service-role로 insert하고 `user_id`를 인증 유저에서만 세팅 → 타인 행 위조 불가(보안 개선). insert 정책 제거로 클라 직접 쓰기 차단.
- **entitlements RLS**: select 본인만, 쓰기 정책 없음(service-role 전용) - 클라가 자기 Pro로 못 바꿈.
- **analytics RLS**: insert/select 본인만, user_id=auth.uid 강제.
- **공유 카드**: 사진·evidence·user_id 미포함(`ShareableCard` 구성상 확정).
- **온보딩/스트릭/주간알림**: 서버 전송 없음(로컬) 또는 본인 데이터 조회만 - 신규 노출면 없음.

## 우선 조치 권고
1. **F1** - 강한 `RC_WEBHOOK_AUTH`(배포 전제) · **F9** 인지(캡 강제는 5단계 완료 후)
2. **F3** - handleDeleteAll에 analytics 삭제 + analytics 보존 잡 (프라이버시·운영)
3. 나머지(F2 매핑검증·F5·F7)는 배포 후/여유 시
