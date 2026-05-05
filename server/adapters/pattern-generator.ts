import { patternGeneratorSchema, type PatternGeneratorPayload } from '../validation.js';

export const feature = 'pattern-generator';

export function validate(payload: unknown): PatternGeneratorPayload {
  return patternGeneratorSchema.parse(payload);
}

export function mapInput(payload: PatternGeneratorPayload): Record<string, unknown> {
  return {
    images: payload.images,
    numImages: payload.numImages,
    interleavedParts: payload.interleavedParts,
  };
}

export function mapOutput(result: Record<string, unknown>): Record<string, unknown> {
  return { resultImages: result.resultImages, metadata: result.metadata ?? {} };
}
