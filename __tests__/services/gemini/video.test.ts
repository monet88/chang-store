import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageFile } from '@/types';

const mockGenerateContent = vi.fn();

const mockGeminiClient = {
  models: {
    generateContent: mockGenerateContent,
  },
};

vi.mock('@/services/apiClient', () => ({
  getDirectGeminiClient: vi.fn(() => mockGeminiClient),
}));

import {
  enforceVisualPreservation,
  fuseStyleForCompactPrompt,
  generateGRWMVideoPrompt,
  generateGRWMVideoSequencePrompts,
  summarizeGRWMVideoPrompt,
} from '@/services/gemini/video';

const sampleImage: ImageFile = {
  base64: 'dGVzdC1pbWFnZS1kYXRh',
  mimeType: 'image/png',
};

function createSuccessTextResponse(text: string) {
  return {
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [{ text }],
        },
      },
    ],
    text,
  };
}

function createSuccessJsonResponse(text: string) {
  return {
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [{ text }],
        },
      },
    ],
    text,
  };
}

describe('services/gemini/video.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('uses the registry default text model for enforceVisualPreservation', async () => {
    mockGenerateContent.mockResolvedValueOnce(createSuccessTextResponse('Preserved scene'));

    await enforceVisualPreservation('Keep the outfit identical.', 8, 'close-up');

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3.5-flash',
      }),
    );
  });

  it('uses the registry default text model for fuseStyleForCompactPrompt', async () => {
    mockGenerateContent.mockResolvedValueOnce(
      createSuccessJsonResponse('{"desc":"scene","style":"editorial"}')
    );

    await fuseStyleForCompactPrompt('Refined text', { id: 'editorial' }, 'female', 8);

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3.5-flash',
      }),
    );
  });

  it('uses the registry default text model for generateGRWMVideoPrompt', async () => {
    mockGenerateContent.mockResolvedValueOnce(
      createSuccessJsonResponse('{"video_plan":[]}')
    );

    await generateGRWMVideoPrompt(sampleImage, 'casual', 'linen outfit');

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3.5-flash',
      }),
    );
  });

  it('uses the registry default text model for summarizeGRWMVideoPrompt', async () => {
    mockGenerateContent.mockResolvedValueOnce(createSuccessTextResponse('A concise summary'));

    await summarizeGRWMVideoPrompt('{"video_plan":[]}');

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3.5-flash',
      }),
    );
  });

  it('uses the registry default text model for generateGRWMVideoSequencePrompts', async () => {
    mockGenerateContent.mockResolvedValueOnce(
      createSuccessJsonResponse('[{"scene":"lookbook_scene","style":"cinematic fashion lookbook","description":"desc","action":"walk forward confidently","expression":"confident","camera_movement":"slow_tracking_right","motion_style":"fluid and visually balanced","preserve":["outfit details"],"negative_prompt":["no distortion"]}]')
    );

    await generateGRWMVideoSequencePrompts([sampleImage]);

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3.5-flash',
      }),
    );
  });
});
