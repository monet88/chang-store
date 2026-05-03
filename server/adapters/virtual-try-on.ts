import { virtualTryOnSchema, type VirtualTryOnPayload } from '../validation.js';

export const feature = 'try-on';

export function validate(payload: unknown): VirtualTryOnPayload {
  return virtualTryOnSchema.parse(payload);
}

export function mapInput(payload: VirtualTryOnPayload): Record<string, unknown> {
  return {
    personImage: payload.personImage,
    garmentImage: payload.garmentImage,
    options: payload.options ?? {},
  };
}

export function mapOutput(result: Record<string, unknown>): Record<string, unknown> {
  return {
    resultImage: result.resultImage,
    metadata: result.metadata ?? {},
  };
}
