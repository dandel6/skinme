import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polygon } from 'react-native-svg';
import { STRINGS } from '../../constants/strings';
import type { AnalysisStage } from '../../lib/analysis/useSkinAnalysis';

const CHECK_INTERVAL_MS = 600; // 지표 순차 체크 간격
const SCAN_DURATION_MS = 1800;
const MASK_WIDTH = 220;
const MASK_HEIGHT = 286;
const SCAN_BAND_HALF = 20; // 스캔 라인 ±20px 구간만 밝게

// 실제 분석 진행 단계 → 지표 체크 목표 개수 매핑.
// API 지연 동안은 해당 단계 목표에서 대기해 연출과 진행 상태가 물리게 한다.
const STAGE_TARGET: Record<AnalysisStage, number> = {
  uploading: 1,
  analyzing: 3,
  saving: 4,
  done: 5,
};

const STAGE_LABEL: Record<AnalysisStage, string> = {
  uploading: STRINGS.stageUploading,
  analyzing: STRINGS.stageAnalyzing,
  saving: STRINGS.stageSaving,
  done: STRINGS.stageSaving,
};

// ── 와이어프레임 얼굴 메시 (정면·중성적·특정 인물 아님) ──
// 왼쪽 절반 15개 삼각형을 최장변 이등분으로 2배 세분(30개)하고
// x → 200-x 미러링으로 좌우 대칭 보장. 면 없이 선+꼭짓점만 렌더.
type Point = [number, number];

const BASE_LEFT: [Point, Point, Point][] = [
  [[100, 12], [42, 58], [100, 72]],
  [[42, 58], [68, 104], [100, 72]],
  [[42, 58], [28, 126], [68, 104]],
  [[28, 126], [52, 160], [68, 104]],
  [[100, 72], [68, 104], [100, 128]],
  [[68, 104], [84, 150], [100, 128]],
  [[68, 104], [52, 160], [84, 150]],
  [[28, 126], [56, 206], [52, 160]],
  [[52, 160], [56, 206], [74, 192]],
  [[52, 160], [74, 192], [84, 150]],
  [[84, 150], [100, 158], [100, 128]],
  [[84, 150], [74, 192], [100, 158]],
  [[74, 192], [100, 196], [100, 158]],
  [[56, 206], [100, 248], [74, 192]],
  [[74, 192], [100, 248], [100, 196]],
];

function splitLongestEdge(tri: [Point, Point, Point]): [Point, Point, Point][] {
  const dist2 = (p: Point, q: Point) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
  const rotations: [Point, Point, Point][] = [
    [tri[0], tri[1], tri[2]],
    [tri[1], tri[2], tri[0]],
    [tri[2], tri[0], tri[1]],
  ];
  rotations.sort((r1, r2) => dist2(r2[0], r2[1]) - dist2(r1[0], r1[1]));
  const [p, q, opposite] = rotations[0];
  const mid: Point = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  return [
    [p, mid, opposite],
    [mid, q, opposite],
  ];
}

const DENSE_LEFT = BASE_LEFT.flatMap(splitLongestEdge); // 30개 (좌측)

const toPointsString = (tri: Point[], mirrored: boolean) =>
  tri.map(([x, y]) => `${mirrored ? 200 - x : x},${y}`).join(' ');

// 모듈 레벨 1회 계산 - 삼각형 점 문자열(양측) + 중복 제거된 꼭짓점(양측)
const TRIANGLE_POINTS: string[] = [
  ...DENSE_LEFT.map((tri) => toPointsString(tri, false)),
  ...DENSE_LEFT.map((tri) => toPointsString(tri, true)),
];
const VERTEX_MAP = new Map<string, Point>();
for (const tri of DENSE_LEFT) {
  for (const [x, y] of tri) {
    VERTEX_MAP.set(`${x},${y}`, [x, y]);
    VERTEX_MAP.set(`${200 - x},${y}`, [200 - x, y]);
  }
}
const VERTICES: Point[] = [...VERTEX_MAP.values()];

const MESH_COLOR = '#4ADE80';

/** 와이어프레임 메시 1겹 - bright면 밝은 선(glow 겹선) + 100% 점 */
function WireMesh({ bright, withGrid }: { bright: boolean; withGrid?: boolean }) {
  return (
    <Svg width={MASK_WIDTH} height={MASK_HEIGHT} viewBox="0 0 200 260">
      {withGrid &&
        [45, 85, 125].map((radius) => (
          <Circle
            key={`g${radius}`}
            cx={100}
            cy={130}
            r={radius}
            fill="none"
            stroke={MESH_COLOR}
            strokeOpacity={0.05}
            strokeWidth={1}
          />
        ))}
      {bright &&
        TRIANGLE_POINTS.map((points, i) => (
          <Polygon
            key={`halo${i}`}
            points={points}
            fill="none"
            stroke={MESH_COLOR}
            strokeOpacity={0.35}
            strokeWidth={3}
          />
        ))}
      {TRIANGLE_POINTS.map((points, i) => (
        <Polygon
          key={`t${i}`}
          points={points}
          fill="none"
          stroke={MESH_COLOR}
          strokeOpacity={bright ? 1 : 0.3}
          strokeWidth={1}
        />
      ))}
      {VERTICES.map(([x, y], i) => (
        <Circle
          key={`v${i}`}
          cx={x}
          cy={y}
          r={2}
          fill={MESH_COLOR}
          fillOpacity={bright ? 1 : 0.3}
        />
      ))}
    </Svg>
  );
}

