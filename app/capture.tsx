import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AnalysisErrorView } from '../components/capture/AnalysisErrorView';
import { AnalyzingView } from '../components/capture/AnalyzingView';
import { FaceGuideOverlay } from '../components/capture/FaceGuideOverlay';
import { ShutterButton } from '../components/capture/ShutterButton';
import { CAPTURE } from '../constants/capture';
import { STRINGS } from '../constants/strings';
import { track } from '../lib/analytics';
import { useFlashCapture } from '../hooks/useFlashCapture';
import { useLuminanceGate, type GateReading } from '../hooks/useLuminanceGate';
import type { SkinAnalysis } from '../lib/analysis/schema';
import { useSkinAnalysis } from '../lib/analysis/useSkinAnalysis';
import { cropToFaceGuide, deletePhotoFile } from '../lib/faceCrop';
import { isConsentAcknowledged } from '../lib/onboarding';
import { setPendingRegister } from '../lib/pendingRegister';
import { photoAverageLuminance } from '../lib/photoQuality';
import { precheckImage, type PrecheckReason } from '../lib/precheck';
import { fetchTodayCount } from '../hooks/useDailyCap';
import { usePro } from '../lib/purchases/usePro';

// 재현성 테스트(개발자 전용) 관련 모듈·문자열 - 프로덕션 번들에서 제외
const DEV_STRINGS = __DEV__
  ? (require('../lib/dev/strings') as typeof import('../lib/dev/strings')).DEV_STRINGS
  : null;

// 프리게이트 차단 사유 → 유저 안내 문구
const PRECHECK_MSG: Record<PrecheckReason, string> = {
  too_dark: STRINGS.precheckBlockTooDark,
  too_bright: STRINGS.precheckBlockTooBright,
  color_cast: STRINGS.precheckBlockColorCast,
  blur: STRINGS.precheckBlockBlur,
};

