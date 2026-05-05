import { z, ZodError } from 'zod';

// ---- Option schemas ----

const virtualTryOnOptionsSchema = z.object({
  model: z.string().optional(),
  aspectRatio: z.string().optional(),
  resolution: z.string().optional(),
}).optional();

const clothingTransferOptionsSchema = z.object({
  model: z.string().optional(),
  preserveBackground: z.boolean().optional(),
}).optional();

// ---- Feature job payload schemas ----

export const virtualTryOnSchema = z.object({
  personImage: z.string().min(1),
  garmentImage: z.string().min(1),
  options: virtualTryOnOptionsSchema,
});

export const clothingTransferSchema = z.object({
  sourceImage: z.string().min(1),
  targetImage: z.string().min(1),
  options: clothingTransferOptionsSchema,
});

export const lookbookSchema = z.object({
  images: z.array(z.string().min(1)).min(1).max(10),
  style: z.string().optional(),
});

export const photoAlbumSchema = z.object({
  images: z.array(z.string().min(1)).min(1).max(20),
  format: z.string().optional(),
  prompt: z.string().optional(),
  aspectRatio: z.string().optional(),
  resolution: z.string().optional(),
});

export const backgroundSchema = z.object({
  subjectImage: z.string().trim().min(1),
  backgroundImage: z.string().trim().min(1).optional(),
  prompt: z.string().trim().min(1),
  negativePrompt: z.string().optional(),
  numberOfImages: z.number().min(1).max(4).optional(),
  aspectRatio: z.string().optional(),
  resolution: z.string().optional(),
}).strict();

export const poseSchema = z.object({
  subjectImage: z.string().trim().min(1),
  poseReferenceImage: z.string().trim().min(1).optional(),
  prompt: z.string().trim().min(1),
  negativePrompt: z.string().optional(),
  aspectRatio: z.string().optional(),
  resolution: z.string().optional(),
  model: z.string().optional(),
}).strict();

export const aiEditorSchema = z.object({
  images: z.array(z.string().trim().min(1)).min(1).max(10),
  prompt: z.string().trim().min(1),
  aspectRatio: z.string().optional(),
  resolution: z.string().optional(),
}).strict();

export const watermarkRemoverSchema = z.object({
  image: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
  model: z.string().optional(),
}).strict();

const interleavedPartSchema = z.object({
  text: z.string().trim().min(1).optional(),
  inlineData: z.object({
    data: z.string().min(1),
    mimeType: z.string().regex(/^image\/[a-zA-Z0-9.+-]+$/),
  }).strict().optional(),
}).strict().refine(
  (part) => part.text !== undefined || part.inlineData !== undefined,
  { message: 'Each part must have either text or inlineData' },
);

export const patternGeneratorSchema = z.object({
  images: z.array(z.string().trim().min(1)).min(1).max(10),
  numImages: z.number().min(1).max(4).optional(),
  interleavedParts: z.array(interleavedPartSchema).optional(),
}).strict();

// ---- Derived union type ----

export type VirtualTryOnPayload = z.infer<typeof virtualTryOnSchema>;
export type ClothingTransferPayload = z.infer<typeof clothingTransferSchema>;
export type LookbookPayload = z.infer<typeof lookbookSchema>;
export type PhotoAlbumPayload = z.infer<typeof photoAlbumSchema>;
export type BackgroundPayload = z.infer<typeof backgroundSchema>;
export type PosePayload = z.infer<typeof poseSchema>;
export type AIEditorPayload = z.infer<typeof aiEditorSchema>;
export type WatermarkRemoverPayload = z.infer<typeof watermarkRemoverSchema>;
export type PatternGeneratorPayload = z.infer<typeof patternGeneratorSchema>;

export type FeatureJobPayload =
  | VirtualTryOnPayload
  | ClothingTransferPayload
  | LookbookPayload
  | PhotoAlbumPayload
  | BackgroundPayload
  | PosePayload
  | AIEditorPayload
  | WatermarkRemoverPayload
  | PatternGeneratorPayload;

// ---- Validation router ----

const featureSchemas: Record<string, z.ZodType<unknown>> = {
  'try-on': virtualTryOnSchema,
  'clothing-transfer': clothingTransferSchema,
  'lookbook': lookbookSchema,
  'photo-album': photoAlbumSchema,
  background: backgroundSchema,
  pose: poseSchema,
  'ai-editor': aiEditorSchema,
  'watermark-remover': watermarkRemoverSchema,
  'pattern-generator': patternGeneratorSchema,
};

export function validateJobPayload(feature: string, data: unknown): FeatureJobPayload {
  if (!Object.prototype.hasOwnProperty.call(featureSchemas, feature)) {
    throw new Error(`Unknown feature: ${feature}`);
  }

  return featureSchemas[feature].parse(data) as FeatureJobPayload;
}

// ---- Error formatter ----

export function formatZodErrors(error: ZodError): Record<string, string> {
  const formatted: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    formatted[path] = issue.message;
  }
  return formatted;
}
