import { describe, it, expect, vi, beforeEach } from 'vitest';

const { logApiCallMock } = vi.hoisted(() => ({
  logApiCallMock: vi.fn(),
}));

vi.mock('../../src/services/gemini/text', () => ({
  generateText: vi.fn(),
  generateImageDescription: vi.fn(),
  generateClothingDescription: vi.fn(),
  generatePoseDescription: vi.fn(),
  generateStylePromptFromImage: vi.fn(),
  analyzeScene: vi.fn(),
}));

vi.mock('../../src/services/debugService', () => ({
  logApiCall: logApiCallMock,
}));

import * as geminiTextService from '../../src/services/gemini/text';
import {
  generateText,
  generateImageDescription,
  generateClothingDescription,
  generatePoseDescription,
  generateStylePromptFromImage,
  analyzeScene,
} from '../../src/services/textService';

const TEST_IMAGE = { base64: 'aW1hZ2U=', mimeType: 'image/png' };

describe('textService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── generateText ──────────────────────────────────────────────────

  describe('generateText', () => {
    it('calls gemini text service and returns result', async () => {
      vi.mocked(geminiTextService.generateText).mockResolvedValueOnce('generated text');

      const result = await generateText('hello', 'gemini-2.5-pro');

      expect(geminiTextService.generateText).toHaveBeenCalledWith('hello', 'gemini-2.5-pro');
      expect(result).toBe('generated text');
      expect(logApiCallMock).toHaveBeenCalledWith(expect.objectContaining({
        status: 'success',
        feature: 'Text Generate',
      }));
    });

    it('logs error and rethrows on failure', async () => {
      const err = new Error('api error');
      vi.mocked(geminiTextService.generateText).mockRejectedValueOnce(err);

      await expect(generateText('hello', 'gemini-2.5-pro')).rejects.toThrow('api error');
      expect(logApiCallMock).toHaveBeenCalledWith(expect.objectContaining({
        status: 'error',
      }));
    });
  });

  // ── generateImageDescription ──────────────────────────────────────

  describe('generateImageDescription', () => {
    it('calls gemini service and returns result', async () => {
      vi.mocked(geminiTextService.generateImageDescription).mockResolvedValueOnce('desc');

      const result = await generateImageDescription(TEST_IMAGE, 'gemini-2.5-pro');

      expect(geminiTextService.generateImageDescription).toHaveBeenCalledWith(TEST_IMAGE);
      expect(result).toBe('desc');
      expect(logApiCallMock).toHaveBeenCalledWith(expect.objectContaining({
        status: 'success',
        feature: 'Image Description',
      }));
    });

    it('logs error and rethrows on failure', async () => {
      vi.mocked(geminiTextService.generateImageDescription).mockRejectedValueOnce(new Error('fail'));

      await expect(generateImageDescription(TEST_IMAGE, 'g')).rejects.toThrow('fail');
      expect(logApiCallMock).toHaveBeenCalledWith(expect.objectContaining({
        status: 'error',
        feature: 'Image Description',
      }));
    });
  });

  // ── generateClothingDescription ───────────────────────────────────

  describe('generateClothingDescription', () => {
    it('calls gemini service and returns result', async () => {
      vi.mocked(geminiTextService.generateClothingDescription).mockResolvedValueOnce('clothing desc');

      const result = await generateClothingDescription(TEST_IMAGE, 'gemini-2.5-pro');

      expect(geminiTextService.generateClothingDescription).toHaveBeenCalledWith(TEST_IMAGE);
      expect(result).toBe('clothing desc');
      expect(logApiCallMock).toHaveBeenCalledWith(expect.objectContaining({
        status: 'success',
        feature: 'Clothing Description',
      }));
    });

    it('logs error and rethrows on failure', async () => {
      vi.mocked(geminiTextService.generateClothingDescription).mockRejectedValueOnce(new Error('fail'));

      await expect(generateClothingDescription(TEST_IMAGE, 'g')).rejects.toThrow('fail');
      expect(logApiCallMock).toHaveBeenCalledWith(expect.objectContaining({
        status: 'error',
        feature: 'Clothing Description',
      }));
    });
  });

  // ── generatePoseDescription ───────────────────────────────────────

  describe('generatePoseDescription', () => {
    it('calls gemini service and returns result', async () => {
      vi.mocked(geminiTextService.generatePoseDescription).mockResolvedValueOnce('pose desc');

      const result = await generatePoseDescription(TEST_IMAGE, 'gemini-2.5-pro');

      expect(geminiTextService.generatePoseDescription).toHaveBeenCalledWith(TEST_IMAGE);
      expect(result).toBe('pose desc');
      expect(logApiCallMock).toHaveBeenCalledWith(expect.objectContaining({
        status: 'success',
        feature: 'Pose Description',
      }));
    });

    it('logs error and rethrows on failure', async () => {
      vi.mocked(geminiTextService.generatePoseDescription).mockRejectedValueOnce(new Error('fail'));

      await expect(generatePoseDescription(TEST_IMAGE, 'g')).rejects.toThrow('fail');
      expect(logApiCallMock).toHaveBeenCalledWith(expect.objectContaining({
        status: 'error',
        feature: 'Pose Description',
      }));
    });
  });

  // ── generateStylePromptFromImage ──────────────────────────────────

  describe('generateStylePromptFromImage', () => {
    it('calls gemini service with model and returns result', async () => {
      vi.mocked(geminiTextService.generateStylePromptFromImage).mockResolvedValueOnce('style prompt');

      const result = await generateStylePromptFromImage(TEST_IMAGE, 'gemini-2.5-pro');

      expect(geminiTextService.generateStylePromptFromImage).toHaveBeenCalledWith(TEST_IMAGE, 'gemini-2.5-pro');
      expect(result).toBe('style prompt');
      expect(logApiCallMock).toHaveBeenCalledWith(expect.objectContaining({
        status: 'success',
        feature: 'Style Prompt',
      }));
    });

    it('logs error and rethrows on failure', async () => {
      vi.mocked(geminiTextService.generateStylePromptFromImage).mockRejectedValueOnce(new Error('fail'));

      await expect(generateStylePromptFromImage(TEST_IMAGE, 'g')).rejects.toThrow('fail');
      expect(logApiCallMock).toHaveBeenCalledWith(expect.objectContaining({
        status: 'error',
        feature: 'Style Prompt',
      }));
    });
  });

  // ── analyzeScene ──────────────────────────────────────────────────

  describe('analyzeScene', () => {
    it('calls gemini service with model and returns result', async () => {
      vi.mocked(geminiTextService.analyzeScene).mockResolvedValueOnce('scene analysis');

      const result = await analyzeScene(TEST_IMAGE, 'gemini-2.5-pro');

      expect(geminiTextService.analyzeScene).toHaveBeenCalledWith(TEST_IMAGE, 'gemini-2.5-pro');
      expect(result).toBe('scene analysis');
      expect(logApiCallMock).toHaveBeenCalledWith(expect.objectContaining({
        status: 'success',
        feature: 'Scene Analysis',
      }));
    });

    it('logs error and rethrows on failure', async () => {
      vi.mocked(geminiTextService.analyzeScene).mockRejectedValueOnce(new Error('fail'));

      await expect(analyzeScene(TEST_IMAGE, 'g')).rejects.toThrow('fail');
      expect(logApiCallMock).toHaveBeenCalledWith(expect.objectContaining({
        status: 'error',
        feature: 'Scene Analysis',
      }));
    });
  });
});
