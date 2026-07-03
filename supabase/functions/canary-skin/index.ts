// canary-skin - 고정 테스트 이미지(Storage 'canary' 버킷, 최대 3장)를 분석해
// 지표 점수를 canary_logs에 기록. 직전 기록 대비 어느 지표든 ±5 초과 변동 시 WARN.
// 모델 드리프트 감시 - 14일 비교 제품의 생명선. pg_cron이 매일 1회 호출.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SKIN_ANALYSIS_PROMPT } from '../analyze-skin/prompt.gen.ts';
import { skinAnalysisSchema, type SkinAnalysis } from '../analyze-skin/schema.ts';

const MODEL = 'claude-sonnet-4-6';
const DRIFT_THRESHOLD = 5;
const BUCKET = 'canary';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function stripFences(text: string): string {
  return text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

type Scores = Record<string, number | null>;

function flattenScores(result: SkinAnalysis): Scores {
  const color = (key: 'redness' | 'tone_evenness' | 'pigment') => {
    const metric = result.color[key];
    return 'held' in metric ? null : metric.score;
  };
  return {
    pores: result.structural.pores.score,
    texture: result.structural.texture.score,
    blemish: result.structural.blemish.score,
    oil_moisture: result.oil_moisture.score,
    redness: color('redness'),
    tone_evenness: color('tone_evenness'),
    pigment: color('pigment'),
    overall: result.overall.score,
  };
}

async function analyzeImage(
  anthropic: Anthropic,
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png',
): Promise<SkinAnalysis | null> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    temperature: 0,
    system: SKIN_ANALYSIS_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: '이 셀카를 분석해 지정된 JSON만 출력하라.' },
        ],
      },
    ],
  });
  const block = response.content[0];
  if (!block || block.type !== 'text') return null;
  try {
    const validated = skinAnalysisSchema.safeParse(JSON.parse(stripFences(block.text)));
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  try {
    // cron 전용 - 공유 시크릿으로 보호
    const secret = req.headers.get('x-canary-secret') ?? '';
    const expected = Deno.env.get('CANARY_SECRET') ?? '';
    if (!expected || secret !== expected) return json({ error: 'unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' });

    const { data: files, error: listError } = await supabase.storage.from(BUCKET).list('', {
      limit: 10,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (listError) throw listError;
    const images = (files ?? []).filter((f) => /\.(jpe?g|png)$/i.test(f.name)).slice(0, 3);
    if (images.length === 0) return json({ error: 'no_canary_images' }, 500);

    const summary: { image: string; warn: boolean; scores: Scores }[] = [];
    for (const file of images) {
      const { data: blob, error: dlError } = await supabase.storage.from(BUCKET).download(file.name);
      if (dlError || !blob) {
        console.log('[canary] download failed:', file.name);
        continue;
      }
      const mediaType = /\.png$/i.test(file.name) ? 'image/png' : 'image/jpeg';
      const result = await analyzeImage(
        anthropic,
        toBase64(new Uint8Array(await blob.arrayBuffer())),
        mediaType,
      );
      if (!result) {
        console.log('[canary] analysis invalid:', file.name);
        continue;
      }
      const scores = flattenScores(result);

      // 직전 기록 대비 드리프트 판정 (동일 이미지, 양쪽 다 점수형인 지표만)
      const { data: prevRows } = await supabase
        .from('canary_logs')
        .select('scores')
        .eq('image_name', file.name)
        .order('created_at', { ascending: false })
        .limit(1);
      const prev = (prevRows?.[0]?.scores ?? null) as Scores | null;
      const warnDetail: { metric: string; prev: number; curr: number; delta: number }[] = [];
      if (prev) {
        for (const [metric, curr] of Object.entries(scores)) {
          const before = prev[metric];
          if (typeof before === 'number' && typeof curr === 'number') {
            const delta = curr - before;
            if (Math.abs(delta) > DRIFT_THRESHOLD) {
              warnDetail.push({ metric, prev: before, curr, delta });
            }
          }
        }
      }
      const warn = warnDetail.length > 0;
      if (warn) {
        console.log(`[canary] WARN drift on ${file.name}: ${JSON.stringify(warnDetail)}`);
      }

      const { error: insertError } = await supabase.from('canary_logs').insert({
        image_name: file.name,
        result,
        scores,
        warn,
        warn_detail: warn ? warnDetail : null,
      });
      if (insertError) console.log('[canary] insert failed:', insertError.message);
      summary.push({ image: file.name, warn, scores });
    }
    return json({ ok: true, summary }, 200);
  } catch (error) {
    console.log('[canary] error:', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'internal' }, 500);
  }
});
