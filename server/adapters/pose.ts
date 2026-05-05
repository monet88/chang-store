import { poseSchema, type PosePayload } from '../validation.js';

export const feature = 'pose';

export function validate(payload: unknown): PosePayload {
  return poseSchema.parse(payload);
}

export function mapInput(payload: PosePayload): Record<string, unknown> {
  return {
    subjectImage: payload.subjectImage,
    poseReferenceImage: payload.poseReferenceImage,
    prompt: payload.prompt,
    negativePrompt: payload.negativePrompt,
    aspectRatio: payload.aspectRatio,
    resolution: payload.resolution,
  };
}

export function mapOutput(result: Record<string, unknown>): Record<string, unknown> {
  return { resultImage: result.resultImage, metadata: result.metadata ?? {} };
}
