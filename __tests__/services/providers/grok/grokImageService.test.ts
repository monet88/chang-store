import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateGrokImage, editGrokImage } from '@/services/providers/grok/grokImageService';
import { ProviderApiError, ProviderUnsupportedResponseError } from '@/services/providers/shared/ProviderApiError';
import { ImageFile } from '@/types';

const CONFIG = { apiKey: 'xai-test-key', baseUrl: 'https://api.x.ai/v1' };

const makeImage = (base64 = 'AAAA'): ImageFile => ({ base64, mimeType: 'image/jpeg' });

const okResponse = (body: unknown): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
  }) as Response;

const errorResponse = (status: number, body: unknown): Response =>
  ({
    ok: false,
    status,
    json: async () => body,
  }) as Response;

describe('grokImageService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('generateGrokImage', () => {
    it('posts JSON to /images/generations with response_format b64_json', async () => {
      fetchMock.mockResolvedValue(okResponse({ data: [{ b64_json: 'IMG' }] }));

      const result = await generateGrokImage(
        { model: 'grok-imagine-image-quality', prompt: 'a dress', n: 2, aspectRatio: '2:3', resolution: '1k' },
        CONFIG,
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.x.ai/v1/images/generations');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('Bearer xai-test-key');
      const body = JSON.parse(init.body);
      expect(body).toMatchObject({
        model: 'grok-imagine-image-quality',
        prompt: 'a dress',
        n: 2,
        aspect_ratio: '2:3',
        resolution: '1k',
        response_format: 'b64_json',
      });
      expect(result).toEqual([{ base64: 'IMG', mimeType: 'image/png' }]);
    });

    it('rejects n outside 1-10 before any network call', async () => {
      await expect(
        generateGrokImage(
          { model: 'grok-imagine-image', prompt: 'x', n: 11, aspectRatio: '1:1', resolution: '1k' },
          CONFIG,
        ),
      ).rejects.toBeInstanceOf(ProviderApiError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('downloads a url-only response instead of discarding the image', async () => {
      fetchMock.mockImplementation((url: string) =>
        Promise.resolve(
          url.startsWith('https://x.ai/a.png')
            ? ({
                ok: true,
                status: 200,
                headers: new Headers({ 'content-type': 'image/png' }),
                arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
              } as unknown as Response)
            : okResponse({ data: [{ url: 'https://x.ai/a.png' }] }),
        ),
      );

      const result = await generateGrokImage(
        { model: 'grok-imagine-image', prompt: 'x', n: 1, aspectRatio: '1:1', resolution: '1k' },
        CONFIG,
      );

      expect(result).toEqual([{ base64: btoa('\u0001\u0002\u0003'), mimeType: 'image/png' }]);
    });

    it('throws unsupported-response error when the image URL cannot be downloaded', async () => {
      fetchMock.mockImplementation((url: string) =>
        url.startsWith('https://x.ai/')
          ? Promise.reject(new TypeError('Failed to fetch'))
          : Promise.resolve(okResponse({ data: [{ url: 'https://x.ai/a.png' }] })),
      );

      await expect(
        generateGrokImage(
          { model: 'grok-imagine-image', prompt: 'x', n: 1, aspectRatio: '1:1', resolution: '1k' },
          CONFIG,
        ),
      ).rejects.toBeInstanceOf(ProviderUnsupportedResponseError);
    });

    it('throws ProviderApiError on non-2xx', async () => {
      fetchMock.mockResolvedValue(errorResponse(401, { error: { message: 'bad key', code: 'auth' } }));

      await expect(
        generateGrokImage(
          { model: 'grok-imagine-image', prompt: 'x', n: 1, aspectRatio: '1:1', resolution: '1k' },
          CONFIG,
        ),
      ).rejects.toMatchObject({ status: 401 });
    });

    it('requires an API key', async () => {
      await expect(
        generateGrokImage(
          { model: 'grok-imagine-image', prompt: 'x', n: 1, aspectRatio: '1:1', resolution: '1k' },
          { apiKey: '', baseUrl: CONFIG.baseUrl },
        ),
      ).rejects.toMatchObject({ status: 401 });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('blocks an unparseable base URL before any network call', async () => {
      await expect(
        generateGrokImage(
          { model: 'grok-imagine-image', prompt: 'x', n: 1, aspectRatio: '1:1', resolution: '1k' },
          { apiKey: 'k', baseUrl: 'not a url' },
        ),
      ).rejects.toMatchObject({ code: 'invalid_base_url' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('allows an http base URL (local proxy) and sends the request', async () => {
      fetchMock.mockResolvedValue(okResponse({ data: [{ b64_json: 'AAAA' }] }));
      await generateGrokImage(
        { model: 'grok-imagine-image', prompt: 'x', n: 1, aspectRatio: '1:1', resolution: '1k' },
        { apiKey: 'k', baseUrl: 'http://localhost:8333/v1' },
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8333/v1/images/generations');
    });

    it('maps a network failure to a typed networkError', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
      await expect(
        generateGrokImage(
          { model: 'grok-imagine-image', prompt: 'x', n: 1, aspectRatio: '1:1', resolution: '1k' },
          CONFIG,
        ),
      ).rejects.toMatchObject({ code: 'network_error', message: 'error.provider.networkError' });
    });
  });

  describe('editGrokImage', () => {
    it('uses an image object for a single source', async () => {
      fetchMock.mockResolvedValue(okResponse({ data: [{ b64_json: 'EDIT' }] }));

      await editGrokImage(
        { model: 'grok-imagine-image-quality', prompt: 'edit', images: [makeImage('S1')], n: 1, resolution: '1k' },
        CONFIG,
      );

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.image).toEqual({ type: 'image_url', url: 'data:image/jpeg;base64,S1' });
      expect(body.images).toBeUndefined();
      expect(body.response_format).toBe('b64_json');
      expect(fetchMock.mock.calls[0][0]).toBe('https://api.x.ai/v1/images/edits');
    });

    it('uses an images array for multiple sources', async () => {
      fetchMock.mockResolvedValue(okResponse({ data: [{ b64_json: 'EDIT' }] }));

      await editGrokImage(
        {
          model: 'grok-imagine-image-quality',
          prompt: 'edit',
          images: [makeImage('S1'), makeImage('S2')],
          n: 1,
          aspectRatio: '3:2',
          resolution: '1k',
        },
        CONFIG,
      );

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(Array.isArray(body.images)).toBe(true);
      expect(body.images).toHaveLength(2);
      expect(body.image).toBeUndefined();
      expect(body.aspect_ratio).toBe('3:2');
    });

    it('rejects more than 3 source images before any network call', async () => {
      await expect(
        editGrokImage(
          {
            model: 'grok-imagine-image',
            prompt: 'edit',
            images: [makeImage(), makeImage(), makeImage(), makeImage()],
            n: 1,
            resolution: '1k',
          },
          CONFIG,
        ),
      ).rejects.toMatchObject({ code: 'too_many_images' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('retries on a 429 then succeeds', async () => {
      fetchMock
        .mockResolvedValueOnce(errorResponse(429, { error: { message: 'slow down' } }))
        .mockResolvedValueOnce(okResponse({ data: [{ b64_json: 'EDIT' }] }));

      const result = await editGrokImage(
        { model: 'grok-imagine-image', prompt: 'edit', images: [makeImage()], n: 1, resolution: '1k' },
        CONFIG,
      );

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result).toEqual([{ base64: 'EDIT', mimeType: 'image/png' }]);
    });
  });
});
