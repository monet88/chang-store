/**
 * AI Scan blueprint formatting and source selection (issue #162).
 *
 * `analyzeOutfitBlueprint` returns a free-text textile and garment
 * deconstruction. Every image prompt that consumes it — the E-Com Pack lanes
 * and the AI Scan layer in Virtual Try-On, Lookbook, Identity Transfer, Pose
 * Changer and Background Replacer — splices the same block, so the heading and
 * the whitespace live here instead of in each prompt builder.
 */

import type { GarmentScope, ImageFile } from '../types';

export interface ParsedBlueprint {
  raw: string;
  coreGarments: string;
  textilePhysics: string;
  detectedAccessories: string[];
}

/** Heading the blueprint rides under inside an image prompt. */
export const AI_SCAN_BLOCK_HEADER =
  'AI SCAN — TEXTILE & GARMENT DECONSTRUCTION (observed in the source images)';

/** Source images analyzed per scan; beyond this the report repeats itself. */
const AI_SCAN_MAX_SOURCES = 4;

const isUsableImage = (image: ImageFile | null | undefined): image is ImageFile =>
  Boolean(image?.base64 && image?.mimeType);

/**
 * The scan source set of ONE generation: the feature's own images first, then
 * the shared reference images (the subject / model the issue asks to
 * deconstruct too).
 *
 * One slot of `AI_SCAN_MAX_SOURCES` is reserved for a shared reference, so a
 * full item list can never crowd the subject — or the fabric texture swatch —
 * out of the analysis it appears in. Callers on both sides of the layer — the
 * panel's pre-scan and the generation call — must pass the SAME ImageFile
 * objects: object identity is the scan cache key.
 */
export const aiScanSourceSet = (
  items: Array<ImageFile | null>,
  shared: Array<ImageFile | null> = [],
): ImageFile[] => {
  const sharedSources = shared.filter(isUsableImage).slice(0, 1);
  const itemSlots = AI_SCAN_MAX_SOURCES - sharedSources.length;
  return [...items.filter(isUsableImage).slice(0, itemSlots), ...sharedSources];
};

/**
 * Splice a blueprint into a prompt as a subordinate technical specification.
 * Returns an empty string when there is no blueprint, so a disabled, failed or
 * cancelled scan leaves the base prompt byte-identical.
 */
export const formatAiScanBlock = (blueprint?: string | null): string => {
  const trimmed = blueprint?.trim();
  return trimmed ? `\n\n${AI_SCAN_BLOCK_HEADER}:\n${trimmed}\n` : '';
};

function parseAccessoriesList(text: string): string[] {
  const trimmed = text.trim();
  const negativeRegex = /^(?:none|no accessories(?: detected)?|n\/a|nil|\(none\)|no non-apparel accessories)[\s.]*$/i;
  if (!trimmed || negativeRegex.test(trimmed)) {
    return [];
  }

  const lines = trimmed
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const items: string[] = [];
  for (const line of lines) {
    const cleaned = line.replace(/^[-*•\d.)\s]+/, '').trim();
    if (!cleaned || negativeRegex.test(cleaned)) {
      continue;
    }
    if (lines.length === 1 && cleaned.includes(',') && !line.startsWith('-') && !line.startsWith('*') && !line.startsWith('•')) {
      const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean);
      for (const p of parts) {
        if (!negativeRegex.test(p)) {
          items.push(p);
        }
      }
    } else {
      items.push(cleaned);
    }
  }

  return items;
}

function extractSectionsFromMatches(
  raw: string,
  matches: { core?: RegExpMatchArray | null; textile?: RegExpMatchArray | null; accessories?: RegExpMatchArray | null },
): { coreGarments: string; textilePhysics: string; detectedAccessories: string[] } {
  const sections: { key: 'core' | 'textile' | 'accessories'; start: number; headerLength: number }[] = [];
  if (matches.core && matches.core.index !== undefined) {
    sections.push({ key: 'core', start: matches.core.index, headerLength: matches.core[0].length });
  }
  if (matches.textile && matches.textile.index !== undefined) {
    sections.push({ key: 'textile', start: matches.textile.index, headerLength: matches.textile[0].length });
  }
  if (matches.accessories && matches.accessories.index !== undefined) {
    sections.push({ key: 'accessories', start: matches.accessories.index, headerLength: matches.accessories[0].length });
  }
  sections.sort((a, b) => a.start - b.start);

  let coreGarments = '';
  let textilePhysics = '';
  let detectedAccessories: string[] = [];

  for (let i = 0; i < sections.length; i++) {
    const current = sections[i];
    const next = sections[i + 1];
    const content = raw.slice(current.start + current.headerLength, next ? next.start : raw.length).trim();
    if (current.key === 'core') coreGarments = content;
    else if (current.key === 'textile') textilePhysics = content;
    else if (current.key === 'accessories') detectedAccessories = parseAccessoriesList(content);
  }

  return { coreGarments, textilePhysics, detectedAccessories };
}

/**
 * Parse an AI Scan blueprint into structured sections (Core Garments,
 * Textile Physics, Detected Accessories), falling back gracefully for legacy
 * or unstructured blueprints.
 */
