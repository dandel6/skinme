import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { STRINGS } from '../../constants/strings';
import { useTrendScans } from '../../hooks/useTrendScans';
import { COLORS } from '../../lib/ui';
import {
  buildTrendSegments,
  metricValue,
  TREND_METRIC_KEYS,
  type TrendMetricKey,
} from '../../lib/trend';

const HEIGHT = 190;
const PAD_LEFT = 30;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

function chipLabel(key: TrendMetricKey): string {
  if (key === 'overall') return STRINGS.trendOverall;
  if (key === 'oil_moisture') return STRINGS.oilMoistureLabel;
  return STRINGS.metricLabels[key];
}

/** Pro 전용 추이 라인 차트 - 주/월 토글, 지표 선택, held 구간 점선 단절 */
export function TrendChart() {
  const [period, setPeriod] = useState<7 | 30>(7);
  const [metric, setMetric] = useState<TrendMetricKey>('overall');
  const [width, setWidth] = useState(0);
  const { scans } = useTrendScans(period);

  const innerWidth = Math.max(1, width - PAD_LEFT - PAD_RIGHT);
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const yFor = (score: number) => PAD_TOP + (1 - score / 100) * innerHeight;

  const t0 = scans.length > 0 ? scans[0].t : 0;
  const t1 = scans.length > 0 ? scans[scans.length - 1].t : 1;
  const span = Math.max(1, t1 - t0);
  const xFor = (t: number) =>
    scans.length === 1 ? PAD_LEFT + innerWidth / 2 : PAD_LEFT + ((t - t0) / span) * innerWidth;

  const points = scans.map((scan) => ({
    x: xFor(scan.t),
    y: metricValue(scan.result, metric),
  }));
  const scoredCount = points.filter((p) => p.y !== null).length;
  const segments = buildTrendSegments(
    points.map((p) => ({ x: p.x, y: p.y === null ? null : yFor(p.y) })),
  );
  const toPointsString = (run: { x: number; y: number }[]) =>
    run.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const formatDate = (t: number) => {
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.headerRow}>
        <Text style={styles.section}>{STRINGS.trendTitle}</Text>
        <View style={styles.periodToggle}>
          {([7, 30] as const).map((days) => (
            <Pressable
              key={days}
              hitSlop={{ top: 10, bottom: 10, left: 2, right: 2 }}
              style={({ pressed }) => [
                styles.periodButton,
                period === days && styles.periodActive,
                pressed && styles.controlPressed,
              ]}
              onPress={() => setPeriod(days)}
            >
              <Text style={[styles.periodText, period === days && styles.periodTextActive]}>
                {days === 7 ? STRINGS.trendWeek : STRINGS.trendMonth}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {width > 0 && scoredCount >= 2 ? (
        <Svg width={width} height={HEIGHT}>
          {[0, 50, 100].map((grid) => (
            <Line
              key={grid}
              x1={PAD_LEFT}
              y1={yFor(grid)}
              x2={width - PAD_RIGHT}
              y2={yFor(grid)}
              stroke="#E5E7EB"
              strokeWidth={1}
            />
          ))}
          {[0, 50, 100].map((grid) => (
            <SvgText key={`l${grid}`} x={4} y={yFor(grid) + 4} fontSize={10} fill="#9CA3AF">
              {grid}
            </SvgText>
          ))}
          {segments.dashed.map(([a, b], i) => (
            <Line
              key={`d${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#9CA3AF"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          ))}
          {segments.solid.map((run, i) =>
            run.length > 1 ? (
              <Polyline
                key={`s${i}`}
                points={toPointsString(run)}
                stroke="#111111"
                strokeWidth={2}
                fill="none"
              />
            ) : null,
          )}
          {segments.solid.flatMap((run, i) =>
            run.map((p, j) => (
              <Circle key={`p${i}-${j}`} cx={p.x} cy={p.y} r={3} fill="#111111" />
            )),
          )}
          <SvgText x={PAD_LEFT} y={HEIGHT - 6} fontSize={10} fill="#6B7280">
            {formatDate(t0)}
          </SvgText>
          <SvgText
            x={width - PAD_RIGHT}
            y={HEIGHT - 6}
            fontSize={10}
            fill="#6B7280"
            textAnchor="end"
          >
            {formatDate(t1)}
          </SvgText>
        </Svg>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{STRINGS.trendEmpty}</Text>
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chips}>
          {TREND_METRIC_KEYS.map((key) => (
            <Pressable
              key={key}
              hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
              style={({ pressed }) => [
                styles.chip,
                metric === key && styles.chipActive,
                pressed && styles.controlPressed,
              ]}
              onPress={() => setMetric(key)}
            >
              <Text style={[styles.chipText, metric === key && styles.chipTextActive]}>
                {chipLabel(key)}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  section: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  periodToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  periodButton: {
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  periodActive: {
    backgroundColor: '#111111',
  },
  periodText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '600',
  },
  periodTextActive: {
    color: '#ffffff',
  },
  empty: {
    height: HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: COLORS.card,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  chipText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  controlPressed: {
    opacity: 0.7,
  },
});
