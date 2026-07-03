// analyze-skin - 크롭 셀카 1장을 받아 Claude vision으로 계측하고 scans에 저장.
// 프라이버시: 이미지는 이 요청 핸들러의 변수 수명 밖에 저장하지 않으며,
// base64를 로그에 출력하지 않는다. DB에는 결과 JSON만 저장.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  SKIN_ANALYSIS_PROMPT,
  SKIN_ANALYSIS_PROMPT_SHA,
  SKIN_ANALYSIS_PROMPT_SOURCE,
} from './prompt.gen.ts';
import { skinAnalysisSchema, type SkinAnalysis } from './schema.ts';

const MODEL = 'claude-sonnet-4-6'; // CLAUDE.md 지정 모델

// 배포본이 어느 프롬프트 버전인지 콜드스타트 로그로 추적
console.log('[analyze-skin] prompt:', SKIN_ANALYSIS_PROMPT_SOURCE, 'sha:', SKIN_ANALYSIS_PROMPT_SHA);

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// 모델이 코드 펜스를 붙였을 경우 제거
function stripFences(text: string): string {
  return text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

// 벨트+서스펜더: 모델이 5의 배수 규칙(프롬프트 v0.5)을 어겨도
// 저장 데이터는 항상 5점 밴드에 정렬되도록 서버측 정규화
function quantize5(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value / 5) * 5));
}

function quantizeScores(result: SkinAnalysis): SkinAnalysis {
  const q = <T extends { score: number }>(metric: T): T => ({
    ...metric,
    score: quantize5(metric.score),
  });
  const color = { ...result.color };
  for (const key of ['redness', 'tone_evenness', 'pigment'] as const) {
    const metric = color[key];
    if (!('held' in metric)) color[key] = q(metric);
  }
  return {
    ...result,
    structural: {
      pores: q(result.structural.pores),
      texture: q(result.structural.texture),
      blemish: q(result.structural.blemish),
    },
    oil_moisture: q(result.oil_moisture),
    overall: { ...result.overall, score: quantize5(result.overall.score) },
    color,
  };
}

// 지표 이원화 서버측 강제(v0.9 color_cast 이원화). lighting 라벨별 보류 대상:
//  good → 유지 / color_cast → 톤·색소만 보류(붉은기 유지) / dim → 색 3종 보류.
// 프롬프트 규칙6과 동일 규칙의 벨트+서스펜더. lighting_ok 컬럼 의미(=good)는 불변.
function enforceColorHold(result: SkinAnalysis): SkinAnalysis {
  const lighting = result.capture_quality.lighting;
  if (lighting === 'good') return result;
  const holdKeys =
    lighting === 'color_cast'
      ? (['tone_evenness', 'pigment'] as const)
      : (['redness', 'tone_evenness', 'pigment'] as const);
  const reason =
    lighting === 'color_cast' ? '색 치우침으로 톤·색소 측정 보류' : '조명 불량으로 측정 보류';
  const color = { ...result.color };
  for (const key of holdKeys) {
    if (!('held' in color[key])) color[key] = { held: true as const, hold_reason: reason };
  }
  return { ...result, color };
}

// 스캔 신뢰도 파생(v0.10, 모델 출력 아님) - capture_quality + lighting 종합.
//  held  ← angle=bad 또는 focus=blur
//  low   ← angle=marginal, issues 존재, 또는 lighting≠good
//          (결정2: dim/color_cast면 색만 보류되던 비대칭 해소 - 표면 지표도 최소 low 강등)
//  normal ← 그 외(전부 good)
function deriveScanConfidence(result: SkinAnalysis): 'normal' | 'low' | 'held' {
  const cq = result.capture_quality;
  const angle = cq.angle ?? 'good';
  const issues = cq.issues ?? [];
  if (angle === 'bad' || cq.focus === 'blur') return 'held';
  if (angle === 'marginal' || issues.length > 0 || cq.lighting !== 'good') return 'low';
  return 'normal';
}

type AnalyzeOutcome =
  | { kind: 'ok'; result: SkinAnalysis }
  | { kind: 'no_face' }
  | { kind: 'invalid' };

