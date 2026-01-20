/**
 * Unit tests for services/localProviderService.ts
 *
 * Covers text, vision-text, image generation, and image edit routes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateTextLocal,
  generateTextFromImageLocal,
  generateImageLocal,
  editImageLocal,
  type LocalProviderConfig,
} from '@/services/localProviderService';

const MOCK_BASE_URL = 'http://localhost:8317';
const MOCK_API_KEY = 'local-key-123';

const TEST_IMAGE = {
  base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ',
  mimeType: 'image/png',
};

function createMockResponse(
  data: unknown,
  ok = true,
  status = 200
): Response {
  return {
    ok,
    status,
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response;
}

function createMockResponseWithJsonError(): Response {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve('{ invalid json'),
  } as Response;
}

describe('localProviderService', () => {
  const originalFetch = global.fetch;
  const config: LocalProviderConfig = {
    baseUrl: MOCK_BASE_URL,
    apiKey: MOCK_API_KEY,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('generateTextLocal posts to generateContent and returns trimmed text', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      createMockResponse({ candidates: [{ content: { parts: [{ text: ' Hello ' }] } }] })
    );

    const result = await generateTextLocal('Prompt', 'local-model', config);

    expect(result).toBe('Hello');
    const [url, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('http://localhost:8317/v1beta/models/local-model:generateContent?key=local-key-123');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.contents[0].parts[0].text).toBe('Prompt');
  });

  it('generateTextLocal throws error.api.noText when content missing', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      createMockResponse({ candidates: [{ content: { parts: [] } }] })
    );

    await expect(
      generateTextLocal('Prompt', 'local-model', config)
    ).rejects.toThrow('error.api.noText');
  });

  it('generateTextLocal throws error.api.localProviderFailed on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      createMockResponse({ error: 'bad' }, false, 500)
    );

    await expect(
      generateTextLocal('Prompt', 'local-model', config)
    ).rejects.toThrow('error.api.localProviderFailed');
  });

  it('generateTextLocal throws error.api.invalidResponse when JSON parse fails', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      createMockResponseWithJsonError()
    );

    await expect(
      generateTextLocal('Prompt', 'local-model', config)
    ).rejects.toThrow('error.api.invalidResponse');
  });

  it('generateTextFromImageLocal sends inlineData content with base64 image', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      createMockResponse({ candidates: [{ content: { parts: [{ text: 'Scene' }] } }] })
    );

    const urlConfig = { ...config, baseUrl: 'http://localhost:8317/' };
    const result = await generateTextFromImageLocal(TEST_IMAGE, 'Describe', 'vision-model', urlConfig);

    expect(result).toBe('Scene');
    const [url, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('http://localhost:8317/v1beta/models/vision-model:generateContent?key=local-key-123');

    const body = JSON.parse(options.body);
    const content = body.contents[0].parts;
    expect(content[0].text).toBe('Describe');
    expect(content[1].inlineData.data).toBe(TEST_IMAGE.base64);
    expect(content[1].inlineData.mimeType).toBe('image/png');
  });

  it('generateImageLocal returns ImageFile from inlineData', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      createMockResponse({
        candidates: [{ content: { parts: [{ inlineData: { data: 'abc123', mimeType: 'image/png' } }] } }],
      })
    );

    const result = await generateImageLocal('Make art', 'image-model', config);

    expect(result).toEqual({ base64: 'abc123', mimeType: 'image/png' });
    const [url, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('http://localhost:8317/v1beta/models/image-model:generateContent?key=local-key-123');
    const body = JSON.parse(options.body);
    expect(body.generationConfig.responseModalities).toContain('IMAGE');
    expect(body.generationConfig.imageConfig.aspectRatio).toBe('1:1');
  });

  it('generateImageLocal includes imageSize when provided', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      createMockResponse({
        candidates: [{ content: { parts: [{ inlineData: { data: 'abc123', mimeType: 'image/png' } }] } }],
      })
    );

    const result = await generateImageLocal('Make art', 'image-model', config, '2048x2048');

    expect(result).toEqual({ base64: 'abc123', mimeType: 'image/png' });
    const [url, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('http://localhost:8317/v1beta/models/image-model:generateContent?key=local-key-123');
    const body = JSON.parse(options.body);
    expect(body.generationConfig.imageConfig.aspectRatio).toBe('1:1');
  });

  it('editImageLocal posts generateContent with inlineData and returns ImageFile', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      createMockResponse({
        candidates: [{ content: { parts: [{ inlineData: { data: 'edited-image', mimeType: 'image/png' } }] } }],
      })
    );

    const result = await editImageLocal(TEST_IMAGE, 'Edit it', 'edit-model', config);

    expect(result).toEqual({ base64: 'edited-image', mimeType: 'image/png' });
    const [url, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('http://localhost:8317/v1beta/models/edit-model:generateContent?key=local-key-123');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.contents[0].parts[0].inlineData.data).toBe(TEST_IMAGE.base64);
    expect(body.contents[0].parts[0].inlineData.mimeType).toBe('image/png');
    expect(body.contents[0].parts[1].text).toBe('Edit it');
    expect(body.generationConfig.responseModalities).toContain('IMAGE');
  });
});
