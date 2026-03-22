import { ImageFile } from '../types';

/**
 * Stable content key for matching an uploaded image back to an existing
 * batch/session item when the uploader returns a full replacement array.
 */
export const getImageSessionKey = (image: ImageFile): string =>
  `${image.mimeType}:${image.base64}`;

/**
 * Rebuild a session array from the uploader's next image array while
 * preserving existing items when the same image still exists.
 *
 * This supports duplicate images by keeping a queue per image key rather than
 * a single map entry.
 */
export function remapImageBatchItems<T>(
  nextImages: ImageFile[],
  previousItems: T[],
  getImage: (item: T) => ImageFile,
  createItem: (image: ImageFile) => T,
): T[] {
  const pools = new Map<string, T[]>();

  previousItems.forEach((item) => {
    const key = getImageSessionKey(getImage(item));
    const pool = pools.get(key) ?? [];
    pool.push(item);
    pools.set(key, pool);
  });

  return nextImages.map((image) => {
    const key = getImageSessionKey(image);
    const pool = pools.get(key);

    if (pool && pool.length > 0) {
      return pool.shift() as T;
    }

    return createItem(image);
  });
}
