import { put, del, list } from '@vercel/blob';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';

function getToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN environment variable is not set');
  }
  return token;
}

export class BlobStorage {
  /**
   * Generate a client upload token for client-side uploads (>4.5MB files).
   * The returned token is passed to the `@vercel/blob` client SDK on the browser.
   * Client uploads bypass the 4.5MB Vercel Function body size limit.
   */
  async generateUploadUrl(
    path: string,
    contentType: string,
  ): Promise<{ url: string; path: string }> {
    const token = getToken();
    const clientToken = await generateClientTokenFromReadWriteToken({
      pathname: path,
      token,
      allowedContentTypes: [contentType],
      maximumSizeInBytes: 5 * 1024 ** 4, // 5 TB (SDK max)
    });
    return { url: clientToken, path };
  }

  /**
   * Store a file server-side.
   *
   * LIMIT: Vercel Functions have a 4.5 MB body size limit. Files larger than
   * 4.5 MB must use client-side uploads via `generateUploadUrl()` instead.
   */
  async storeFile(
    path: string,
    data: Buffer | Blob,
    contentType: string,
  ): Promise<{ path: string; url: string }> {
    const token = getToken();
    const result = await put(path, data, {
      access: 'private',
      contentType,
      token,
    });
    return { path: result.pathname, url: result.url };
  }

  /**
   * Return a relative path for a private blob. The actual signed download URL
   * is resolved at read time via `head()` or `get()` from @vercel/blob.
   */
  async generateDownloadUrl(path: string): Promise<string> {
    return path;
  }

  async deleteBlob(path: string): Promise<void> {
    const token = getToken();
    await del(path, { token });
  }

  async listBlobs(prefix: string): Promise<Array<{ path: string; url: string }>> {
    const token = getToken();
    const result = await list({ prefix, token });
    return result.blobs.map((b) => ({ path: b.pathname, url: b.url }));
  }
}