export default function CaptureScreen() {
  const router = useRouter();
  const { mode, intent } = useLocalSearchParams<{ mode?: string; intent?: string }>();
  const isRepro = __DEV__ && mode === 'repro'; // 개발자 재현성 테스트: 한 셔터 연사 2컷 (프로덕션 무시)
  // 동일 이미지 재분석: 1회 촬영한 크롭본을 메모리(캐시)에서만 유지한 채 분석 2회 - 모델 분산만 측정
  const isSameImage = __DEV__ && mode === 'same-image';
  const [firstShot, setFirstShot] = useState<SkinAnalysis | null>(null);
  const [secondCropUri, setSecondCropUri] = useState<string | null>(null); // 재현성: 연사 2컷째 크롭본
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  // 촬영 통과 후에는 항상 타원 크롭본 uri - 원본 전체샷은 크롭 즉시 삭제되므로
  // 이후 파이프라인(리뷰·분석 API 전송)은 이 크롭본만 사용한다.
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fallbackOffered, setFallbackOffered] = useState(false); // 3회 연속 차단 후 우회 제안 표시
  const blockStreakRef = useRef(0); // 같은 사유 연속 차단 횟수 - 3회 도달 시 우회 제안
  const lastBlockReasonRef = useRef<PrecheckReason | null>(null); // 직전 차단 사유(연속 판정용)
  const forcedRef = useRef(false); // 우회 수락 시 다음 촬영은 프리게이트 차단 건너뜀(forced_capture)
  const gateReadingRef = useRef<GateReading | null>(null); // 사전게이트 최신 측정치(B트랙)
  const analyzeCtxRef = useRef<{
    gate_source: string | null;
    gate_value: number | null;
    post_luma: number | null;
    post_luma_error: string | null; // 사후 휘도 측정 실패 단계(null=성공 또는 미측정 아님)
    forced_capture: boolean; // 프리게이트 우회로 진행됐는지
    precheck_metrics: Record<string, number> | null; // 온디바이스 측정 원자료(측정 실패 시 null)
  } | null>(null);
  const { flashOn, capturing, capture } = useFlashCapture(cameraRef);
  const {
    stage,
    result,
    error: analysisError,
    analyze,
    reset: resetAnalysis,
  } = useSkinAnalysis();

  const { isPro } = usePro();

  // 사진 처리 고지 가드 - 어떤 진입 경로(딥링크·기존 유저)든 고지 확인 전엔 촬영 불가.
  // 포커스마다 재검사: 고지 화면에서 하드웨어 백으로 빠져나와도 다시 고지로 유도된다.
  // Pro 포함 전원 적용(과금 무관 - 처리 고지), 개발자 촬영 모드만 예외.
  useFocusEffect(
    useCallback(() => {
      if (isRepro || isSameImage) return;
      let cancelled = false;
      isConsentAcknowledged().then((acknowledged) => {
        if (!cancelled && !acknowledged) {
          router.push({ pathname: '/onboarding', params: { mode: 'consent' } });
        }
      });
      return () => {
        cancelled = true;
      };
    }, [isRepro, isSameImage, router]),
  );

  // 딥링크(skinme://capture) 직접 진입 방어 - 진입 버튼들과 별개로 화면 자체에서 캡 재검사.
  // 무료 유저가 오늘 캡 도달 상태면 페이월로 전환. Pro·개발자 촬영 모드는 예외.
  useEffect(() => {
    if (isPro || isRepro || isSameImage) return;
    let cancelled = false;
    fetchTodayCount().then((count) => {
      if (!cancelled && count !== null && count >= 1) {
        router.replace({ pathname: '/paywall', params: { source: 'deeplink' } });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isPro, isRepro, isSameImage, router]);

  // 크롭본이 확정되면 분석 파이프라인 시작 (인코딩→edge function→검증→저장)
  useEffect(() => {
    if (photoUri) analyze(photoUri, analyzeCtxRef.current ?? undefined);
  }, [photoUri, analyze]);

  // 폴백 사전 게이트 샘플링: 초저화질 스냅샷 → 32x32 축소 → 중앙 60% 크롭 평균 휘도(0-255).
  // 사후 판정(photoQuality)과 동일 기준 - 어두운 배경·머리카락이 평균을 끌어내려
  // 밝은 방에서 셔터가 차단되는 문제를 차단(전체 평균 → 중앙 크롭).
  const sampleSnapshot = useCallback(async (): Promise<number | null> => {
    const camera = cameraRef.current;
    if (!camera) return null;
    const photo = await camera.takePictureAsync({
      quality: 0.1,
      skipProcessing: true,
      shutterSound: false,
    });
    if (!photo?.uri) return null;
    const luma = await photoAverageLuminance(
      photo.uri,
      CAPTURE.preGate.snapshotSize,
      CAPTURE.postCheck.centerCropRatio,
    );
    await deletePhotoFile(photo.uri); // 폴백 게이트 스냅샷 즉시 폐기 (사진 수명 원칙)
    return luma;
  }, []);

  const gatePaused = capturing || photoUri !== null;
  const lightLevel = useLuminanceGate(gatePaused, sampleSnapshot, gateReadingRef);

  // 셔터 1회 → 플래시 유지한 채 연사 2컷 → 사용 컷만 사후 휘도 판정 + 크롭.
  // 정상 촬영: 1컷째만 사용(2컷째 원본 즉시 폐기 - 촬영 메커니즘 통일용 연사).
  // 재현성 테스트: 연사 2컷을 1회/2회차로 사용 - "두 번 찍기"가 아니라 "한 셔터 연사".
  const handleShutter = async () => {
    setErrorMessage(null);
    const photos = await capture(2);
    if (!photos || photos.length === 0) {
      track('capture_gate_fail', { reason: 'capture_failed' });
      blockStreakRef.current = 0; // 기술적 실패 - 연속 사유 스트릭 초기화
      lastBlockReasonRef.current = null;
      setErrorMessage(STRINGS.captureFailed);
      return;
    }
    const usedCount = isRepro ? 2 : 1;
    const forced = forcedRef.current; // 우회 세션: 프리게이트 차단은 건너뛰되 측정은 계속(기록용)
    const cropped: string[] = [];
    let failMessage: string | null = null;
    let failReason: string | null = null;
    let blockReason: PrecheckReason | null = null; // 프리게이트 품질 차단 사유(기술적 실패와 구분)
    let usedMetrics: Record<string, number> | null = null;
    let usedMetricsError: string | null = null;
    for (let i = 0; i < usedCount; i += 1) {
      const photo = photos[i];
      // 온디바이스 프리게이트 - API 호출 전에 밝기·색치우침·선명도 검사(토큰 0원)
      const pre = await precheckImage(photo.uri);
      if (i === 0) {
        usedMetrics = pre.metrics; // null=측정 실패
        usedMetricsError = 'error' in pre ? pre.error : null;
      }
      if (!forced && !pre.ok) {
        blockReason = pre.reason;
        failReason = pre.reason;
        failMessage = PRECHECK_MSG[pre.reason];
        console.log(`[precheck] blocked: ${pre.reason} (shot ${i + 1})`, pre.metrics);
        break;
      }
      const croppedUri = await cropToFaceGuide(
        photo.uri,
        photo.width,
        photo.height,
        screenWidth,
        screenHeight,
      );
      if (!croppedUri) {
        failMessage = STRINGS.captureFailed;
        failReason = 'crop_failed';
        break;
      }
      cropped.push(croppedUri);
    }
    // 원본 전체샷 전부 즉시 폐기 (정상 촬영의 미사용 2컷째 포함)
    for (const photo of photos) await deletePhotoFile(photo.uri);
    if (failMessage) {
      for (const uri of cropped) await deletePhotoFile(uri); // 부분 크롭본도 폐기
      if (blockReason) {
        // 프리게이트 품질 차단 - 같은 사유 연속 카운트, 3회 도달 시 우회 제안(무한 루프 금지)
        track('precheck_blocked', { reason: blockReason });
        if (blockReason === lastBlockReasonRef.current) blockStreakRef.current += 1;
        else {
          blockStreakRef.current = 1;
          lastBlockReasonRef.current = blockReason;
        }
        if (blockStreakRef.current >= 3) {
          setErrorMessage(null);
          setFallbackOffered(true);
        } else {
          setErrorMessage(failMessage);
        }
      } else {
        // 기술적 실패(crop_failed 등) - 우회 무의미, 스트릭 초기화
        track('capture_gate_fail', { reason: failReason ?? 'unknown' });
        blockStreakRef.current = 0;
        lastBlockReasonRef.current = null;
        setErrorMessage(failMessage);
      }
      return;
    }
    // 통과 - 스트릭·우회 상태 초기화
    blockStreakRef.current = 0;
    lastBlockReasonRef.current = null;
    forcedRef.current = false;
    analyzeCtxRef.current = {
      gate_source: gateReadingRef.current?.source ?? null,
      gate_value: gateReadingRef.current?.value ?? null,
      post_luma: usedMetrics?.luma ?? null, // 프리게이트 측정 휘도(기존 post_luma 대체)
      post_luma_error: usedMetricsError,
      forced_capture: forced,
      precheck_metrics: usedMetrics,
    };
    if (isRepro && cropped.length === 2) setSecondCropUri(cropped[1]); // 2회차 분석 대기
    setPhotoUri(cropped[0]);
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permission}>
        <Text style={styles.permissionTitle}>{STRINGS.permissionTitle}</Text>
        <Text style={styles.permissionBody}>
          {permission.canAskAgain
            ? STRINGS.permissionBody
            : STRINGS.permissionSettings}
        </Text>
        {permission.canAskAgain && (
          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>
              {STRINGS.permissionButton}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (photoUri) {
    // 분석 파이프라인 화면 - 유저의 실제 사진은 표시하지 않는다.
    if (analysisError) {
      return (
        <AnalysisErrorView
          message={analysisError}
          onRetake={async () => {
            track('capture_retry');
            await deletePhotoFile(photoUri); // 실패한 사진도 즉시 삭제
            if (secondCropUri) {
              await deletePhotoFile(secondCropUri); // 대기 중이던 연사 2컷째도 폐기
              setSecondCropUri(null);
            }
            resetAnalysis();
            // 재촬영 = 새 연사/새 이미지 - 기존 1회차 결과와 짝지으면 안 됨
            if (isSameImage || isRepro) setFirstShot(null);
            setPhotoUri(null); // 카메라로 복귀 → 재촬영
          }}
        />
      );
    }
    return (
      <AnalyzingView
        key={firstShot ? 'second-round' : 'first-round'}
        stage={stage}
        onAnalysisComplete={async () => {
          if (isSameImage && result) {
            if (!firstShot) {
              // 1회차 완료 - 사진을 삭제하지 않고 동일 크롭본으로 즉시 재분석
              setFirstShot(result);
              resetAnalysis();
              analyze(photoUri);
              return;
            }
            // 2회차 완료 - 이제서야 폐기 (저장·전송 로그 없음은 기존 파이프라인 그대로)
            const { setReproPair } = require('../lib/repro') as typeof import('../lib/repro');
            setReproPair(firstShot, result);
            await deletePhotoFile(photoUri);
            router.replace('/repro-report');
            return;
          }
          if (isRepro && result) {
            if (!firstShot) {
              // 연사 1컷째 분석 완료 → 크롭본 폐기 후 2컷째 분석으로 전환
              setFirstShot(result);
              await deletePhotoFile(photoUri);
              resetAnalysis();
              setPhotoUri(secondCropUri); // photoUri 변경 → analyze effect 재발동
              setSecondCropUri(null);
              return;
            }
            const { setReproPair } = require('../lib/repro') as typeof import('../lib/repro');
            setReproPair(firstShot, result);
            await deletePhotoFile(photoUri); // 2컷째 크롭본 폐기
            router.replace('/repro-report');
            return;
          }
          await deletePhotoFile(photoUri); // 사진은 분석 후 즉시 삭제
          // "새로 측정하고 판정 시작하기" 경유 - 오늘 탭 복귀 시 등록 모달 자동 표시
          if (intent === 'register') setPendingRegister();
          router.replace('/today');
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        animateShutter={false}
        // 촬영본을 비미러(원본 방향)로 명시 고정 - evidence 좌/우 기준(이미지 기준,
        // 프롬프트 v0.8)과 클라이언트 거울 기준 치환(lib/mirrorText)의 전제.
        // expo-camera 기본값도 false지만 기기별 편차를 배제하기 위해 명시.
        mirror={false}
      />
      <FaceGuideOverlay lightLevel={lightLevel} />
      {(isRepro || isSameImage) && DEV_STRINGS && (
        <View style={styles.reproBanner} pointerEvents="none">
          <Text style={styles.reproBannerText}>
            {isSameImage
              ? `${DEV_STRINGS.sameImageTitle} - 1회 촬영, 분석 2회`
              : `${DEV_STRINGS.reproTitle} - ${DEV_STRINGS.reproBannerSuffix}`}
          </Text>
        </View>
      )}
      <View style={styles.bottomBar}>
        {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
        {fallbackOffered ? (
          <View style={styles.fallbackPanel}>
            <Text style={styles.fallbackText}>{STRINGS.precheckOverrideOffer}</Text>
            <View style={styles.fallbackButtons}>
              <Pressable
                style={({ pressed }) => [styles.fallbackBtn, styles.fallbackBtnGhost, pressed && styles.cardPressed]}
                onPress={() => {
                  blockStreakRef.current = 0; // 거절 → 즉시 재제안 방지
                  lastBlockReasonRef.current = null;
                  setFallbackOffered(false);
                }}
              >
                <Text style={styles.fallbackBtnGhostText}>{STRINGS.precheckOverrideDismiss}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.fallbackBtn, styles.fallbackBtnPrimary, pressed && styles.cardPressed]}
                onPress={() => {
                  // 극단암흑 사전게이트 하한은 우회에서도 불가침(디스에이블 상태면 무동작).
                  // 프리게이트(품질) 차단만 건너뛴다 - 진짜 깜깜한 프레임에 API 낭비 방지.
                  if (lightLevel !== 'good' || capturing) return;
                  track('precheck_override_used');
                  forcedRef.current = true; // 다음 촬영은 프리게이트 차단 건너뜀 → forced_capture
                  setFallbackOffered(false);
                  void handleShutter();
                }}
              >
                <Text style={styles.fallbackBtnPrimaryText}>{STRINGS.precheckOverrideAccept}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <ShutterButton
            disabled={lightLevel !== 'good' || capturing}
            onPress={handleShutter}
          />
        )}
        <Text style={styles.privacy}>{STRINGS.privacyNotice}</Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
        hitSlop={4}
        onPress={() => {
          track('capture_abandoned');
          router.back();
        }}
      >
        <Text style={styles.closeText}>✕</Text>
      </Pressable>
      {flashOn && (
        <View style={styles.flashOverlay} pointerEvents="none" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: 12,
    paddingBottom: 40,
  },
  error: {
    color: '#F87171',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  privacy: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  fallbackPanel: {
    marginHorizontal: 24,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 14,
    alignItems: 'center',
  },
  fallbackText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  fallbackButtons: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
  },
  fallbackBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackBtnGhost: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  fallbackBtnGhostText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '600',
  },
  fallbackBtnPrimary: {
    backgroundColor: '#4ADE80',
  },
  fallbackBtnPrimaryText: {
    color: '#052e16',
    fontSize: 14,
    fontWeight: '700',
  },
  cardPressed: {
    opacity: 0.75,
  },
  close: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePressed: {
    opacity: 0.7,
  },
  closeText: {
    color: '#ffffff',
    fontSize: 18,
  },
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    zIndex: 10,
  },
  reproBanner: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 72,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  reproBannerText: {
    color: '#FBBF24',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
    backgroundColor: '#ffffff',
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  permissionBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionButton: {
    height: 48,
    paddingHorizontal: 32,
    borderRadius: 24,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
