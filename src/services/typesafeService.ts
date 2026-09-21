import { VirtualTryOnSourceItemType } from '../types';

export interface ChoiceQuestion<T extends string = string> {
  type: 'choice';
  instructions: string | Record<string, unknown>;
  criteria: Record<T, string | null>;
}

export interface NoulQuestion {
  type: 'noul';
  instructions: string | Record<string, unknown>;
  criteria?: {
    true?: string;
    false?: string;
  };
}

export interface ScoreQuestion {
  type: 'score';
  instructions: string | Record<string, unknown>;
  criteria: string[];
}

export type SystemOneQuestion = ChoiceQuestion | NoulQuestion | ScoreQuestion;

export interface ChoiceAnswer<T extends string = string> {
  type: 'choice';
  choice: T;
  confidence: number;
  probabilities: Record<T, number>;
}

export interface NoulAnswer {
  type: 'noul';
  noul: number;
}

export interface ScoreAnswer {
  type: 'score';
  score: number;
  confidence: number;
  probabilities: Record<string, number>;
  legend?: Record<string, string>;
}

export type SystemOneAnswer = ChoiceAnswer | NoulAnswer | ScoreAnswer;

export interface SystemOneRequest {
  model?: string;
  state: unknown;
  questions: Record<string, SystemOneQuestion>;
}

export interface SystemOneResponse<TAnswers extends Record<string, SystemOneAnswer> = Record<string, SystemOneAnswer>> {
  model: string;
  answers: TAnswers;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export const TYPESAFE_STORAGE_KEY_API_KEY = 'typesafe_api_key';
export const TYPESAFE_STORAGE_KEY_BASE_URL = 'typesafe_base_url';
export const DEFAULT_TYPESAFE_BASE_URL = 'https://api.typesafe.ai/v1';

export function resolveTypesafeApiKey(): string | null {
  if (typeof localStorage !== 'undefined') {
    const customKey = localStorage.getItem(TYPESAFE_STORAGE_KEY_API_KEY)?.trim();
    if (customKey) return customKey;
  }
  const envKey = process.env.TYPESAFE_API_KEY?.trim();
  return envKey || null;
}

export function resolveTypesafeBaseUrl(): string {
  if (typeof localStorage !== 'undefined') {
    const customUrl = localStorage.getItem(TYPESAFE_STORAGE_KEY_BASE_URL)?.trim();
    if (customUrl) return customUrl.replace(/\/+$/, '');
  }
  const envUrl = process.env.TYPESAFE_BASE_URL?.trim();
  const rawUrl = (envUrl || DEFAULT_TYPESAFE_BASE_URL).replace(/\/+$/, '');
  if (typeof window !== 'undefined' && rawUrl.includes('api.typesafe.ai') && window.location.port === '3549') {
    return '/typesafe-proxy/v1';
  }
  return rawUrl;
}

/**
 * Execute a System One judgment request against the TypeSafe API.
 */
export async function callSystemOne<TAnswers extends Record<string, SystemOneAnswer> = Record<string, SystemOneAnswer>>(
  request: SystemOneRequest,
): Promise<SystemOneResponse<TAnswers>> {
  const apiKey = resolveTypesafeApiKey();
  if (!apiKey) {
    throw new Error('error.typesafe.missingApiKey');
  }

  const baseUrl = resolveTypesafeBaseUrl();
  const url = `${baseUrl}/systemone`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: request.model ?? 'jev-latest',
      state: request.state,
      questions: request.questions,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    let detail = '';
    try {
      const parsed = JSON.parse(errorText);
      detail = parsed.detail?.message || parsed.detail || parsed.message || errorText;
    } catch {
      detail = errorText || response.statusText;
    }
    throw new Error(`error.typesafe.requestFailed:${response.status}:${detail}`);
  }

  return (await response.json()) as SystemOneResponse<TAnswers>;
}

const SOURCE_ITEM_CRITERIA: Record<VirtualTryOnSourceItemType, string> = {
  clothing: 'Garments worn on the body such as shirts, tops, blouses, t-shirts, dresses, pants, trousers, jeans, skirts, jackets, coats, suits',
  shoes: 'Footwear such as heels, sneakers, boots, sandals, loafers, flats, slippers',
  bag: 'Bags such as handbags, totes, backpacks, clutches, shoulder bags, crossbody bags',
  accessory: 'Fashion accessories such as hats, caps, jewelry, necklaces, bracelets, earrings, belts, scarves, sunglasses, watches',
};

export interface DetectedSourceItemType {
  type: VirtualTryOnSourceItemType;
  confidence: number;
}
export function fallbackClassifyItemType(text: string): VirtualTryOnSourceItemType {
  const lower = text.toLowerCase();
  if (/giày|dép|cao gót|guốc|boot|boots|sneaker|loafer|sandal|mules|footwear|heels|flats/i.test(lower)) {
    return 'shoes';
  }
  if (/túi|balo|ba lô|ví|clutch|crossbody|handbag|tote|backpack|bag/i.test(lower)) {
    return 'bag';
  }
  if (/kính|nón|mũ|khuyên|vòng|nhẫn|dây chuyền|thắt lưng|dây nịt|nơ|cà vạt|khăn|đồng hồ|belt|scarf|hat|cap|jewelry|necklace|bracelet|earring|sunglasses|watch|accessory/i.test(lower)) {
    return 'accessory';
  }
  return 'clothing';
}


/**
 * Classify multiple Virtual Try-On items in a single speculative fan-out request.
 */
export async function classifyVirtualTryOnItemTypes(
  items: Array<{ id: string | number; text: string }>,
): Promise<Record<string, DetectedSourceItemType>> {
  const validItems = items.filter((item) => item.text.trim().length > 0);
  if (validItems.length === 0) {
    return {};
  }

  const questions: Record<string, ChoiceQuestion<VirtualTryOnSourceItemType>> = {};
  for (let i = 0; i < validItems.length; i++) {
    const key = `item_${validItems[i].id}`;
    questions[key] = {
      type: 'choice',
      instructions: `What category does the fashion item described in \`items[${i}].text\` belong to?`,
      criteria: SOURCE_ITEM_CRITERIA,
    };
  }

  try {
    const result = await callSystemOne<Record<string, ChoiceAnswer<VirtualTryOnSourceItemType>>>({
      state: {
        items: validItems.map((item) => ({ id: item.id, text: item.text })),
      },
      questions,
    });

    const output: Record<string, DetectedSourceItemType> = {};
    for (const item of validItems) {
      const key = `item_${item.id}`;
      const answer = result.answers[key];
      if (answer && answer.type === 'choice') {
        output[String(item.id)] = {
          type: answer.choice,
          confidence: answer.confidence,
        };
      }
    }
    return output;
  } catch {
    // Graceful fallback to regex heuristics when TypeSafe API is 529/503 or offline
    const output: Record<string, DetectedSourceItemType> = {};
    for (const item of validItems) {
      output[String(item.id)] = {
        type: fallbackClassifyItemType(item.text),
        confidence: 0.6,
      };
    }
    return output;
  }
}
