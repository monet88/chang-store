/**
 * Image Hosting Service
 * Supports: ImgBB
 */

interface UploadResult {
  url: string;
  deleteUrl?: string;
  thumbnailUrl?: string;
}

// ============================================
// 1. ImgBB Upload
// ============================================

/**
 * Upload image to ImgBB (Max: 32MB)
 * @param base64 - Base64 encoded image
 * @param mimeType - Image MIME type
 * @returns Hosted image URL
 */
export async function uploadToImgBB(
  base64: string, 
  mimeType: string,
  apiKeyOverride: string | null
): Promise<string> {
  const apiKey = apiKeyOverride || '50ef5c99fef751406fc092c188e31310';
  
  // Remove data URI prefix if exists
  const base64Data = base64.includes('base64,') 
    ? base64.split('base64,')[1] 
    : base64;

  const formData = new FormData();
  formData.append('key', apiKey);
  formData.append('image', base64Data);

  try {
    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      const errorMsg = result.error?.message || 'Upload failed';
      throw new Error(errorMsg);
    }

    console.log('[ImgBB] Upload successful:', result.data.url);
    return result.data.url;
    
  } catch (error) {
    console.error('[ImgBB] Upload error:', error);
    throw new Error(`ImgBB upload failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================
// 2. Smart Upload (now just uses ImgBB)
// ============================================

/**
 * Smart upload: Uses ImgBB as the primary service.
 * 
 * @param base64 - Base64 encoded image
 * @param mimeType - Image MIME type
 * @param onProgress - Optional callback for progress updates
 * @returns Hosted image URL from first successful service
 */
export async function uploadImageSmart(
  base64: string, 
  mimeType: string,
  apiKey: string | null,
  onProgress?: (message: string) => void
): Promise<string> {
  try {
    onProgress?.(`📤 Uploading to ImgBB...`);
    const url = await uploadToImgBB(base64, mimeType, apiKey);
    onProgress?.(`✅ Uploaded to ImgBB`);
    console.log(`[ImageHosting] Successfully uploaded to ImgBB:`, url);
    return url;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[ImageHosting] All services failed:', errorMsg);
    throw new Error(`All image hosting services failed:\nImgBB: ${errorMsg}`);
  }
}

// ============================================
// 3. Batch Upload (Multiple Images)
// ============================================
import { ImageFile } from './types';
/**
 * Upload multiple images in parallel
 * 
 * @param images - Array of images to upload
 * @param onProgress - Optional callback for progress updates
 * @returns Array of hosted image URLs
 */
export async function uploadMultipleImages(
  images: ImageFile[],
  apiKey: string | null,
  onProgress?: (index: number, total: number, message: string) => void
): Promise<{ success: {url: string, originalImage: ImageFile}[], failures: {error: string, originalImage: ImageFile}[] }> {
    const results = await Promise.allSettled(
        images.map(async (img, index) => {
            onProgress?.(index + 1, images.length, `Uploading image ${index + 1}/${images.length}...`);
            const url = await uploadImageSmart(
                img.base64,
                img.mimeType,
                apiKey,
                (msg) => onProgress?.(index + 1, images.length, msg)
            );
            return { url, originalImage: img };
        })
    );

    const success: {url: string, originalImage: ImageFile}[] = [];
    const failures: {error: string, originalImage: ImageFile}[] = [];

    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            success.push(result.value);
            onProgress?.(index + 1, images.length, `✅ Image ${index + 1} uploaded`);
        } else {
            const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
            failures.push({ error: errorMsg, originalImage: images[index] });
            onProgress?.(index + 1, images.length, `❌ Image ${index + 1} failed`);
        }
    });

    return { success, failures };
}