async function analyzeOnce(
  anthropic: Anthropic,
  imageBase64: string,
): Promise<AnalyzeOutcome> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    temperature: 0, // 회차 간 점수 안정화 - 재현성 테스트 지표차 완화의 기본기
    system: SKIN_ANALYSIS_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
          },
          { type: 'text', text: '이 셀카를 분석해 지정된 JSON만 출력하라.' },
        ],
      },
    ],
  });
  const block = response.content[0];
  if (!block || block.type !== 'text') {
    console.log('[analyze-skin] unexpected content type', block?.type ?? 'none');
    return { kind: 'invalid' };
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(stripFences(block.text));
  } catch {
    console.log('[analyze-skin] JSON parse failed');
    return { kind: 'invalid' };
  }
  // 프롬프트 규칙: 얼굴 없음/판독 불가면 {"error": "no_face"} - 재시도 무의미
  if (
    typeof parsedJson === 'object' &&
    parsedJson !== null &&
    'error' in parsedJson
  ) {
    return { kind: 'no_face' };
  }
  const validated = skinAnalysisSchema.safeParse(parsedJson);
  if (!validated.success) {
    console.log('[analyze-skin] schema validation failed');
    return { kind: 'invalid' };
  }
  return { kind: 'ok', result: validated.data };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    // JWT의 사용자로 스코프된 클라이언트 - RLS가 본인 행 insert만 허용
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: 'unauthorized' }, 401);

    // 폭주·루프 방어: 유저당 시간당 10회 (Pro 포함 전원 - 정상 사용 도달 불가 수치).
    // 실패한 시도도 집계되도록 분석 시작 전에 기록한다.
    const RATE_LIMIT_PER_HOUR = 10;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: rateError } = await supabase
      .from('analysis_requests')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo);
    if (rateError) {
      console.log('[analyze-skin] rate check failed (fail-open):', rateError.message);
    } else if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      console.log('[analyze-skin] rate limited:', userData.user.id, 'count:', count);
      return json({ error: 'rate_limited' }, 429);
    }
    const { error: requestLogError } = await supabase
      .from('analysis_requests')
      .insert({ user_id: userData.user.id });
    if (requestLogError) {
      console.log('[analyze-skin] request log failed:', requestLogError.message);
    }

    // 무료 캡 서버 강제(원가 방어 백스톱): non-Pro가 오늘(KST) 1회 초과면 429.
    // ⚠️ ENFORCE_SERVER_CAP=1일 때만 동작. RevenueCat webhook이 entitlements를 채우기
    //    전에 켜면 Pro 유저도 non-Pro로 간주돼 캡당한다 - webhook 검증 후 secrets로 켤 것.
    if (Deno.env.get('ENFORCE_SERVER_CAP') === '1') {
      const { data: entRow } = await supabase
        .from('entitlements')
        .select('is_pro')
        .eq('user_id', userData.user.id)
        .maybeSingle();
      if (entRow?.is_pro !== true) {
        const { data: todayCount } = await supabase.rpc('scans_today_count');
        if (typeof todayCount === 'number' && todayCount >= 1) {
          console.log('[analyze-skin] daily cap:', userData.user.id);
          return json({ error: 'daily_cap' }, 429);
        }
      }
    }

    const body = await req.json().catch(() => null);
    const imageBase64 = body?.image_base64;
    if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
      return json({ error: 'bad_request' }, 400);
    }

    // ANTHROPIC_API_KEY는 supabase secrets로만 접근 (클라이언트 노출 금지)
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' });

    // 검증 실패 시 1회 재시도 → 재실패 시 422 (CLAUDE.md 규칙)
    let outcome = await analyzeOnce(anthropic, imageBase64);
    if (outcome.kind === 'invalid') {
      console.log('[analyze-skin] retrying once after validation failure');
      outcome = await analyzeOnce(anthropic, imageBase64);
    }
    if (outcome.kind === 'no_face') return json({ error: 'no_face' }, 422);
    if (outcome.kind === 'invalid') return json({ error: 'validation_failed' }, 422);

    const scored = enforceColorHold(quantizeScores(outcome.result));
    // v0.10: 신뢰도 파생을 result에 주입(전용 컬럼은 P3, 지금은 result jsonb에 동거 → 즉시 활용)
    const result = { ...scored, scan_confidence: deriveScanConfidence(scored) };
    const lightingOk = result.capture_quality.lighting === 'good';

    // 캡처 컨텍스트(B-트랙): 클라 제공분(기기·앱버전)은 화이트리스트+길이 제한(임의 blob 차단),
    // 엔진·프롬프트 버전은 서버 authoritative. verdict 품질 분석·모델 드리프트 추적용 메타데이터.
    const cc = (body?.client_context ?? {}) as Record<string, unknown>;
    const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null);
    const num = (v: unknown, lo: number, hi: number) =>
      typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null;
    const captureContext = {
      device_model: str(cc.device_model, 80),
      os_name: str(cc.os_name, 40),
      os_version: str(cc.os_version, 40),
      app_version: str(cc.app_version, 40),
      gate_source: str(cc.gate_source, 16), // 'sensor'(lux) | 'fallback'(luma)
      gate_value: num(cc.gate_value, 0, 100000), // 사전게이트: lux 또는 luma(0-255)
      post_luma: num(cc.post_luma, 0, 255), // 촬영본 중앙 휘도(사후판정값). null이면 미측정/실패
      post_luma_error: str(cc.post_luma_error, 24), // 측정 실패 단계(render_failed 등), 성공 시 null
      prompt_sha: SKIN_ANALYSIS_PROMPT_SHA,
      prompt_source: SKIN_ANALYSIS_PROMPT_SOURCE,
      model: MODEL,
    };

    // scans 쓰기는 이 함수(service role)만 - 클라이언트 insert 정책은 제거됨(위조 차단).
    // user_id는 인증된 유저에서만 세팅하므로 타인 행 위조 불가.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const { error: insertError } = await admin.from('scans').insert({
      user_id: userData.user.id,
      result,
      lighting_ok: lightingOk,
      capture_context: captureContext,
    });
    if (insertError) {
      console.log('[analyze-skin] insert failed', insertError.message);
      return json({ error: 'db_insert_failed' }, 500);
    }

    return json({ result }, 200);
  } catch (error) {
    console.log('[analyze-skin] error', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'internal' }, 500);
  }
});
