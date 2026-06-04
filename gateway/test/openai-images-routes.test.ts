import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../src/app.js';
import { testConfig } from './test-config.js';

const listen = async (server: Server): Promise<string> => new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (typeof address === 'object' && address) resolve(`http://127.0.0.1:${address.port}`);
  });
});

describe('openai image routes', () => {
  let server: Server | undefined;

  afterEach(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = undefined;
  });

  it('returns OpenAI-style b64_json data for image generations', async () => {
    const generateContent = vi.fn(async () => ({
      candidates: [{ content: { parts: [{ inlineData: { data: 'abc', mimeType: 'image/png' } }] } }],
    }));
    server = createApp({ config: testConfig(), genAiFactory: () => ({ models: { generateContent } }) });
    const baseUrl = await listen(server);

    const response = await fetch(`${baseUrl}/openai/v1/images/generations`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-key', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-2.5-flash-image',
        prompt: 'Generate a fashion image',
        n: 1,
        size: '1024x1024',
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([{ b64_json: 'abc' }]);
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-2.5-flash-image',
      config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } },
    }));
  });

  it('returns OpenAI-style b64_json data for JSON image edits with multiple inputs and outputs', async () => {
    const generateContent = vi.fn()
      .mockResolvedValueOnce({ candidates: [{ content: { parts: [{ inlineData: { data: 'one', mimeType: 'image/png' } }] } }] })
      .mockResolvedValueOnce({ candidates: [{ content: { parts: [{ inlineData: { data: 'two', mimeType: 'image/png' } }] } }] });
    server = createApp({ config: testConfig(), genAiFactory: () => ({ models: { generateContent } }) });
    const baseUrl = await listen(server);

    const response = await fetch(`${baseUrl}/openai/v1/images/edits`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-key', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-3.1-flash-image',
        prompt: 'Edit the outfit',
        n: 2,
        size: '1536x1024',
        image: [
          'data:image/png;base64,YWJj',
          'data:image/jpeg;base64,ZGVm',
        ],
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([{ b64_json: 'one' }, { b64_json: 'two' }]);
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-3.1-flash-image',
      config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '3:2' } },
    }));
  });

  it('supports multipart edit uploads for OpenAI-style clients', async () => {
    const generateContent = vi.fn(async () => ({
      candidates: [{ content: { parts: [{ inlineData: { data: 'edited', mimeType: 'image/png' } }] } }],
    }));
    server = createApp({ config: testConfig(), genAiFactory: () => ({ models: { generateContent } }) });
    const baseUrl = await listen(server);
    const boundary = '----chang-store-test-boundary';
    const multipartBody = [
      `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\ngemini-3-pro-image\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\nEdit this garment\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="n"\r\n\r\n1\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="size"\r\n\r\n1024x1792\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="look.png"\r\nContent-Type: image/png\r\n\r\nabc\r\n`,
      `--${boundary}--\r\n`,
    ].join('');

    const response = await fetch(`${baseUrl}/openai/v1/images/edits`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-key',
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([{ b64_json: 'edited' }]);
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-3-pro-image',
      config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '9:16' } },
    }));
  });

  it('rejects unsupported OpenAI image fields explicitly', async () => {
    const generateContent = vi.fn();
    server = createApp({ config: testConfig(), genAiFactory: () => ({ models: { generateContent } }) });
    const baseUrl = await listen(server);

    const response = await fetch(`${baseUrl}/openai/v1/images/generations`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-key', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-2.5-flash-image',
        prompt: 'Generate',
        response_format: 'url',
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.message).toMatch(/response_format/);
    expect(generateContent).not.toHaveBeenCalled();
  });
});
