import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { testConfig } from './test-config.js';

const listen = async (server: Server): Promise<string> => new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (typeof address === 'object' && address) resolve(`http://127.0.0.1:${address.port}`);
  });
});

describe('root route', () => {
  let server: Server | undefined;

  afterEach(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = undefined;
  });

  it('returns public gateway endpoint metadata', async () => {
    const generateContent = vi.fn();
    server = createApp({ config: testConfig(), genAiFactory: () => ({ models: { generateContent } }) });
    const baseUrl = await listen(server);

    const response = await fetch(`${baseUrl}/`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Chang Store Vertex Gateway');
    expect(body.endpoints).toEqual(expect.arrayContaining([
      'GET /gemini/v1beta/models',
      'POST /gemini/v1beta/models/{model}:generateContent',
      'POST /openai/v1/chat/completions',
      'POST /openai/v1/responses',
    ]));
    expect(generateContent).not.toHaveBeenCalled();
  });
});
