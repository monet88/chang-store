import { describe, expect, it, vi } from 'vitest';
import { testConfig } from './test-config.js';

const { googleGenAiMock } = vi.hoisted(() => ({
  googleGenAiMock: vi.fn(function GoogleGenAI() {
    return { models: { generateContent: vi.fn() } };
  }),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: googleGenAiMock,
}));

describe('Google GenAI client', () => {
  it('uses the gateway upstream timeout as the SDK HTTP timeout', async () => {
    const { createGoogleGenAiClient } = await import('../src/lib/google-genai-client.js');

    createGoogleGenAiClient(testConfig({ upstreamTimeoutMs: 12345 }));

    expect(googleGenAiMock).toHaveBeenCalledWith(expect.objectContaining({
      httpOptions: { timeout: 12345 },
    }));
  });
});
