/**
 * upscaleAnalysisService — Gemini-powered fashion photograph analysis
 * and preservation-first upscale prompt generation.
 *
 * Phase 3 service: Gemini-only facade.
 *   - `analyzeImage`: sends image to Gemini with structured JSON schema,
 *     returns a typed `UpscaleAnalysisReport`.
 *   - `generateUpscalePrompt`: pure function — builds a preservation-first
 *     master prompt from the analysis report (no API call).
 */

import { Part, Type } from '@google/genai';
import { getGeminiClient } from './apiClient';
import type {
  ImageFile,
  UpscaleAnalysisReport,
  AnalysisGarmentItem,
  AnalysisMaterialItem,
  AnalysisBackground,
  AnalysisLighting,
  AnalysisFraming,
  AnalysisPose,
  PreservationRiskItem,
} from '../types';

// ============================================================================
// Gemini JSON schema definition (responseSchema)
// ============================================================================

/** Schema passed to Gemini's `responseMimeType: 'application/json'` config. */
const ANALYSIS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    garments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          type: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ['name', 'type', 'description'],
      },
    },
    materials: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          garment: { type: Type.STRING },
          fabric: { type: Type.STRING },
          texture: { type: Type.STRING },
          weight: { type: Type.STRING },
          sheen: { type: Type.STRING },
        },
        required: ['garment', 'fabric', 'texture', 'weight', 'sheen'],
      },
    },
    background: {
      type: Type.OBJECT,
      properties: {
        environment: { type: Type.STRING },
        surfaces: { type: Type.STRING },
        depth: { type: Type.STRING },
        description: { type: Type.STRING },
      },
      required: ['environment', 'surfaces', 'depth', 'description'],
    },
    lighting: {
      type: Type.OBJECT,
      properties: {
        direction: { type: Type.STRING },
        quality: { type: Type.STRING },
        colorTemperature: { type: Type.STRING },
        shadows: { type: Type.STRING },
      },
      required: ['direction', 'quality', 'colorTemperature', 'shadows'],
    },
    framing: {
      type: Type.OBJECT,
      properties: {
        shotType: { type: Type.STRING },
        angle: { type: Type.STRING },
        composition: { type: Type.STRING },
      },
      required: ['shotType', 'angle', 'composition'],
    },
    pose: {
      type: Type.OBJECT,
      properties: {
        bodyPosition: { type: Type.STRING },
        gesture: { type: Type.STRING },
        expression: { type: Type.STRING },
        movement: { type: Type.STRING },
      },
      required: ['bodyPosition', 'gesture', 'expression', 'movement'],
    },
    preservationRisks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          area: { type: Type.STRING },
          riskLevel: { type: Type.STRING },
          detail: { type: Type.STRING },
        },
        required: ['area', 'riskLevel', 'detail'],
      },
    },
  },
  required: [
    'garments',
    'materials',
    'background',
    'lighting',
    'framing',
    'pose',
    'preservationRisks',
  ],
};

// ============================================================================
// Analysis prompt
// ============================================================================

const ANALYSIS_SYSTEM_PROMPT = `You are a fashion photography analyst specializing in image upscaling preparation.
Analyze the provided photograph and return a structured JSON report covering:

1. **Garments**: Identify every visible garment — name, type category, and detailed description of cut/construction/styling.
2. **Materials**: For each garment, describe the fabric, texture, perceived weight, and surface sheen.
3. **Background**: Describe the environment, surfaces, depth, and overall background.
4. **Lighting**: Key light direction, quality (soft/hard), color temperature, and shadow behavior.
5. **Framing**: Shot type (full-body, half-body, close-up), camera angle, and composition approach.
6. **Pose**: Body position, gesture, expression, and movement quality.
7. **Preservation Risks**: List areas that will be most challenging to preserve during upscaling — areas with fine detail, delicate textures, intricate patterns, or thin features. Assign each a riskLevel of "high", "medium", or "low".

Focus on details that matter for faithful image upscaling — texture fidelity, fine pattern reproduction, edge sharpness, and detail preservation.
Be concise but thorough. Every field must be filled.`;

// ============================================================================
// analyzeImage — calls Gemini with structured output
// ============================================================================

/**
 * Sends a fashion photograph to Gemini and returns a structured analysis report.
 *
 * @param image   The source image (base64 + mimeType)
 * @param model   Gemini model to use (default: gemini-2.5-flash)
 * @returns       Parsed `UpscaleAnalysisReport`
 * @throws        On Gemini safety blocks, empty responses, or JSON parse failures
 */
