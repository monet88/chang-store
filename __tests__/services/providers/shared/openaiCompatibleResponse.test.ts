import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseOpenAIResponse } from '@/services/providers/shared/openaiCompatibleResponse';
import { ProviderApiError, ProviderUnsupportedResponseError } from '@/services/providers/shared/ProviderApiError';

const BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const BYTES_BASE64 = btoa(String.fromCharCode(...BYTES));

const download = (bytes: Uint8Array = BYTES, contentType = 'image/png'): Response =>
  ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': contentType }),
    arrayBuffer: async () => bytes.buffer,
  }) as unknown as Response;

describe('parseOpenAIResponse', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('extracts b64_json images with the given mime type', async () => {
    const result = await parseOpenAIResponse(
      { data: [{ b64_json: 'AAAA' }, { b64_json: 'BBBB' }] },
      'image/jpeg',
    );

    expect(result).toEqual([
      { base64: 'AAAA', mimeType: 'image/jpeg' },
      { base64: 'BBBB', mimeType: 'image/jpeg' },
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('defaults to image/png when no mime type is supplied', async () => {
    const result = await parseOpenAIResponse({ data: [{ b64_json: 'AAAA' }] });
    expect(result[0].mimeType).toBe('image/png');
  });

  it('ignores malformed or unsafe provider mime_type hints for b64_json', async () => {
    const malformed = await parseOpenAIResponse({ data: [{ b64_json: 'AAAA', mime_type: 123 }] });
    const unsafe = await parseOpenAIResponse({ data: [{ b64_json: 'BBBB', mime_type: 'image/svg+xml' }] });

    expect(malformed[0].mimeType).toBe('image/png');
    expect(unsafe[0].mimeType).toBe('image/png');
  });

  it('downloads a url-only response and converts it to base64', async () => {
    fetchMock.mockResolvedValue(download());

    const result = await parseOpenAIResponse({ data: [{ url: 'https://cdn.test/i/x.png' }] });

    expect(fetchMock).toHaveBeenCalledWith('https://cdn.test/i/x.png');
    expect(result).toEqual([{ base64: BYTES_BASE64, mimeType: 'image/png' }]);
  });

  it('stamps the downloaded content type and keeps the item order', async () => {
    fetchMock.mockResolvedValue(download(BYTES, 'image/webp; charset=binary'));

    const result = await parseOpenAIResponse({
      data: [{ url: 'https://cdn.test/a.webp' }, { b64_json: 'BBBB' }],
    });

    expect(result).toEqual([
      { base64: BYTES_BASE64, mimeType: 'image/webp' },
      { base64: 'BBBB', mimeType: 'image/png' },
    ]);
  });

  it('throws urlOnly when the download itself fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      parseOpenAIResponse({ data: [{ url: 'https://cdn.test/i/x.png' }] }),
    ).rejects.toMatchObject({ message: 'error.provider.response.urlOnly' });
  });

  it('throws urlOnly when the download answers a non-2xx', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, headers: new Headers() } as unknown as Response);

    await expect(
      parseOpenAIResponse({ data: [{ url: 'https://cdn.test/i/x.png' }] }),
    ).rejects.toThrow(ProviderUnsupportedResponseError);
  });

  it('throws unknownShape when an item carries neither b64_json nor url', async () => {
    await expect(
      parseOpenAIResponse({ data: [{ revised_prompt: 'x' }] }),
    ).rejects.toMatchObject({ message: 'error.provider.response.unknownShape' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws ProviderApiError when an error envelope is present (200 + error body)', async () => {
    await expect(
      parseOpenAIResponse({ error: { message: 'bad', code: 'invalid_request' } }),
    ).rejects.toBeInstanceOf(ProviderApiError);
  });

  it('checks the error envelope before attempting data extraction', async () => {
    try {
      await parseOpenAIResponse({ error: { message: 'nope', type: 'server_error' }, data: [{ b64_json: 'AAAA' }] });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderApiError);
      expect((err as ProviderApiError).code).toBe('server_error');
    }
  });

  it('throws ProviderUnsupportedResponseError when data is empty', async () => {
    await expect(parseOpenAIResponse({ data: [] })).rejects.toThrow(ProviderUnsupportedResponseError);
  });

  it('throws ProviderUnsupportedResponseError for malformed responses', async () => {
    await expect(parseOpenAIResponse(null)).rejects.toThrow(ProviderUnsupportedResponseError);
    await expect(parseOpenAIResponse('nope')).rejects.toThrow(ProviderUnsupportedResponseError);
  });
});
