import type { ImageFile } from '@/types';

interface DownloadFilenameOptions {
  index?: number;
  randomToken?: string;
}

interface DownloadImageOptions extends DownloadFilenameOptions {
  baseName?: string;
  prefix?: string;
  quality?: number;
}

const DEFAULT_DOWNLOAD_PREFIX = 'generated-image';
const DEFAULT_JPEG_QUALITY = 0.92;

function sanitizeSegment(value: string): string {
  const normalized = value
    .trim()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return normalized || DEFAULT_DOWNLOAD_PREFIX;
}

function createRandomToken(): string {
  return Math.random().toString(36).slice(2, 10);
}

function resolveBaseName(options: DownloadImageOptions): string {
  if (options.baseName) {
    return sanitizeSegment(options.baseName);
  }

  return buildDownloadFilename(options.prefix ?? DEFAULT_DOWNLOAD_PREFIX, options).replace(/\.jpg$/i, '');
}

function loadImageElement(image: ImageFile): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for JPEG conversion.'));
    img.src = `data:${image.mimeType};base64,${image.base64}`;
  });
}

export function buildDownloadFilename(
  prefix: string,
  options: DownloadFilenameOptions = {},
): string {
  const normalizedPrefix = sanitizeSegment(prefix);

  if (options.index !== undefined) {
    return `${normalizedPrefix}-${String(options.index).padStart(3, '0')}.jpg`;
  }

  const randomToken = sanitizeSegment(options.randomToken ?? createRandomToken());
  return `${normalizedPrefix}-${randomToken}.jpg`;
}

export async function imageFileToJpegBlob(
  image: ImageFile,
  quality: number = DEFAULT_JPEG_QUALITY,
): Promise<Blob> {
  const img = await loadImageElement(image);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is unavailable.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(img, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to convert image to JPEG.'));
          return;
        }

        resolve(blob);
      },
      'image/jpeg',
      quality,
    );
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadImageAsJpeg(
  image: ImageFile,
  options: DownloadImageOptions = {},
): Promise<void> {
  const blob = await imageFileToJpegBlob(image, options.quality);
  const filename = `${resolveBaseName(options)}.jpg`;
  downloadBlob(blob, filename);
}
