import { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LockedSection } from '../../components/paywall/LockedSection';
import { HistoryList } from '../../components/today/HistoryList';
import { IngredientSheet } from '../../components/today/IngredientSheet';
import { MetricGrid } from '../../components/today/MetricGrid';
import { PriorityCard } from '../../components/today/PriorityCard';
import { SampleReportCard } from '../../components/today/SampleReportCard';
import { ScoreHeader } from '../../components/today/ScoreHeader';
import { ShareableScoreCard } from '../../components/today/ShareableScoreCard';
import { TrendChart } from '../../components/today/TrendChart';
import { RegisterModal } from '../../components/verdict/RegisterModal';
import type { Ingredient } from '../../constants/ingredients';
import {
  concurrentTrackingWarning,
  reportDdayBanner,
  streakContinueLabel,
  streakResumeLabel,
  STRINGS,
} from '../../constants/strings';
import { useDailyCap } from '../../hooks/useDailyCap';
import { useProducts } from '../../hooks/useProducts';
import { useScans } from '../../hooks/useScans';
import { useStreak } from '../../hooks/useStreak';
import { scheduleWeeklySummary } from '../../lib/notifications';
import ViewShot from 'react-native-view-shot';
import { consumePendingRegister } from '../../lib/pendingRegister';
import { usePro } from '../../lib/purchases/usePro';
import { shareViewShot } from '../../lib/shareReport';
import { cardShadow, COLORS, pressedStyle } from '../../lib/ui';
import { DAY_MS } from '../../lib/verdict/computeVerdict';

// 개발자 진입점은 __DEV__ 조건 require - 프로덕션 번들에서 모듈째 제외됨
const DevTodaySection = __DEV__
  ? (require('../../components/dev/DevTodaySection') as typeof import('../../components/dev/DevTodaySection'))
      .DevTodaySection
  : null;

const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000; // 등록 진입점 신선도 기준: 24시간

