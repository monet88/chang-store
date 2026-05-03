import { photoAlbumSchema, type PhotoAlbumPayload } from '../validation.js';

export const feature = 'photo-album';

export function validate(payload: unknown): PhotoAlbumPayload {
  return photoAlbumSchema.parse(payload);
}

export function mapInput(payload: PhotoAlbumPayload): Record<string, unknown> {
  return {
    images: payload.images,
    format: payload.format,
    prompt: payload.prompt,
    aspectRatio: payload.aspectRatio,
    resolution: payload.resolution,
  };
}

export function mapOutput(result: Record<string, unknown>): Record<string, unknown> {
  return {
    resultImages: result.resultImages,
    metadata: result.metadata ?? {},
  };
}
