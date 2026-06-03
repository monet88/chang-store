import type { Server } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { testConfig } from './test-config.js';

const listen = async (server: Server): Promise<string> => new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (typeof address === 'object' && address) resolve(`http://127.0.0.1:${address.port}`);
  });
});

async function* streamChunks() {
  yield { candidates: [{ content: { parts: [{ text: 'hel' }] } }] };
  yield { candidates: [{ content: { parts: [{ text: 'lo' }] }, finishReason: 'STOP' }] };
}

describe('streaming compatibility routes', () => {
  it('streams Gemini-compatible streamGenerateContent responses as SSE chunks', async () => {
    const generateContent = vi.fn();
    const generateContentStream = vi.fn(async () => streamChunks());
    const server = createApp({
      config: testConfig(),
      genAiFactory: () => ({ models: { generateContent, generateContentStream } }),
    });
    const baseUrl = await listen(server);

    try {
      const response = await fetch(`${baseUrl}/gemini/v1beta/models/gemini-2.5-flash:streamGenerateContent`, {
        method: 'POST',
        headers: { authorization: 'Bearer test-key', 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] }),
      });
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      expect(body).toContain('data: {"candidates":[{"content":{"parts":[{"text":"hel"}]}}]}');
      expect(body).toContain('data: {"candidates":[{"content":{"parts":[{"text":"lo"}]},"finishReason":"STOP"}]}');
      expect(body).toContain('data: [DONE]');
      expect(generateContentStream).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
      });
      expect(generateContent).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('streams Vertex-compatible streamGenerateContent responses as SSE chunks', async () => {
    const generateContent = vi.fn();
    const generateContentStream = vi.fn(async () => streamChunks());
    const server = createApp({
      config: testConfig(),
      genAiFactory: () => ({ models: { generateContent, generateContentStream } }),
    });
    const baseUrl = await listen(server);

    try {
      const response = await fetch(`${baseUrl}/vertex/v1/projects/p/locations/us-central1/publishers/google/models/gemini-2.5-flash:streamGenerateContent`, {
        method: 'POST',
        headers: { authorization: 'Bearer test-key', 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] }),
      });
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      expect(body).toContain('data: [DONE]');
      expect(generateContentStream).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
      });
      expect(generateContent).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
