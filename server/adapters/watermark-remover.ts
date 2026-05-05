import { watermarkRemoverSchema, type WatermarkRemoverPayload } from '../validation.js';

export const feature = 'watermark-remover';

export function validate(payload: unknown): WatermarkRemoverPayload {
  return watermarkRemoverSchema.parse(payload);
}

export function mapInput(payload: WatermarkRemoverPayload): Record<string, unknown> {
  return {
    image: payload.image,
    prompt: payload.prompt,
    model: payload.model,
  };
}

export function mapOutput(result: Record<string, unknown>): Record<string, unknown> {
  return { resultImage: result.resultImage, metadata: result.metadata ?? {} };
}
