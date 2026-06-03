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

describe('openai-compatible routes', () => {
  let server: Server | undefined;

  afterEach(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = undefined;
  });

  it('returns OpenAI-compatible chat completions from Gemini responses', async () => {
    const generateContent = vi.fn(async () => ({
      modelVersion: 'gemini-3.5-flash',
      candidates: [{
        content: {
          parts: [{ text: 'ok' }],
        },
        finishReason: 'STOP',
      }],
      usageMetadata: {
        promptTokenCount: 11,
        candidatesTokenCount: 7,
        totalTokenCount: 18,
      },
    }));

    server = createApp({ config: testConfig(), genAiFactory: () => ({ models: { generateContent } }) });
    const baseUrl = await listen(server);

    const response = await fetch(`${baseUrl}/openai/v1/chat/completions`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-key', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-3.5-flash',
        messages: [
          { role: 'system', content: 'You are concise.' },
          { role: 'user', content: 'Reply with exactly ok' },
        ],
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.object).toBe('chat.completion');
    expect(body.choices[0].message).toMatchObject({ role: 'assistant', content: 'ok' });
    expect(body.usage).toMatchObject({ prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 });
    expect(generateContent).toHaveBeenCalledWith({
      model: 'gemini-3.5-flash',
      systemInstruction: { parts: [{ text: 'You are concise.' }] },
      contents: [{ role: 'user', parts: [{ text: 'Reply with exactly ok' }] }],
    });
  });

  it('returns one OpenAI choice for each requested Gemini candidate', async () => {
    const generateContent = vi.fn(async () => ({
      modelVersion: 'gemini-3.5-flash',
      candidates: [
        {
          content: { parts: [{ text: 'first' }] },
          finishReason: 'STOP',
        },
        {
          content: { parts: [{ text: 'second' }] },
          finishReason: 'MAX_TOKENS',
        },
      ],
      usageMetadata: {
        promptTokenCount: 5,
        candidatesTokenCount: 9,
        totalTokenCount: 14,
      },
    }));

    server = createApp({ config: testConfig(), genAiFactory: () => ({ models: { generateContent } }) });
    const baseUrl = await listen(server);

    const response = await fetch(`${baseUrl}/openai/v1/chat/completions`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-key', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-3.5-flash',
        n: 2,
        messages: [{ role: 'user', content: 'Give two options' }],
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.choices).toHaveLength(2);
    expect(body.choices[0]).toMatchObject({
      index: 0,
      message: { role: 'assistant', content: 'first' },
      finish_reason: 'stop',
    });
    expect(body.choices[1]).toMatchObject({
      index: 1,
      message: { role: 'assistant', content: 'second' },
      finish_reason: 'length',
    });
    expect(generateContent).toHaveBeenCalledWith({
      model: 'gemini-3.5-flash',
      contents: [{ role: 'user', parts: [{ text: 'Give two options' }] }],
      generationConfig: { candidateCount: 2 },
    });
  });

  it('lists OpenAI-compatible models behind the /openai prefix', async () => {
    const generateContent = vi.fn();
    server = createApp({ config: testConfig(), genAiFactory: () => ({ models: { generateContent } }) });
    const baseUrl = await listen(server);

    const response = await fetch(`${baseUrl}/openai/v1/models`, {
      headers: { authorization: 'Bearer test-key' },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.object).toBe('list');
    expect(body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'gemini-3.5-flash', object: 'model' }),
    ]));
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('rejects unsupported OpenAI-compatible streaming requests explicitly', async () => {
    const generateContent = vi.fn();
    server = createApp({ config: testConfig(), genAiFactory: () => ({ models: { generateContent } }) });
    const baseUrl = await listen(server);

    const response = await fetch(`${baseUrl}/openai/v1/chat/completions`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-key', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-3.5-flash',
        stream: true,
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.message).toMatch(/streaming/i);
    expect(generateContent).not.toHaveBeenCalled();
  });
});
