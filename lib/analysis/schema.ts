import { z } from 'zod';

// 서버(supabase/functions/analyze-skin/schema.ts)와 동일 스키마 - 수정 시 양쪽 함께.
// CLAUDE.md 지표 이원화: 구조 지표는 항상 점수, 색 지표는 lighting=="good"일 때만
// 점수이고 아니면 { held: true, hold_reason } 로 측정 보류.

export const scoredMetricSchema = z.object({
  score: z.number(),
  evidence: z.string(),
});

export const heldMetricSchema = z.object({
  held: z.literal(true),
  hold_reason: z.string(),
});

export const colorMetricSchema = z.union([scoredMetricSchema, heldMetricSchema]);

export const skinAnalysisSchema = z.object({
  capture_quality: z.object({
    lighting: z.enum(['good', 'dim', 'color_cast']),
    focus: z.enum(['ok', 'blur']),
    // v0.10 순수 추가(하위호환 위해 optional). lighting enum은 색 이원화 보호 위해 불변.
    angle: z.enum(['good', 'marginal', 'bad']).optional(),
    confidence: z.enum(['high', 'mid', 'low']),
    issues: z.array(z.string()).optional(), // 촬영 신뢰도 경고(내부용)
  }),
  structural: z.object({
    pores: scoredMetricSchema,
    texture: scoredMetricSchema,
    blemish: scoredMetricSchema,
  }),
  color: z.object({
    redness: colorMetricSchema,
    tone_evenness: colorMetricSchema,
    pigment: colorMetricSchema,
  }),
  // 명칭과 달리 유분(번들거림)만 측정 - 수분 함량은 이미지로 판단 불가라 v0.9에서 재정의됨.
  // key는 데이터 연속성 위해 유지. 유저 라벨은 '유분'(strings.oilMoistureLabel).
  oil_moisture: scoredMetricSchema,
  overall: z.object({
    score: z.number(),
    basis: z.string(),
  }),
  one_priority: z.object({
    item: z.string(),
    guide: z.string(),
  }),
  // 서버 파생(모델 출력 아님) - capture_quality + lighting 종합 신뢰도. 하위호환 위해 optional.
  scan_confidence: z.enum(['normal', 'low', 'held']).optional(),
});

export type SkinAnalysis = z.infer<typeof skinAnalysisSchema>;
export type ScoredMetric = z.infer<typeof scoredMetricSchema>;
export type ColorMetric = z.infer<typeof colorMetricSchema>;

export function isHeld(metric: ColorMetric): metric is z.infer<typeof heldMetricSchema> {
  return 'held' in metric;
}
