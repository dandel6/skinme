// prompts/skin-analysis-v*.md 중 최고 버전(원본) → supabase/functions/analyze-skin/prompt.gen.ts 동기화.
// 사용: node scripts/sync-prompt.mjs        (생성/갱신)
//       node scripts/sync-prompt.mjs --check (원본과 어긋나면 exit 1 - 배포 전 가드)
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROMPTS_DIR = path.join(root, 'prompts');
const TARGET = path.join(root, 'supabase', 'functions', 'analyze-skin', 'prompt.gen.ts');
const PATTERN = /^skin-analysis-v(\d+(?:\.\d+)*)\.md$/;

function versionOf(fileName) {
  const match = fileName.match(PATTERN);
  return match ? match[1].split('.').map(Number) : null;
}

function compareVersions(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

const candidates = existsSync(PROMPTS_DIR)
  ? readdirSync(PROMPTS_DIR).filter((name) => PATTERN.test(name))
  : [];
if (candidates.length === 0) {
  console.error(
    '[sync-prompt] FAIL: prompts/ 디렉토리에 skin-analysis-v*.md 파일이 없음 - 프롬프트 원본을 확인하세요',
  );
  process.exit(1);
}
candidates.sort((a, b) => compareVersions(versionOf(a), versionOf(b)));
const source = candidates[candidates.length - 1];
if (candidates.length > 1) {
  console.log(
    `[sync-prompt] ${candidates.length}개 버전 발견 (${candidates.join(', ')}) → 최신 ${source} 선택`,
  );
}

const markdown = readFileSync(path.join(PROMPTS_DIR, source), 'utf8');
const sha = createHash('sha256').update(markdown, 'utf8').digest('hex').slice(0, 16);

const generated = [
  '// AUTO-GENERATED - 직접 수정 금지.',
  `// 원본: prompts/${source} (source of truth)`,
  `// source sha256(16): ${sha}`,
  '// 갱신: npm run sync-prompt / 검증: npm run sync-prompt:check',
  `export const SKIN_ANALYSIS_PROMPT: string = ${JSON.stringify(markdown)};`,
  `export const SKIN_ANALYSIS_PROMPT_SOURCE = ${JSON.stringify(source)};`,
  `export const SKIN_ANALYSIS_PROMPT_SHA = ${JSON.stringify(sha)};`,
  '',
].join('\n');

const checkMode = process.argv.includes('--check');

// supabase/functions 아래를 재귀 스캔해 prompt.gen.ts 사본을 찾는다 (stale 사본 가드)
function findPromptGenCopies(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findPromptGenCopies(full));
    else if (entry.name === 'prompt.gen.ts') found.push(full);
  }
  return found;
}

if (checkMode) {
  let failed = false;
  const fail = (message) => {
    console.error(`[sync-prompt] FAIL: ${message}`);
    failed = true;
  };

  // 1) 배포 대상 파일 존재 + 원본 md와 바이트 단위 일치
  console.log(`[sync-prompt] source: prompts/${source} (sha ${sha})`);
  console.log(`[sync-prompt] deploy target: ${path.relative(root, TARGET)}`);
  if (!existsSync(TARGET)) {
    fail('배포 대상 prompt.gen.ts 없음 - npm run sync-prompt 실행 필요');
  } else {
    const current = readFileSync(TARGET, 'utf8');
    if (current !== generated) {
      fail(`배포 대상 파일이 원본(${source})과 다름 - npm run sync-prompt 실행 필요`);
    }
    // 2) 배포 대상 파일에 내장된 SHA 상수가 원본 계산값과 일치하는지 명시 검증
    const embedded = current.match(/SKIN_ANALYSIS_PROMPT_SHA = "([0-9a-f]+)"/);
    if (!embedded) {
      fail('배포 대상 파일에서 SKIN_ANALYSIS_PROMPT_SHA 상수를 찾을 수 없음');
    } else if (embedded[1] !== sha) {
      fail(`sha 불일치 - 원본 ${sha} vs 배포 대상 ${embedded[1]}`);
    } else {
      console.log(`[sync-prompt] embedded sha match: ${embedded[1]}`);
    }
  }

  // 3) 함수 디렉토리 트리에 stale 사본이 없는지 (배포 대상 외 prompt.gen.ts 금지)
  const functionsRoot = path.join(root, 'supabase', 'functions');
  const copies = existsSync(functionsRoot) ? findPromptGenCopies(functionsRoot) : [];
  const strays = copies.filter((file) => path.resolve(file) !== path.resolve(TARGET));
  if (strays.length > 0) {
    fail(`배포 대상 외 prompt.gen.ts 사본 발견: ${strays.join(', ')}`);
  }

  if (failed) process.exit(1);
  console.log(`[sync-prompt] OK (${source}, sha ${sha})`);
} else {
  writeFileSync(TARGET, generated, 'utf8');
  console.log(`[sync-prompt] generated prompt.gen.ts from ${source} (sha ${sha})`);
}