export function parseOutfitBlueprint(blueprint?: string | null): ParsedBlueprint {
  const raw = blueprint?.trim() || '';
  if (!raw) {
    return {
      raw: '',
      coreGarments: '',
      textilePhysics: '',
      detectedAccessories: [],
    };
  }

  const coreMatch = raw.match(/(?:^|[\r\n]+)[ \t]*(?:\*{0,2}\[?\s*(?:1\.\s*)?CORE_GARMENTS\s*\]?\*{0,2})\s*:?/i);
  const textileMatch = raw.match(/(?:^|[\r\n]+)[ \t]*(?:\*{0,2}\[?\s*(?:2\.\s*)?TEXTILE_PHYSICS\s*\]?\*{0,2})\s*:?/i);
  const accessoriesMatch = raw.match(/(?:^|[\r\n]+)[ \t]*(?:\*{0,2}\[?\s*(?:3\.\s*)?DETECTED_ACCESSORIES\s*\]?\*{0,2})\s*:?/i);

  if (coreMatch || textileMatch || accessoriesMatch) {
    const extracted = extractSectionsFromMatches(raw, { core: coreMatch, textile: textileMatch, accessories: accessoriesMatch });
    return { raw, ...extracted };
  }

  const legCoreMatch = raw.match(/(?:^|[\r\n]+)[ \t]*(?:\*{0,2}(?:1\.\s*)?SEPARATE GARMENT COMPONENTS\*{0,2}|(?:\*{0,2}(?:2\.\s*)?TOP GARMENT DETAILS\*{0,2}))\s*:?/i);
  const legTextileMatch = raw.match(/(?:^|[\r\n]+)[ \t]*(?:\*{0,2}(?:4\.\s*)?TEXTILE & FABRIC ENGINEERING\*{0,2}|(?:\*{0,2}WEAVE & MATERIAL\*{0,2}))\s*:?/i);
  const legAccMatch = raw.match(/(?:^|[\r\n]+)[ \t]*(?:\*{0,2}(?:5\.\s*)?ACCESSORIES & LEGWEAR\*{0,2})\s*:?/i);

  if (legCoreMatch || legTextileMatch || legAccMatch) {
    const extracted = extractSectionsFromMatches(raw, { core: legCoreMatch, textile: legTextileMatch, accessories: legAccMatch });
    return {
      raw,
      coreGarments: extracted.coreGarments || raw,
      textilePhysics: extracted.textilePhysics || raw,
      detectedAccessories: extracted.detectedAccessories,
    };
  }

  return {
    raw,
    coreGarments: raw,
    textilePhysics: raw,
    detectedAccessories: [],
  };
}

/**
 * Format the blueprint as a 5-layer natural language brief tailored for Gemini prompts.
 * Returns an empty string when there is no blueprint.
 */
export function formatGeminiBlueprintBlock(
  blueprint?: string | null,
  scope?: GarmentScope,
): string {
  const parsed = parseOutfitBlueprint(blueprint);
  if (!parsed.raw) {
    return '';
  }

  const lines: string[] = [
    `\n\n${AI_SCAN_BLOCK_HEADER}:`,
    'CRITICAL OUTFIT DECONSTRUCTION (5-LAYER TECHNICAL BRIEF):',
  ];

  const scopePrefix = scope ? `[Target Scope: ${scope.toUpperCase()}]\n` : '';
  lines.push(
    `1. GARMENT IDENTIFICATION & SCOPE:\n${scopePrefix}${parsed.coreGarments || 'Standard outfit components.'}`,
  );
  lines.push(
    `2. SILHOUETTE & CUT ARCHITECTURE:\nPreserve exact cuts, silhouette, necklines, sleeves, waistline, and structural tailoring.`,
  );
  lines.push(
    `3. TEXTILE WEAVE & FABRICATION:\n${parsed.textilePhysics || 'Authentic weave, material structure, and fiber texture.'}`,
  );
  lines.push(
    `4. OPTICAL PROPERTIES & DRAPE PHYSICS:\nRender realistic light reflection, sheen, translucency, and natural gravity folds.`,
  );
  const accInstruction =
    parsed.detectedAccessories.length > 0
      ? `Exclude detected accessories: ${parsed.detectedAccessories.join(', ')}.`
      : 'Accessories: None.';
  lines.push(
    `5. MICRO-EDGE DETAILS & ACCESSORIES:\nPreserve micro-edge trims, hemlines, and stitching. ${accInstruction}`,
  );

  return `${lines.join('\n')}\n`;
}

/**
 * Format the blueprint as a structured JSON config object tailored for GPT Image prompts.
 * Returns an empty object when there is no blueprint.
 */
export function formatGptBlueprintConfig(
  blueprint?: string | null,
  scope?: GarmentScope,
): Record<string, unknown> {
  const parsed = parseOutfitBlueprint(blueprint);
  if (!parsed.raw) {
    return {};
  }

  const config: Record<string, unknown> = {
    coreGarments: parsed.coreGarments,
    textilePhysics: parsed.textilePhysics,
    detectedAccessories: parsed.detectedAccessories,
  };

  if (scope) {
    config.garmentScope = scope;
  }

  return config;
}
