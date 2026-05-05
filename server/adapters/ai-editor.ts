import { aiEditorSchema, type AIEditorPayload } from '../validation.js';

export const feature = 'ai-editor';

export function validate(payload: unknown): AIEditorPayload {
  return aiEditorSchema.parse(payload);
}

export function mapInput(payload: AIEditorPayload): Record<string, unknown> {
  return {
    images: payload.images,
    prompt: payload.prompt,
    aspectRatio: payload.aspectRatio,
    resolution: payload.resolution,
  };
}

export function mapOutput(result: Record<string, unknown>): Record<string, unknown> {
  return { resultImages: result.resultImages, metadata: result.metadata ?? {} };
}
