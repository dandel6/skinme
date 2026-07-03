// E 하네스 - 프롬프트/이미지 쌍의 지표별 점수 갭 리포트 (재현성·드리프트 검증용).
// 외부 SDK 없이 Anthropic Messages API를 fetch로 직접 호출(앱 의존성 오염 방지).
// 실행 전제: 환경변수 ANTHROPIC_API_KEY, Node 18+ (global fetch), 이미지 파일(jpg/png).
//
// 사용:
//   E-1 (프롬프트 diff, 같은 이미지에 v0.8 vs v0.9):
//     node scripts/eval-prompt.mjs prompt-diff <img...>
//     → 이미지마다 v0.9 - v0.8 지표별 점수차. (예측: oil_moisture만 소폭, 나머지 ≈ 0)
//   E-2 (이미지 쌍, v0.9로 두 장 분석 → 지표별 갭. 웜캐스트 붉은기 안정성):
//     node scripts/eval-prompt.mjs pair <imgA1> <imgA2> [<imgB1> <imgB2> ...]
//     → 쌍마다 |A-B| 지표별 갭. held는 갭 계산에서 제외(held 여부 표기).
//
// 판정 프레임(각색 금지):
//   E-1: oil 외 지표 갭 ≈ 0이 통과. oil이 크게 움직이면 Phase A "유분이 이미 결정변수" 판독 재검토.
//   E-2: 웜캐스트 붉은기 갭이 불안정(크게 요동)하면 → O4(붉은기 유지) 접고 3종 held 후퇴 검토. 결과 그대로 보고.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const MODEL = 'claude-sonnet-4-6';
const API_KEY = process.env.ANTHROPIC_API_KEY;
const METRICS = ['pores', 'texture', 'blemish', 'oil_moisture', 'redness', 'tone_evenness', 'pigment', 'overall'];

if (!API_KEY) {
  console.error('ANTHROPIC_API_KEY 환경변수가 필요합니다.');
  process.exit(1);
}

function stripFences(t) {
  return t.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

function mediaType(file) {
  return /\.png$/i.test(file) ? 'image/png' : 'image/jpeg';
}

// result JSON → 지표별 점수(held면 null). overall 포함.
function flatten(result) {
  const color = (k) => {
    const m = result?.color?.[k];
    return m && 'held' in m ? null : (m?.score ?? null);
  };
  return {
    pores: result?.structural?.pores?.score ?? null,
    texture: result?.structural?.texture?.score ?? null,
    blemish: result?.structural?.blemish?.score ?? null,
    oil_moisture: result?.oil_moisture?.score ?? null,
    redness: color('redness'),
    tone_evenness: color('tone_evenness'),
    pigment: color('pigment'),
    overall: result?.overall?.score ?? null,
    _lighting: result?.capture_quality?.lighting ?? null,
    _angle: result?.capture_quality?.angle ?? null, // v0.10 규격 확인용(없으면 null)
    _issues: result?.capture_quality?.issues ?? null,
    _scan_confidence: result?.scan_confidence ?? null, // 서버 파생이라 직접호출엔 없음(참고)
  };
}

async function analyze(imgPath, promptText) {
  const b64 = (await readFile(imgPath)).toString('base64');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      temperature: 0,
      system: promptText,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType(imgPath), data: b64 } },
            { type: 'text', text: '이 셀카를 분석해 지정된 JSON만 출력하라.' },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const block = data.content?.find((c) => c.type === 'text');
  return flatten(JSON.parse(stripFences(block?.text ?? '{}')));
}

async function loadPrompt(version) {
  return readFile(path.resolve('prompts', `skin-analysis-${version}.md`), 'utf8');
}

function fmt(v) {
  return v === null ? ' held' : String(v).padStart(5);
}

