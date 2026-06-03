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

describe('custom image routes', () => {
  let server: Server | undefined;

  afterEach(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = undefined;
  });

  it('normalizes inline image responses for /api/images/generate', async () => {
    const generateContent = vi.fn(async () => ({
      candidates: [{ content: { parts: [{ inlineData: { data: 'abc', mimeType: 'image/png' } }] } }],
    }));
    server = createApp({ config: testConfig(), genAiFactory: () => ({ models: { generateContent } }) });
    const baseUrl = await listen(server);

    const response = await fetch(`${baseUrl}/api/images/generate`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-key', 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'dress', numberOfImages: 1 }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.images[0]).toMatchObject({ dataUrl: 'data:image/png;base64,abc', mimeType: 'image/png' });
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-3.1-flash-image' }));
  });

  it('rejects oversize input images before upstream work', async () => {
    const generateContent = vi.fn();
    server = createApp({ config: testConfig({ maxDecodedImageBytes: 2 }), genAiFactory: () => ({ models: { generateContent } }) });
    const baseUrl = await listen(server);

    const response = await fetch(`${baseUrl}/api/images/edit`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-key', 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'edit', images: [{ mimeType: 'image/png', data: 'abcdef' }] }),
    });
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(generateContent).not.toHaveBeenCalled();
  });
});
