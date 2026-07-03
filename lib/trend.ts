import { isHeld, type SkinAnalysis } from './analysis/schema';

export type TrendMetricKey =
  | 'overall'
  | 'pores'
  | 'texture'
  | 'blemish'
  | 'oil_moisture'
  | 'redness'
  | 'tone_evenness'
  | 'pigment';

export const TREND_METRIC_KEYS: TrendMetricKey[] = [
  'overall',
  'pores',
  'texture',
  'blemish',
  'oil_moisture',
  'redness',
  'tone_evenness',
  'pigment',
];

/** 스캔 결과에서 지표 값 추출. 색 지표의 측정 보류는 null(그래프 단절). */
export function metricValue(result: SkinAnalysis, key: TrendMetricKey): number | null {
  if (key === 'overall') return result.overall.score;
  if (key === 'oil_moisture') return result.oil_moisture.score;
  if (key === 'pores' || key === 'texture' || key === 'blemish') {
    return result.structural[key].score;
  }
  const metric = result.color[key];
  return isHeld(metric) ? null : metric.score;
}

export type ChartPoint = { x: number; y: number };
export type TrendSegments = {
  solid: ChartPoint[][]; // 연속 실측 구간(실선)
  dashed: [ChartPoint, ChartPoint][]; // held 단절을 잇는 점선 연결부
};

/**
 * null(측정 보류) 구간에서 실선을 단절하고, 단절 양끝 실측점을 점선으로 잇는다.
 * 입력은 x 오름차순 가정.
 */
export function buildTrendSegments(
  points: { x: number; y: number | null }[],
): TrendSegments {
  const solid: ChartPoint[][] = [];
  const dashed: [ChartPoint, ChartPoint][] = [];
  let run: ChartPoint[] = [];
  for (const point of points) {
    if (point.y === null) {
      if (run.length > 0) {
        solid.push(run);
        run = [];
      }
      continue;
    }
    const chartPoint = { x: point.x, y: point.y };
    if (run.length === 0 && solid.length > 0) {
      const previousRun = solid[solid.length - 1];
      dashed.push([previousRun[previousRun.length - 1], chartPoint]);
    }
    run.push(chartPoint);
  }
  if (run.length > 0) solid.push(run);
  return { solid, dashed };
}