export async function analyzeImage(
  image: ImageFile,
  model: string = 'gemini-2.5-flash',
): Promise<UpscaleAnalysisReport> {
  const ai = getGeminiClient();

  const imagePart: Part = {
    inlineData: {
      data: image.base64,
      mimeType: image.mimeType,
    },
  };
  const textPart: Part = { text: 'Analyze this fashion photograph.' };

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [imagePart, textPart] },
    config: {
      systemInstruction: ANALYSIS_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: ANALYSIS_RESPONSE_SCHEMA,
    },
  });

  // ---- Safety & empty checks (mirrors existing gemini/text.ts pattern) ----
  if (response.promptFeedback?.blockReason) {
    console.error('[UpscaleAnalysis] Blocked:', response.promptFeedback);
    throw new Error('error.api.safetyBlock');
  }

  if (!response.candidates || response.candidates.length === 0) {
    console.error('[UpscaleAnalysis] No candidates:', response);
    throw new Error('error.api.safetyBlock');
  }

  const candidate = response.candidates[0];
  if (
    candidate.finishReason === 'SAFETY' ||
    candidate.finishReason === 'RECITATION' ||
    candidate.finishReason === 'OTHER'
  ) {
    console.error('[UpscaleAnalysis] Blocked by finishReason:', candidate.finishReason);
    throw new Error('error.api.safetyBlock');
  }

  const text = response.text;
  if (!text) {
    console.error('[UpscaleAnalysis] Empty response text:', response);
    throw new Error('error.api.noText');
  }

  // ---- Parse & validate ----
  try {
    const parsed = JSON.parse(text) as UpscaleAnalysisReport;

    // Normalize riskLevel values to the expected union
    if (parsed.preservationRisks) {
      parsed.preservationRisks = parsed.preservationRisks.map((r) => ({
        ...r,
        riskLevel: normalizeRiskLevel(r.riskLevel),
      }));
    }

    return parsed;
  } catch (parseError) {
    console.error('[UpscaleAnalysis] JSON parse failed:', parseError, 'Raw:', text);
    throw new Error('error.api.geminiFailed:JSON parse failed');
  }
}

// ============================================================================
// generateUpscalePrompt — pure function, no API call
// ============================================================================

/**
 * Builds a preservation-first upscale prompt from the analysis report.
 * The prompt focuses on faithfully reproducing every detail rather than
 * creatively restyling the image.
 *
 * @param report The analysis report from `analyzeImage`
 * @returns A multi-paragraph master prompt string ready for upscale models
 */
export function generateUpscalePrompt(report: UpscaleAnalysisReport): string {
  const sections: string[] = [];

  // ---- Overall instruction ----
  sections.push(
    'Upscale this fashion photograph to the highest resolution while faithfully preserving every detail described below. Do not alter composition, style, or content.',
  );

  // ---- Garments ----
  if (report.garments.length > 0) {
    const garmentLines = report.garments
      .map((g: AnalysisGarmentItem) => `- ${g.name} (${g.type}): ${g.description}`)
      .join('\n');
    sections.push(`GARMENTS:\n${garmentLines}`);
  }

  // ---- Materials ----
  if (report.materials.length > 0) {
    const materialLines = report.materials
      .map(
        (m: AnalysisMaterialItem) =>
          `- ${m.garment}: ${m.fabric}, ${m.texture} texture, ${m.weight} weight, ${m.sheen} sheen`,
      )
      .join('\n');
    sections.push(`MATERIALS (preserve fabric texture fidelity):\n${materialLines}`);
  }

  // ---- Background ----
  const bg: AnalysisBackground = report.background;
  sections.push(
    `BACKGROUND: ${bg.environment}. Surfaces: ${bg.surfaces}. Depth: ${bg.depth}. ${bg.description}`,
  );

  // ---- Lighting ----
  const lt: AnalysisLighting = report.lighting;
  sections.push(
    `LIGHTING: ${lt.direction} direction, ${lt.quality} quality, ${lt.colorTemperature} temperature. Shadows: ${lt.shadows}. Preserve exact lighting mood.`,
  );

  // ---- Framing ----
  const fr: AnalysisFraming = report.framing;
  sections.push(`FRAMING: ${fr.shotType}, ${fr.angle} angle, ${fr.composition} composition.`);

  // ---- Pose ----
  const po: AnalysisPose = report.pose;
  sections.push(
    `POSE: ${po.bodyPosition}. Gesture: ${po.gesture}. Expression: ${po.expression}. Movement: ${po.movement}.`,
  );

  // ---- Preservation risks → special attention directives ----
  if (report.preservationRisks.length > 0) {
    const riskLines = report.preservationRisks
      .map(
        (r: PreservationRiskItem) => `- [${r.riskLevel.toUpperCase()}] ${r.area}: ${r.detail}`,
      )
      .join('\n');
    sections.push(
      `CRITICAL PRESERVATION AREAS (pay special attention to these during upscaling):\n${riskLines}`,
    );
  }

  // ---- Closing directive ----
  sections.push(
    'Maintain sharpness on all edges. Reproduce fabric weave and texture at pixel level. Avoid hallucinating new details — only enhance what exists.',
  );

  return sections.join('\n\n');
}

// ============================================================================
// Helpers
// ============================================================================

/** Normalize a risk level string to the expected union type. */
function normalizeRiskLevel(level: string): 'high' | 'medium' | 'low' {
  const normalized = level.toLowerCase().trim();
  if (normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  return 'low';
}
