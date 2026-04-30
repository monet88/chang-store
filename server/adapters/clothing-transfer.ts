import { clothingTransferSchema, type ClothingTransferPayload } from '../validation';

export const feature = 'clothing-transfer';

export function validate(payload: unknown): ClothingTransferPayload {
  return clothingTransferSchema.parse(payload);
}

export function mapInput(payload: ClothingTransferPayload): Record<string, unknown> {
  return {
    sourceImage: payload.sourceImage,
    targetImage: payload.targetImage,
    options: payload.options ?? {},
  };
}

export function mapOutput(result: Record<string, unknown>): Record<string, unknown> {
  return {
    resultImage: result.resultImage,
    metadata: result.metadata ?? {},
  };
}
