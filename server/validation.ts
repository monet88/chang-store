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
  images: z.array(z.string()).min(1).max(10),
  style: z.string().optional(),
});

export const photoAlbumSchema = z.object({
  images: z.array(z.string()).min(1).max(20),
  format: z.string().optional(),
});

// ---- Derived union type ----

export type VirtualTryOnPayload = z.infer<typeof virtualTryOnSchema>;
export type ClothingTransferPayload = z.infer<typeof clothingTransferSchema>;
export type LookbookPayload = z.infer<typeof lookbookSchema>;
export type PhotoAlbumPayload = z.infer<typeof photoAlbumSchema>;

export type FeatureJobPayload =
  | VirtualTryOnPayload
  | ClothingTransferPayload
  | LookbookPayload
  | PhotoAlbumPayload;

// ---- Validation router ----

const featureSchemas: Record<string, z.ZodType<unknown>> = {
  'try-on': virtualTryOnSchema,
  'clothing-transfer': clothingTransferSchema,
  'lookbook': lookbookSchema,
  'photo-album': photoAlbumSchema,
};

export function validateJobPayload(feature: string, data: unknown): FeatureJobPayload {
  const schema = featureSchemas[feature];
  if (!schema) {
    throw new Error(`Unknown feature: ${feature}`);
  }
  return schema.parse(data) as FeatureJobPayload;
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