export default function TodayScreen() {
  const router = useRouter();
  const { scans, loading, loadError } = useScans();
  const { products, register } = useProducts();
  const { isPro } = usePro();
  const { todayCount } = useDailyCap();
  const streak = useStreak();
  const [registerVisible, setRegisterVisible] = useState(false);
  const [registerNote, setRegisterNote] = useState<string>(STRINGS.registerBaselineNote);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [sharing, setSharing] = useState(false); // 공유 캡처 순간에만 카드를 화면 안에 렌더
  const scrollRef = useRef<ScrollView>(null);
  const [entryY, setEntryY] = useState(0);
  const pulse = useRef(new Animated.Value(0)).current;
  const shotRef = useRef<ViewShot>(null); // 무료 공유용 점수 카드 캡처

  const latest = scans[0];
  const previous = scans[1] ?? null;
  const isFirstScan = scans.length === 1; // 첫 스캔 완료 상태 - 하이라이트·샘플 리포트 노출
  const isFresh =
    !!latest && Date.now() - new Date(latest.created_at).getTime() <= FRESH_WINDOW_MS;
  // 무료 캡: 서버(KST) 기준 오늘 스캔 존재 시. 로드 실패(null)는 fail-open.
  const capped = !isPro && todayCount !== null && todayCount >= 1;

  // 리포트 대기 중(미완결) 제품 중 가장 임박한 1개 - D-n 배너
  const pendingProducts = products.filter((p) => p.verdict === null);
  const nearest =
    pendingProducts.length > 0
      ? pendingProducts.reduce((a, b) => (a.verdict_at < b.verdict_at ? a : b))
      : null;
  const nearestDaysLeft = nearest
    ? Math.ceil((new Date(nearest.verdict_at).getTime() - Date.now()) / DAY_MS)
    : 0;

  // 첫 스캔 이후 주간 요약 알림 1회 등록 (내부에서 중복·권한·설정 가드)
  useEffect(() => {
    if (scans.length >= 1) scheduleWeeklySummary();
  }, [scans.length]);

  // 공유: 오버레이가 화면 안에 그려진 뒤(paint) 캡처 → 공유 → 오버레이 제거.
  // 화면 밖 렌더는 안드로이드가 자식을 안 그려 백지로 캡처되므로 온스크린 렌더가 필수.
  useEffect(() => {
    if (!sharing) return;
    const timer = setTimeout(async () => {
      await shareViewShot(shotRef);
      setSharing(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [sharing]);

  // "새로 측정하고 리포트 시작" 경유: 촬영·분석 완료 후 복귀 시 등록 모달 자동 표시
  useFocusEffect(
    useCallback(() => {
      if (consumePendingRegister()) {
        setRegisterNote(STRINGS.registerBaselineNoteNow);
        setRegisterVisible(true);
      }
    }, []),
  );

  // 첫 스캔: 등록 진입 버튼 민트 보더 펄스 2회 (자동 스크롤 제거 -
  // 점수를 지나쳐 Pro 유도로 내려가 보이던 문제. 이제 점수가 화면에 남고 펄스만 강조).
  useEffect(() => {
    if (!isFirstScan || entryY === 0) return;
    const timer = setTimeout(() => {
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 450, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]).start();
    }, 600);
    return () => clearTimeout(timer);
  }, [isFirstScan, entryY, pulse]);

  // 등록 진입 공통 핸들러 (버튼·샘플 리포트·성분 시트 배선이 공유)
  const handleStartRegister = () => {
    if (!isPro) {
      router.push({ pathname: '/paywall', params: { source: 'register' } });
    } else if (isFresh) {
      setRegisterNote(STRINGS.registerBaselineNote);
      setRegisterVisible(true);
    } else if (capped) {
      router.push({ pathname: '/paywall', params: { source: 'cap' } });
    } else {
      router.push({ pathname: '/capture', params: { intent: 'register' } });
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#111111" />
      </View>
    );
  }

  // 빈 상태 = "시작 안내": 가치 한 줄 + 중앙 셔터 유도
  if (!latest) {
    return (
      <View style={styles.center}>
        {loadError ? (
          <Text style={styles.error}>{loadError}</Text>
        ) : (
          <>
            <Text style={styles.valueLine}>{STRINGS.emptyValueLine}</Text>
            <View style={styles.guideCard}>
              <Text style={styles.guideText}>{STRINGS.emptyGuide}</Text>
              <Ionicons name="arrow-down" size={22} color={COLORS.accent} />
            </View>
          </>
        )}
      </View>
    );
  }

  const history = <HistoryList scans={scans} />;

  return (
    <View style={styles.root}>
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={styles.content}>
      {loadError && <Text style={styles.error}>{loadError}</Text>}
      {/* 리포트 D-n 컴팩트 배너 - 미완결 루프 상시 노출 (가장 임박한 1개) */}
      {nearest && (
        <Pressable style={pressedStyle(styles.ddayBanner)} onPress={() => router.push('/verdict')}>
          <Text style={styles.ddayText} numberOfLines={1}>
            {nearestDaysLeft > 0
              ? reportDdayBanner(nearest.name, nearestDaysLeft)
              : `『${nearest.name}』 ${STRINGS.verdictReady}`}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
        </Pressable>
      )}
      {/* 오늘 미촬영이면 점수보다 먼저 측정 유도 */}
      {todayCount === 0 && (
        <Pressable
          style={pressedStyle(styles.premeasure)}
          onPress={() => router.push('/capture')}
        >
          <View style={styles.premeasureTextWrap}>
            <Text style={styles.premeasureLabel}>{STRINGS.notMeasuredToday}</Text>
            <Text style={styles.premeasureHint}>{STRINGS.notMeasuredHint}</Text>
          </View>
          <Ionicons name="camera-outline" size={22} color={COLORS.accent} />
        </Pressable>
      )}
      <ScoreHeader analysis={latest.result} />
      {streak.days >= 2 && (
        <View style={styles.streakChip}>
          <Text style={styles.streakChipText}>
            {streak.includesToday
              ? streakContinueLabel(streak.days)
              : streakResumeLabel(streak.days)}
          </Text>
        </View>
      )}
      {/* 무료 공유(바이럴) - 종합 점수는 무료도 보므로 전 유저 공용 */}
      <Pressable
        style={pressedStyle(styles.shareScore)}
        onPress={() => setSharing(true)}
        disabled={sharing}
      >
        <Text style={styles.shareScoreText}>{STRINGS.shareScoreButton}</Text>
      </Pressable>
      {isPro ? (
        <>
          <MetricGrid analysis={latest.result} />
          <TrendChart />
          <PriorityCard
            analysis={latest.result}
            previousResult={previous?.result ?? null}
            onIngredientPress={setSelectedIngredient}
          />
        </>
      ) : (
        <View style={styles.lockedGroup}>
          {/* 무료: 항목별 점수(숫자)는 노출 - 호기심 훅. 근거·해석·판정은 Pro */}
          <MetricGrid analysis={latest.result} detail={false} />
          <Pressable
            style={pressedStyle(styles.detailCta)}
            onPress={() =>
              router.push({ pathname: '/paywall', params: { source: 'locked_section' } })
            }
          >
            <Text style={styles.detailCtaText}>{STRINGS.metricDetailCta}</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.accent} />
          </Pressable>
          <LockedSection
            onPress={() => router.push({ pathname: '/paywall', params: { source: 'locked_section' } })}
            showPanel={false}
          >
            <PriorityCard analysis={latest.result} previousResult={previous?.result ?? null} />
          </LockedSection>
        </View>
      )}
      {/* 첫 스캔: 14일 뒤의 그림 - 샘플 리포트 (2회차부터 미표시) */}
      {isFirstScan && <SampleReportCard onPress={handleStartRegister} />}
      {/* 제품 리포트 시작 진입점 - 첫 스캔이면 펄스 하이라이트 */}
      <View onLayout={(event) => setEntryY(event.nativeEvent.layout.y)}>
        <Pressable style={pressedStyle(styles.startVerdict)} onPress={handleStartRegister}>
          <Text style={styles.startVerdictText}>
            {isFresh ? STRINGS.startVerdictEntry : STRINGS.startVerdictEntryStale}
          </Text>
        </Pressable>
        {isFirstScan && (
          <Animated.View pointerEvents="none" style={[styles.pulseRing, { opacity: pulse }]} />
        )}
      </View>
      {DevTodaySection ? (
        <DevTodaySection latestResult={latest.result} products={products}>
          {history}
        </DevTodaySection>
      ) : (
        history
      )}
      <RegisterModal
        visible={registerVisible}
        onClose={() => setRegisterVisible(false)}
        note={registerNote}
        warning={nearest ? concurrentTrackingWarning(nearest.name) : undefined}
        onSubmit={async (name) => {
          const ok = await register(name);
          if (ok) router.push('/verdict'); // 등록된 카드 확인
          return ok;
        }}
      />
      <IngredientSheet
        ingredient={selectedIngredient}
        analysis={latest.result}
        onClose={() => setSelectedIngredient(null)}
        onRegister={handleStartRegister}
      />
    </ScrollView>
      {/* 공유 캡처용 - 메인 윈도우 안(Modal 아님)에 그려야 view-shot이 내용을 담는다.
          Modal은 별도 네이티브 윈도우라 안드로이드에서 캡처가 백지로 나옴. */}
      {sharing && (
        <View style={styles.captureOverlay}>
          <Text style={styles.capturePreviewLabel}>{STRINGS.sharePreviewLabel}</Text>
          <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }}>
            <ShareableScoreCard
              score={latest.result.overall.score}
              dateIso={latest.created_at}
            />
          </ViewShot>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    padding: 20,
    gap: 20,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 24,
    backgroundColor: '#ffffff',
  },
  valueLine: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
  },
  guideCard: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 20,
    ...cardShadow,
  },
  guideText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  ddayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...cardShadow,
  },
  ddayText: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    flex: 1,
  },
  premeasure: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...cardShadow,
  },
  premeasureTextWrap: {
    gap: 2,
  },
  premeasureLabel: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '700',
  },
  premeasureHint: {
    color: '#6B7280',
    fontSize: 12,
  },
  error: {
    color: '#B91C1C',
    fontSize: 14,
    textAlign: 'center',
  },
  lockedGroup: {
    gap: 24, // 잠금 섹션 간 수직 간격 - 경계가 한눈에 읽히게
  },
  streakChip: {
    alignSelf: 'center',
    marginTop: -8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#ECFDF5', // 민트 틴트 - 숫자 중심, 이모지·불꽃 없음
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  streakChipText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  shareScore: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  shareScoreText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  detailCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailCtaText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  captureOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: 'rgba(0,0,0,0.55)', // 캡처 순간 노출 - 공유될 카드 미리보기
  },
  capturePreviewLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  startVerdict: {
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startVerdictText: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '600',
  },
  pulseRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
});
