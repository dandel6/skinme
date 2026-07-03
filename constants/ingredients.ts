// 성분 가이드 정적 데이터 - 모델 생성 아님. 제품명·브랜드 절대 금지(CLAUDE.md).
// one_priority.guide 텍스트에서 성분명을 감지해 탭 가능하게 만드는 데 사용.
import type { TrendMetricKey } from '../lib/trend';
import { STRINGS } from './strings';

export type Ingredient = {
  name: string;
  aliases: string[]; // guide 텍스트 매칭용 (name 포함해 긴 것 우선 매칭)
  what: string; // 무슨 성분인지 1줄
  relatedMetric: TrendMetricKey; // 현재 지표 점수 연동 문구용
  why: string; // 왜 지금 내 피부에 (점수 문구 뒤에 붙음)
  pick: string; // 고르는 법
};

export const INGREDIENTS: Ingredient[] = [
  {
    name: '나이아신아마이드',
    aliases: ['니아신아마이드'],
    what: '피지 조절과 톤 개선을 돕는 비타민 B3 유도체예요',
    relatedMetric: 'tone_evenness',
    why: '톤 균일도와 피지 밸런스를 함께 다루는 기본기 성분이에요',
    pick: '2~5% 농도로 시작하는 게 무난해요. 전성분표 앞쪽에 있을수록 함량이 높아요',
  },
  {
    name: '살리실산',
    aliases: ['살리실릭애씨드', 'BHA'],
    what: '모공 속 피지를 녹여내는 지용성 각질 성분(BHA)이에요',
    relatedMetric: 'blemish',
    why: '트러블과 막힌 모공에 직접 작용해요',
    pick: '0.5~2%가 일반적이에요. 처음엔 주 2~3회로 시작하세요',
  },
  {
    name: '레티놀',
    aliases: ['레티날', '레티노이드'],
    what: '피부결과 잔주름을 다루는 비타민 A 유도체예요',
    relatedMetric: 'texture',
    why: '피부결 개선의 장기전 성분 - 꾸준함이 핵심이에요',
    pick: '저농도(0.1% 이하)로 밤에만, 자외선차단제와 세트로 쓰세요',
  },
  {
    name: '비타민C',
    aliases: ['비타민 C', '아스코르빅애씨드', '아스코르브산'],
    what: '색소 침착을 옅게 하고 산화를 막는 항산화 성분이에요',
    relatedMetric: 'pigment',
    why: '색소 자국을 서서히 옅게 만드는 대표 성분이에요',
    pick: '순수 비타민C(아스코르빅애씨드)는 10~20%, 개봉 후 빨리 쓰세요',
  },
  {
    name: '히알루론산',
    aliases: ['하이알루로닉애씨드', '히아루론산'],
    what: '수분을 끌어당겨 잡아두는 보습 성분이에요',
    relatedMetric: 'oil_moisture',
    why: '수분 부족형 밸런스 이탈에 가장 먼저 시도할 성분이에요',
    pick: '젖은 피부에 바르고 위에 크림으로 덮어야 효과가 커요',
  },
  {
    name: '세라마이드',
    aliases: [],
    what: '피부 장벽의 구성 성분 - 장벽을 메워 수분 손실을 줄여요',
    relatedMetric: 'texture',
    why: '자극으로 거칠어진 결을 회복시키는 토대 성분이에요',
    pick: '콜레스테롤·지방산과 함께 든 제형이 장벽 조성에 가까워요',
  },
  {
    name: '아젤라산',
    aliases: ['아젤라익애씨드'],
    what: '붉은기와 트러블을 함께 다루는 순한 산 성분이에요',
    relatedMetric: 'redness',
    why: '붉은기 완화와 트러블 관리를 동시에 노릴 수 있어요',
    pick: '10% 내외로 시작하면 자극이 적은 편이에요',
  },
  {
    name: '판테놀',
    aliases: ['판테놀(비타민B5)', '덱스판테놀'],
    what: '자극받은 피부를 진정시키는 비타민 B5 성분이에요',
    relatedMetric: 'redness',
    why: '붉게 올라온 피부를 가라앉히는 진정 기본기예요',
    pick: '5% 내외 고함량 제형이 진정 목적에 맞아요',
  },
  {
    name: '트라넥삼산',
    aliases: ['트라넥사믹애씨드'],
    what: '색소가 만들어지는 신호를 줄이는 미백 성분이에요',
    relatedMetric: 'pigment',
    why: '거뭇한 자국·기미성 색소에 축적형으로 작용해요',
    pick: '2~5% 농도가 일반적이고 아침·저녁 모두 쓸 수 있어요',
  },
  {
    name: '글리콜산',
    aliases: ['AHA', '글라이콜릭애씨드'],
    what: '피부 표면 각질을 정리하는 수용성 각질 성분(AHA)이에요',
    relatedMetric: 'texture',
    why: '칙칙하고 거친 결을 표면부터 정리해줘요',
    pick: '5~10%로 시작하고, 사용한 날은 자외선차단제가 필수예요',
  },
];

export type GuideSegment = { text: string; ingredient?: Ingredient };

/** guide 텍스트를 성분명 기준으로 분해 - 성분 부분만 탭 가능하게 렌더 */
export function splitGuideByIngredients(text: string): GuideSegment[] {
  const segments: GuideSegment[] = [];
  let rest = text;
  while (rest.length > 0) {
    let best: { index: number; alias: string; ingredient: Ingredient } | null = null;
    for (const ingredient of INGREDIENTS) {
      for (const alias of [ingredient.name, ...ingredient.aliases]) {
        const index = rest.indexOf(alias);
        if (index === -1) continue;
        if (
          !best ||
          index < best.index ||
          (index === best.index && alias.length > best.alias.length)
        ) {
          best = { index, alias, ingredient };
        }
      }
    }
    if (!best) {
      segments.push({ text: rest });
      break;
    }
    if (best.index > 0) segments.push({ text: rest.slice(0, best.index) });
    segments.push({ text: best.alias, ingredient: best.ingredient });
    rest = rest.slice(best.index + best.alias.length);
  }
  return segments;
}

/** one_priority.item 텍스트 → 지표 키 (연속성 표시용). 매칭 실패 시 null */
export function metricKeyForPriorityItem(item: string): TrendMetricKey | null {
  const labelToKey: [string, TrendMetricKey][] = [
    [STRINGS.metricLabels.pores, 'pores'],
    [STRINGS.metricLabels.texture, 'texture'],
    [STRINGS.metricLabels.blemish, 'blemish'],
    [STRINGS.oilMoistureLabel, 'oil_moisture'],
    [STRINGS.metricLabels.redness, 'redness'],
    [STRINGS.metricLabels.tone_evenness, 'tone_evenness'],
    [STRINGS.metricLabels.pigment, 'pigment'],
  ];
  for (const [label, key] of labelToKey) {
    if (item.includes(label)) return key;
  }
  return null;
}
