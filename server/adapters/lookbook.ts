import { lookbookSchema, type LookbookPayload } from '../validation.js';

export const feature = 'lookbook';

export function validate(payload: unknown): LookbookPayload {
  return lookbookSchema.parse(payload);
}

export function mapInput(payload: LookbookPayload): Record<string, unknown> {
  return {
    images: payload.images,
    style: payload.style,
  };
}

export function mapOutput(result: Record<string, unknown>): Record<string, unknown> {
  return {
    resultImages: result.resultImages,
    metadata: result.metadata ?? {},
  };
}
