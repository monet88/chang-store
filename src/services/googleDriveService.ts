/**
 * Google Drive Service
 *
 * Provides file operations for gallery sync using Google Drive API v3.
 * All files are stored in a dedicated app folder (Chang-Store-Gallery).
 *
 * @see https://developers.google.com/drive/api/v3/reference
 */

// ============================================================================
// Types
// ============================================================================

/** Image file metadata stored in Google Drive */
export interface DriveImageFile {
  /** Google Drive file ID */
  id: string;
  /** File name (format: {timestamp}_{feature}.{ext}) */
  name: string;
  /** Base64-encoded image data */
  base64: string;
  /** MIME type (e.g., image/png, image/jpeg) */
  mimeType: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Feature that generated this image */
  feature: string;
}

/** Metadata for Drive file listing (without content) */
interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  appProperties?: {
    feature?: string;
  };
}

/** Google Drive API response for file list */
interface DriveListResponse {
  files: DriveFileMetadata[];
  nextPageToken?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Base URL for Google Drive API v3 */
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

/** Base URL for Drive file uploads */
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

/** App folder name in Google Drive */
const APP_FOLDER_NAME = 'Chang-Store-Gallery';

/** MIME type for Google Drive folder */
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

/** Max concurrent downloads for rate limiting */
const MAX_CONCURRENT_DOWNLOADS = 5;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Makes an authenticated request to Google Drive API
 * @param url - API endpoint URL
 * @param accessToken - OAuth access token
 * @param options - Fetch options
 */
async function driveRequest<T>(
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Drive API error (${response.status}): ${errorText}`);
  }

  // Handle empty responses (e.g., DELETE)
  const text = await response.text();
  if (!text) return {} as T;

  return JSON.parse(text) as T;
}

/**
 * Extracts feature name from filename
 * Expected format: {timestamp}_{feature}.{ext}
 */
function extractFeatureFromName(name: string): string {
  const match = name.match(/^\d+_(.+)\.\w+$/);
  return match ? match[1] : 'unknown';
}

/**
 * Generates a simple hash from base64 content for deduplication
 * Uses size + first/last 32 bytes as signature (fast, collision-resistant enough)
 */
function generateContentHash(base64: string): string {
  // Use base64 string length and character samples as hash
  // This is fast and sufficient for deduplication
  const len = base64.length;
  const head = base64.slice(0, 32);
  const tail = base64.slice(-32);
  return `${len}:${head}:${tail}`;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Gets or creates the app folder in Google Drive
 * @param accessToken - OAuth access token
 * @returns Folder ID
 */
export async function getOrCreateAppFolder(accessToken: string): Promise<string> {
  // Search for existing folder
  const searchQuery = `name='${APP_FOLDER_NAME}' and mimeType='${FOLDER_MIME_TYPE}' and trashed=false`;
  const searchUrl = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name)`;

  const searchResult = await driveRequest<DriveListResponse>(searchUrl, accessToken);

  if (searchResult.files && searchResult.files.length > 0) {
    return searchResult.files[0].id;
  }

  // Create new folder
  const createUrl = `${DRIVE_API_BASE}/files`;
  const folderMetadata = {
    name: APP_FOLDER_NAME,
    mimeType: FOLDER_MIME_TYPE,
  };

  const createResult = await driveRequest<{ id: string }>(createUrl, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(folderMetadata),
  });

  return createResult.id;
}

/**
 * Uploads an image to Google Drive
 * @param accessToken - OAuth access token
 * @param folderId - Parent folder ID
 * @param base64 - Base64-encoded image data
 * @param mimeType - Image MIME type
 * @param feature - Feature that generated the image
 * @returns Created file ID
 */
