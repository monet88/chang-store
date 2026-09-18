import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ImageFile } from '@/types';

const mockGenerateContent = vi.fn();

const mockGeminiClient = {
  models: {
    generateContent: mockGenerateContent,
  },
};

vi.mock('@/services/apiClient', () => ({
  getGeminiClient: vi.fn(() => mockGeminiClient),
}));

import { createImageChatSession } from '@/services/gemini/chat';

describe('createImageChatSession', () => {
  const sampleImage: ImageFile = {
    base64: 'fake-base64',
    mimeType: 'image/png',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          finishReason: 'STOP',
          content: {
            parts: [
              {
                inlineData: {
                  data: 'output-base64',
                  mimeType: 'image/png',
                },
              },
            ],
          },
        },
      ],
    });
  });

  it('uses gemini-3.1-flash-image as the default model', async () => {
    const session = createImageChatSession();
    const result = await session.sendRefinement('make it red', sampleImage);

    expect(result.base64).toBe('output-base64');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3.1-flash-image',
      }),
    );
  });

  it('respects explicitly provided model', async () => {
    const session = createImageChatSession('custom-model-id');
    await session.sendRefinement('make it vintage', sampleImage);

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'custom-model-id',
      }),
    );
  });

  it('tracks conversation history and resets cleanly', async () => {
    const session = createImageChatSession();
    expect(session.getHistory()).toEqual([]);

    await session.sendRefinement('step 1', sampleImage);
    expect(session.getHistory()).toHaveLength(1);
    expect(session.getHistory()[0].prompt).toBe('step 1');

    session.reset();
    expect(session.getHistory()).toEqual([]);
  });
});
