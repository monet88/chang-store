/**
 * ZIP Download Utility
 * 
 * Provides functionality to bundle multiple images into a ZIP archive
 * and trigger browser download. Uses JSZip library.
 */
import JSZip from 'jszip';
import type { ImageFile } from '@/types';

// ============================================
// MAIN EXPORT
// ============================================

/**
 * Download multiple images as a ZIP file
 * 
 * @param images - Array of ImageFile objects to include in ZIP
 * @param zipFilename - Name for the ZIP file (without .zip extension)
 * @returns Promise that resolves when download is triggered
 * 
 * @example
 * ```ts
 * await downloadImagesAsZip(processedImages, 'watermark-removed');
 * // Downloads: watermark-removed.zip
 * ```
 */
export async function downloadImagesAsZip(
  images: ImageFile[],
  zipFilename: string = 'images'
): Promise<void> {
  if (images.length === 0) {
    console.warn('downloadImagesAsZip: No images to download');
    return;
  }

  const zip = new JSZip();

  // Add each image to the ZIP archive
  images.forEach((image, index) => {
    // Determine file extension from mimeType
    const extension = getExtensionFromMimeType(image.mimeType);
    const filename = `image-${String(index + 1).padStart(3, '0')}.${extension}`;
    
    // Add base64 data to ZIP
    zip.file(filename, image.base64, { base64: true });
  });

  // Generate ZIP blob and trigger download
  const blob = await zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
  
  triggerBlobDownload(blob, `${zipFilename}.zip`);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract file extension from MIME type
 * 
 * @param mimeType - MIME type string (e.g., 'image/png')
 * @returns File extension without dot (e.g., 'png')
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
  };
  
  return mimeToExt[mimeType.toLowerCase()] || 'png';
}

/**
 * Trigger browser download for a Blob
 * 
 * @param blob - Blob to download
 * @param filename - Filename for download
 */
function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  
  // Append, click, remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up object URL
  URL.revokeObjectURL(url);
}
