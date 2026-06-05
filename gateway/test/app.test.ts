import { EventEmitter } from 'node:events';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { testConfig } from './test-config.js';

class FakeRequest extends EventEmitter {
  method = 'GET';
  url = '/';
  headers: Record<string, string> = {};
  destroy = vi.fn();
}

class FakeResponse extends EventEmitter {
  statusCode = 0;
  headersSent = false;
  writableEnded = false;
  destroyed = false;
  readonly endCalls: Array<string | undefined> = [];
  readonly headerCalls: Array<[string, string]> = [];

  setHeader(name: string, value: string): void {
    this.headerCalls.push([name, value]);
  }

  once(eventName: string | symbol, listener: (...args: Array<unknown>) => void): this {
    return super.once(eventName, listener);
  }

  off(eventName: string | symbol, listener: (...args: Array<unknown>) => void): this {
    return super.off(eventName, listener);
  }

  end(chunk?: string): void {
    this.endCalls.push(chunk);
    if (!this.headersSent) {
      this.headersSent = true;
      throw new Error('socket write failed after headers');
    }
    this.writableEnded = true;
  }
}

const listen = async (server: Server): Promise<string> => new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (typeof address === 'object' && address) resolve(`http://127.0.0.1:${address.port}`);
  });
});

describe('app error fallback', () => {
  it('does not append a JSON error payload after headers were already sent', async () => {
    const server = createApp({
      config: testConfig(),
      genAiFactory: () => ({ models: { generateContent: vi.fn() } }),
    });
    const handler = server.listeners('request')[0] as (
      req: IncomingMessage,
      res: ServerResponse,
    ) => Promise<void>;

    const req = new FakeRequest();
    const res = new FakeResponse();

    await handler(req as unknown as IncomingMessage, res as unknown as ServerResponse);

    expect(res.endCalls).toHaveLength(2);
    expect(res.endCalls[0]).toContain('"message":"Chang Store Vertex Gateway"');
    expect(res.endCalls[1]).toBeUndefined();
    expect(res.endCalls.join(' ')).not.toContain('"success":false');
    expect(
      res.headerCalls.filter(([name]) => name.toLowerCase() === 'content-type'),
    ).toHaveLength(1);
  });
});

describe('app model aliasing', () => {
  it('rewrites direct Gemini route models through the configured alias map', async () => {
    const generateContent = vi.fn(async () => ({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }));
    const server = createApp({
      config: testConfig({
        modelCatalog: {
          gemini: {
            aliases: { 'gemini-3.1-pro': 'gemini-3.1-pro-preview' },
            allowlist: [],
            disabled: [],
          },
        },
      }),
      genAiFactory: () => ({ models: { generateContent } }),
    });
    const baseUrl = await listen(server);

    const response = await fetch(`${baseUrl}/gemini/v1beta/models/gemini-3.1-pro:generateContent`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-key', 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with OK only.' }] }] }),
    });

    expect(response.status).toBe(200);
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-3.1-pro-preview' }));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('rewrites custom image route body models through the configured alias map', async () => {
    const generateContent = vi.fn(async () => ({
      candidates: [{ content: { parts: [{ inlineData: { data: 'abc', mimeType: 'image/png' } }] } }],
    }));
    const server = createApp({
      config: testConfig({
        modelCatalog: {
          gemini: {
            aliases: { 'gemini-3.1-flash-image': 'gemini-3.1-flash-image-preview' },
            allowlist: [],
            disabled: [],
          },
        },
      }),
      genAiFactory: () => ({ models: { generateContent } }),
    });
    const baseUrl = await listen(server);

    const response = await fetch(`${baseUrl}/api/images/edit`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-key', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-3.1-flash-image',
        prompt: 'edit',
        images: [{ mimeType: 'image/png', data: 'YWJj' }],
      }),
    });

    expect(response.status).toBe(200);
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-3.1-flash-image-preview' }));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