// 지표 체크 시 스프링 미세 반동
function SpringCheck() {
  const scale = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 160,
      useNativeDriver: true,
    }).start();
  }, [scale]);
  return (
    <Animated.Text
      style={[styles.metricCheck, styles.metricCheckDone, { transform: [{ scale }] }]}
    >
      ✓
    </Animated.Text>
  );
}

type Props = {
  stage: AnalysisStage; // useSkinAnalysis의 실제 진행 상태
  onAnalysisComplete: () => void; // 지표 5개 체크 완료(=stage done 반영) 후 호출
};

export function AnalyzingView({ stage, onAnalysisComplete }: Props) {
  const [checkedCount, setCheckedCount] = useState(0);
  const scan = useRef(new Animated.Value(0)).current;
  const completeRef = useRef(onAnalysisComplete);
  completeRef.current = onAnalysisComplete;
  const stageRef = useRef(stage);
  stageRef.current = stage;

  // 스캔 라인: 얼굴 위를 위→아래 반복 이동
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(scan, {
        toValue: 1,
        duration: SCAN_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [scan]);

  // 0.6초 간격으로 현재 단계의 목표 개수까지만 순차 체크.
  // stage가 늦게 전진하면(예: API 지연) 그 목표에서 대기 → 연출이 실제 진행과 물린다.
  // 완료 판정은 여기서 하지 않는다(아래 effect가 전담).
  useEffect(() => {
    const timer = setInterval(() => {
      setCheckedCount((prev) => Math.min(prev + 1, STAGE_TARGET[stageRef.current]));
    }, CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  // 완료 콜백은 stage가 'done'(=검증·저장까지 성공)이고 지표가 전부 체크됐을 때만.
  // 실패 시 stage는 done에 도달하지 않으므로(useSkinAnalysis가 error를 세팅하고 중단)
  // 이 콜백은 구조적으로 호출될 수 없다 - 에러 시엔 부모가 AnalysisErrorView를 렌더.
  useEffect(() => {
    if (stage !== 'done' || checkedCount < STRINGS.analyzeMetrics.length) return;
    const timer = setTimeout(() => completeRef.current(), 400);
    return () => clearTimeout(timer);
  }, [stage, checkedCount]);

  const translateY = scan.interpolate({
    inputRange: [0, 1],
    outputRange: [0, MASK_HEIGHT - 3],
  });
  // 스캔 라인 ±20px 밴드(클리핑 창)가 라인과 함께 이동하고,
  // 내부의 밝은 메시는 반대로 이동해 세계 좌표가 고정 - 통과 구간만 밝아진다.
  const bandTranslate = scan.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCAN_BAND_HALF, MASK_HEIGHT - 3 - SCAN_BAND_HALF],
  });
  const bandInnerTranslate = scan.interpolate({
    inputRange: [0, 1],
    outputRange: [SCAN_BAND_HALF, -(MASK_HEIGHT - 3 - SCAN_BAND_HALF)],
  });

  return (
    <View style={styles.container}>
      <View style={styles.maskWrap}>
        <WireMesh bright={false} withGrid />
        <Animated.View
          style={[styles.scanBand, { transform: [{ translateY: bandTranslate }] }]}
          pointerEvents="none"
        >
          <Animated.View style={{ transform: [{ translateY: bandInnerTranslate }] }}>
            <WireMesh bright />
          </Animated.View>
        </Animated.View>
        <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />
      </View>
      <Text style={styles.title}>{STRINGS.analyzing}</Text>
      <Text style={styles.stageLabel}>{STAGE_LABEL[stage]}</Text>
      <View style={styles.metrics}>
        {STRINGS.analyzeMetrics.map((name, i) => {
          const done = i < checkedCount;
          return (
            <View key={name} style={styles.metricRow}>
              {done ? (
                <SpringCheck />
              ) : (
                <Text style={styles.metricCheck}>·</Text>
              )}
              <Text style={[styles.metricName, done && styles.metricNameDone]}>
                {name}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.privacy}>{STRINGS.privacyNotice}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F14',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 24,
  },
  maskWrap: {
    width: MASK_WIDTH,
    height: MASK_HEIGHT,
    overflow: 'hidden',
  },
  scanBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCAN_BAND_HALF * 2,
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(74,222,128,0.9)',
  },
  title: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '600',
  },
  stageLabel: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: -16,
  },
  metrics: {
    gap: 8,
    alignSelf: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: 120,
  },
  metricCheck: {
    color: '#4B5563',
    fontSize: 15,
    width: 18,
    textAlign: 'center',
  },
  metricCheckDone: {
    color: '#4ADE80',
    fontWeight: '700',
  },
  metricName: {
    color: '#6B7280',
    fontSize: 14,
  },
  metricNameDone: {
    color: '#E5E7EB',
  },
  privacy: {
    color: 'rgba(229,231,235,0.55)',
    fontSize: 12,
  },
});
