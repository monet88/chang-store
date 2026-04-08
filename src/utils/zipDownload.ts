/**
 * ZIP Download Utility
 * 
 * Provides functionality to bundle multiple images into a ZIP archive
 * and trigger browser download. Uses JSZip library.
 */
import JSZip from 'jszip';
import type { ImageFile } from '@/types';
import { buildDownloadFilename, downloadBlob, imageFileToJpegBlob } from '@/utils/imageDownload';

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
 * Every image is converted to JPEG before it is added to the archive.
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
  const zipEntryPrefix = getZipEntryPrefix(zipFilename);

  // Add each image to the ZIP archive
  for (const [index, image] of images.entries()) {
    const filename = buildDownloadFilename(zipEntryPrefix, { index: index + 1 });
    const jpegBlob = await imageFileToJpegBlob(image);
    zip.file(filename, jpegBlob);
  }

  // Generate ZIP blob and trigger download
  const blob = await zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
  
  downloadBlob(blob, `${zipFilename}.zip`);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Derive a stable feature prefix for files inside the ZIP.
 *
 * A caller can keep a friendly archive name like `clothing-transfer-batch.zip`
 * while the images inside become `clothing-transfer-001.jpg`, etc.
 */
function getZipEntryPrefix(zipFilename: string): string {
  const normalizedName = zipFilename.replace(/\.zip$/i, '');
  return normalizedName.endsWith('-batch')
    ? normalizedName.slice(0, -'-batch'.length)
    : normalizedName;
}