async function runPromptDiff(images) {
  const [pOld, pNew] = await Promise.all([loadPrompt('v0.8'), loadPrompt('v0.9')]);
  console.log('E-1 프롬프트 diff (v0.9 - v0.8) · 예측: oil만 소폭, 나머지 ≈ 0\n');
  const accum = Object.fromEntries(METRICS.map((m) => [m, []]));
  for (const img of images) {
    const [a, b] = await Promise.all([analyze(img, pOld), analyze(img, pNew)]);
    console.log(`# ${path.basename(img)}  (lighting old=${a._lighting} new=${b._lighting})`);
    for (const m of METRICS) {
      const diff = a[m] !== null && b[m] !== null ? b[m] - a[m] : null;
      if (diff !== null) accum[m].push(Math.abs(diff));
      console.log(`  ${m.padEnd(14)} v0.8=${fmt(a[m])}  v0.9=${fmt(b[m])}  diff=${diff === null ? ' n/a' : (diff > 0 ? '+' : '') + diff}`);
    }
    console.log('');
  }
  console.log('=== 집계 (평균 |diff|, max |diff|) ===');
  for (const m of METRICS) {
    const xs = accum[m];
    const mean = xs.length ? (xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(1) : 'n/a';
    const max = xs.length ? Math.max(...xs) : 'n/a';
    console.log(`  ${m.padEnd(14)} mean=${mean}  max=${max}  (n=${xs.length})`);
  }
}

async function runPair(images) {
  if (images.length % 2 !== 0) {
    console.error('pair 모드는 이미지 개수가 짝수여야 합니다(쌍).');
    process.exit(1);
  }
  const pNew = await loadPrompt('v0.9');
  console.log('E-2 이미지 쌍 갭 (v0.9) · 웜캐스트 붉은기 안정성 게이트\n');
  for (let i = 0; i < images.length; i += 2) {
    const [imgA, imgB] = [images[i], images[i + 1]];
    const [a, b] = await Promise.all([analyze(imgA, pNew), analyze(imgB, pNew)]);
    console.log(`# 쌍: ${path.basename(imgA)} ↔ ${path.basename(imgB)}  (lighting ${a._lighting} / ${b._lighting})`);
    for (const m of METRICS) {
      const gap = a[m] !== null && b[m] !== null ? Math.abs(a[m] - b[m]) : null;
      const tag = m === 'redness' ? '  ← 게이트' : '';
      console.log(`  ${m.padEnd(14)} A=${fmt(a[m])}  B=${fmt(b[m])}  gap=${gap === null ? ' held' : gap}${tag}`);
    }
    console.log('');
  }
}

// P2 검증(v0.10): 규격(angle·issues) + 회귀(기존 지표 밴드 불변). 배포 무관(프롬프트 직접 호출).
//   node scripts/eval-prompt.mjs regress <img...>
//   판정: 기존 8지표 밴드(5단위) + 색 보류판정이 v0.9와 전부 동일해야 '순수 추가' 통과.
//         밴드 이동 1건이라도 있으면 순수 추가 위반 → P3 중단 대상.
async function runRegress(images) {
  const [pOld, pNew] = await Promise.all([loadPrompt('v0.9'), loadPrompt('v0.10')]);
  const q5 = (v) => (v === null ? null : Math.round(v / 5) * 5); // 밴드(5단위) 정규화
  const COLOR = new Set(['redness', 'tone_evenness', 'pigment']);
  console.log('회귀·규격 검증: v0.9 vs v0.10 (밴드=5단위). 순수 추가면 기존 지표 밴드/보류 불변 기대\n');
  let shifts = 0;
  let specFails = 0;
  for (const img of images) {
    const [a, b] = await Promise.all([analyze(img, pOld), analyze(img, pNew)]);
    // 2-a 규격: angle enum + issues 배열 존재?
    const angleOk = ['good', 'marginal', 'bad'].includes(b._angle);
    const issuesOk = Array.isArray(b._issues);
    if (!angleOk || !issuesOk) specFails += 1;
    console.log(`# ${path.basename(img)}`);
    console.log(
      `  [규격] angle=${b._angle ?? 'MISSING'}${angleOk ? '' : ' ✗'}  issues=${issuesOk ? JSON.stringify(b._issues) : 'MISSING ✗'}  lighting(v0.9/v0.10)=${a._lighting}/${b._lighting}`,
    );
    for (const m of METRICS) {
      const oldHeld = a[m] === null && COLOR.has(m);
      const newHeld = b[m] === null && COLOR.has(m);
      const oa = q5(a[m]);
      const ob = q5(b[m]);
      const same = oa === ob && oldHeld === newHeld;
      if (!same) shifts += 1;
      const cell = (v, held) => (held ? 'held' : v === null ? ' n/a' : String(v)).padStart(5);
      console.log(`  ${m.padEnd(14)} v0.9=${cell(oa, oldHeld)}  v0.10=${cell(ob, newHeld)}  ${same ? '=' : '≠ SHIFT'}`);
    }
    console.log('');
  }
  console.log('=== 판정 ===');
  console.log(`  규격(angle·issues): ${specFails === 0 ? 'PASS' : `FAIL (${specFails}장 누락/형식오류)`}`);
  console.log(
    shifts === 0
      ? '  회귀: PASS - 기존 8지표 밴드/보류판정 전부 동일(순수 추가 확인)'
      : `  회귀: ⚠️ 밴드 이동 ${shifts}건 - 순수 추가 위반, P3 중단 대상`,
  );
}

const [mode, ...images] = process.argv.slice(2);
if (!images.length || !['prompt-diff', 'pair', 'regress'].includes(mode)) {
  console.error('사용: node scripts/eval-prompt.mjs <prompt-diff|pair|regress> <이미지...>');
  process.exit(1);
}
const runner = mode === 'prompt-diff' ? runPromptDiff : mode === 'pair' ? runPair : runRegress;
runner(images).catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
