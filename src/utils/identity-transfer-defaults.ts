import faceDefaultUrl from '../../docs/images/FACE.png';
import bodyDefaultUrl from '../../docs/images/BODY.png';
import type { ImageFile } from '../types';
import { compressImage } from './imageUtils';

export interface DefaultIdentityReferences {
  face: ImageFile | null;
  body: ImageFile | null;
}

/**
 * Fetches a bundled default reference and normalizes it through the same
 * canvas compression pipeline used for user uploads. Returns null when the
 * asset cannot be loaded so the uploader simply stays empty.
 */
const loadReference = async (url: string, fileName: string): Promise<ImageFile | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await compressImage(new File([blob], fileName, { type: blob.type }));
  } catch {
    return null;
  }
};

let cachedReferences: Promise<DefaultIdentityReferences> | null = null;

/** Loads the built-in Face/Body references once per page session. */
export const loadDefaultIdentityReferences = (): Promise<DefaultIdentityReferences> => {
  cachedReferences ??= Promise.all([
    loadReference(faceDefaultUrl, 'default-face-angles.png'),
    loadReference(bodyDefaultUrl, 'default-body.png'),
  ]).then(([face, body]) => ({ face, body }));

  return cachedReferences;
};