export async function uploadImage(
  accessToken: string,
  folderId: string,
  base64: string,
  mimeType: string,
  feature: string
): Promise<string> {
  // Generate filename: {timestamp}_{feature}.{ext}
  const timestamp = Date.now();
  const ext = mimeType.split('/')[1] || 'png';
  const fileName = `${timestamp}_${feature}.${ext}`;

  // Convert base64 to blob
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });

  // Generate content hash for deduplication
  const contentHash = generateContentHash(base64);

  // Build multipart request
  const metadata = {
    name: fileName,
    parents: [folderId],
    appProperties: { feature, contentHash },
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  // Create multipart body
  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;

  // Read blob as array buffer for binary part
  const arrayBuffer = await blob.arrayBuffer();
  const binaryPart = new Uint8Array(arrayBuffer);

  // Combine parts - use raw binary, NOT base64 string
  const encoder = new TextEncoder();
  const metadataBytes = encoder.encode(metadataPart);
  const binaryHeaderBytes = encoder.encode(`${delimiter}Content-Type: ${mimeType}\r\n\r\n`);
  const closeBytes = encoder.encode(closeDelimiter);

  const bodyLength = metadataBytes.length + binaryHeaderBytes.length + binaryPart.length + closeBytes.length;
  const body = new Uint8Array(bodyLength);
  let offset = 0;

  body.set(metadataBytes, offset);
  offset += metadataBytes.length;
  body.set(binaryHeaderBytes, offset);
  offset += binaryHeaderBytes.length;
  body.set(binaryPart, offset);
  offset += binaryPart.length;
  body.set(closeBytes, offset);

  // Upload
  const uploadUrl = `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return result.id;
}

/**
 * Lists all image files in the app folder
 * @param accessToken - OAuth access token
 * @param folderId - App folder ID
 * @returns Array of file metadata (without content)
 */
export async function listImageFiles(
  accessToken: string,
  folderId: string
): Promise<DriveFileMetadata[]> {
  const allFiles: DriveFileMetadata[] = [];
  let pageToken: string | undefined;

  do {
    const query = `'${folderId}' in parents and trashed=false and (mimeType='image/png' or mimeType='image/jpeg' or mimeType='image/webp')`;
    let url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,createdTime,appProperties),nextPageToken&orderBy=createdTime desc`;

    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }

    const result = await driveRequest<DriveListResponse>(url, accessToken);
    allFiles.push(...result.files);
    pageToken = result.nextPageToken;
  } while (pageToken);

  return allFiles;
}

/**
 * Downloads a single image from Google Drive
 * @param accessToken - OAuth access token
 * @param fileId - File ID to download
 * @returns DriveImageFile with base64 content
 */
export async function downloadImage(
  accessToken: string,
  fileId: string
): Promise<DriveImageFile> {
  // Get file metadata
  const metadataUrl = `${DRIVE_API_BASE}/files/${fileId}?fields=id,name,mimeType,createdTime,appProperties`;
  const metadata = await driveRequest<DriveFileMetadata>(metadataUrl, accessToken);

  // Download file content
  const contentUrl = `${DRIVE_API_BASE}/files/${fileId}?alt=media`;
  const response = await fetch(contentUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }

  // Convert to base64 using chunked approach for better performance
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Process in chunks to avoid call stack limits on large images
  const CHUNK_SIZE = 0x8000; // 32KB chunks
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  const base64 = btoa(binary);

  return {
    id: metadata.id,
    name: metadata.name,
    base64,
    mimeType: metadata.mimeType,
    createdAt: new Date(metadata.createdTime),
    feature: metadata.appProperties?.feature || extractFeatureFromName(metadata.name),
  };
}

/**
 * Downloads all images with rate limiting
 * @param accessToken - OAuth access token
 * @param fileIds - Array of file IDs to download
 * @param onProgress - Optional callback for progress updates
 * @returns Array of downloaded images
 */
export async function downloadAllImages(
  accessToken: string,
  fileIds: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<DriveImageFile[]> {
  const results: DriveImageFile[] = [];
  let completed = 0;

  // Process in batches to respect rate limits
  for (let i = 0; i < fileIds.length; i += MAX_CONCURRENT_DOWNLOADS) {
    const batch = fileIds.slice(i, i + MAX_CONCURRENT_DOWNLOADS);

    const batchResults = await Promise.all(
      batch.map(async (fileId) => {
        try {
          const image = await downloadImage(accessToken, fileId);
          completed++;
          onProgress?.(completed, fileIds.length);
          return image;
        } catch (err) {
          console.error(`[GoogleDrive] Failed to download ${fileId}:`, err);
          completed++;
          onProgress?.(completed, fileIds.length);
          return null;
        }
      })
    );

    results.push(...batchResults.filter((r): r is DriveImageFile => r !== null));
  }

  return results;
}

/**
 * Deletes an image from Google Drive
 * @param accessToken - OAuth access token
 * @param fileId - File ID to delete
 */
export async function deleteImage(
  accessToken: string,
  fileId: string
): Promise<void> {
  const url = `${DRIVE_API_BASE}/files/${fileId}`;

  await driveRequest<void>(url, accessToken, {
    method: 'DELETE',
  });
}

/**
 * Finds an image by its base64 content (for deduplication)
 * Uses content hash stored in appProperties for fast lookup
 * @param accessToken - OAuth access token
 * @param folderId - App folder ID
 * @param base64 - Base64 content to search for
 * @returns File ID if found, null otherwise
 */
export async function findImageByBase64(
  accessToken: string,
  folderId: string,
  base64: string
): Promise<string | null> {
  const contentHash = generateContentHash(base64);

  // Query files with matching hash in appProperties
  const query = `'${folderId}' in parents and trashed=false and appProperties has { key='contentHash' and value='${contentHash}' }`;
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id)`;

  try {
    const result = await driveRequest<DriveListResponse>(url, accessToken);
    if (result.files && result.files.length > 0) {
      return result.files[0].id;
    }
  } catch {
    // If query fails, fallback won't work anyway
    console.warn('[GoogleDrive] Hash-based dedup query failed');
  }

  return null;
}
