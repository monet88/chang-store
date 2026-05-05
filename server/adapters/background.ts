import { backgroundSchema, type BackgroundPayload } from '../validation.js';

export const feature = 'background';

export function validate(payload: unknown): BackgroundPayload {
  return backgroundSchema.parse(payload);
}

export function mapInput(payload: BackgroundPayload): Record<string, unknown> {
  return {
    subjectImage: payload.subjectImage,
    backgroundImage: payload.backgroundImage,
    prompt: payload.prompt,
    negativePrompt: payload.negativePrompt,
    numberOfImages: payload.numberOfImages,
    aspectRatio: payload.aspectRatio,
    resolution: payload.resolution,
  };
}

export function mapOutput(result: Record<string, unknown>): Record<string, unknown> {
  return { resultImages: result.resultImages, metadata: result.metadata ?? {} };
}
