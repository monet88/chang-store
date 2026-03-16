/**
 * Unit Tests for upscaleAnalysisService
 *
 * Tests:
 * 1. generateUpscalePrompt — pure function, no mocks needed
 * 2. analyzeImage — Gemini API call with structured output
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UpscaleAnalysisReport, ImageFile } from '../../types';

// ============================================================================
// Mock the Gemini client
// ============================================================================

const mockGenerateContent = vi.fn();
vi.mock('../../services/apiClient', () => ({
  getGeminiClient: vi.fn(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}));

// Import after mocking
import { analyzeImage, generateUpscalePrompt } from '../../services/upscaleAnalysisService';

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_IMAGE: ImageFile = { base64: 'dGVzdC1pbWFnZQ==', mimeType: 'image/png' };

const FULL_REPORT: UpscaleAnalysisReport = {
  garments: [
    { name: 'Silk Blouse', type: 'top', description: 'V-neck with bishop sleeves' },
    { name: 'Pleated Skirt', type: 'bottom', description: 'Knee-length pleated midi' },
  ],
  materials: [
    { garment: 'Silk Blouse', fabric: 'silk charmeuse', texture: 'smooth', weight: 'light', sheen: 'high satin' },
    { garment: 'Pleated Skirt', fabric: 'wool blend', texture: 'pressed pleats', weight: 'medium', sheen: 'matte' },
  ],
  background: {
    environment: 'urban rooftop',
    surfaces: 'concrete and metal railing',
    depth: 'deep with city skyline',
    description: 'Golden hour rooftop shoot with skyline bokeh',
  },
  lighting: {
    direction: 'back-right rim',
    quality: 'soft natural',
    colorTemperature: 'warm golden hour',
    shadows: 'long and directional',
  },
  framing: {
    shotType: 'full-body',
    angle: 'slightly low',
    composition: 'rule of thirds, subject left',
  },
  pose: {
    bodyPosition: 'standing, weight on right leg',
    gesture: 'left hand on railing',
    expression: 'contemplative gaze off-camera',
    movement: 'static with wind in hair',
  },
  preservationRisks: [
    { area: 'silk charmeuse drape', riskLevel: 'high', detail: 'Fine fabric folds with specular highlights' },
    { area: 'pleated skirt edges', riskLevel: 'medium', detail: 'Sharp pleat creases at hemline' },
    { area: 'bokeh background', riskLevel: 'low', detail: 'Out-of-focus city lights' },
  ],
};

// ============================================================================
// generateUpscalePrompt tests
// ============================================================================

describe('generateUpscalePrompt', () => {
  it('should produce a non-empty string', () => {
    const prompt = generateUpscalePrompt(FULL_REPORT);
    expect(prompt).toBeTruthy();
    expect(typeof prompt).toBe('string');
  });

  it('should include garment names', () => {
    const prompt = generateUpscalePrompt(FULL_REPORT);
    expect(prompt).toContain('Silk Blouse');
    expect(prompt).toContain('Pleated Skirt');
  });

  it('should include material descriptions', () => {
    const prompt = generateUpscalePrompt(FULL_REPORT);
    expect(prompt).toContain('silk charmeuse');
    expect(prompt).toContain('pressed pleats');
  });

  it('should include background description', () => {
    const prompt = generateUpscalePrompt(FULL_REPORT);
    expect(prompt).toContain('urban rooftop');
  });

  it('should include lighting details', () => {
    const prompt = generateUpscalePrompt(FULL_REPORT);
    expect(prompt).toContain('back-right rim');
    expect(prompt).toContain('warm golden hour');
  });

  it('should include preservation risk areas', () => {
    const prompt = generateUpscalePrompt(FULL_REPORT);
    expect(prompt).toContain('CRITICAL PRESERVATION AREAS');
    expect(prompt).toContain('[HIGH]');
    expect(prompt).toContain('silk charmeuse drape');
  });

  it('should include closing directive about sharpness', () => {
    const prompt = generateUpscalePrompt(FULL_REPORT);
    expect(prompt).toContain('Maintain sharpness');
    expect(prompt).toContain('Avoid hallucinating');
  });

  it('should handle empty garments array', () => {
    const minReport: UpscaleAnalysisReport = {
      ...FULL_REPORT,
      garments: [],
      materials: [],
      preservationRisks: [],
    };
    const prompt = generateUpscalePrompt(minReport);
    expect(prompt).toBeTruthy();
    expect(prompt).not.toContain('GARMENTS:');
    expect(prompt).not.toContain('CRITICAL PRESERVATION AREAS');
  });
});

// ============================================================================
// analyzeImage tests
// ============================================================================

describe('analyzeImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call Gemini with correct config and return parsed report', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(FULL_REPORT),
      candidates: [{ finishReason: 'STOP' }],
    });

    const report = await analyzeImage(TEST_IMAGE);

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.model).toBe('gemini-2.5-flash');
    expect(callArgs.config.responseMimeType).toBe('application/json');
    expect(report.garments).toHaveLength(2);
    expect(report.garments[0].name).toBe('Silk Blouse');
  });

  it('should throw on safety block (promptFeedback)', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      promptFeedback: { blockReason: 'BLOCKED' },
      candidates: [],
    });

    await expect(analyzeImage(TEST_IMAGE)).rejects.toThrow('error.api.safetyBlock');
  });

  it('should throw on empty candidates', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      candidates: [],
    });

    await expect(analyzeImage(TEST_IMAGE)).rejects.toThrow('error.api.safetyBlock');
  });

  it('should throw on SAFETY finishReason', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      candidates: [{ finishReason: 'SAFETY' }],
      text: null,
    });

    await expect(analyzeImage(TEST_IMAGE)).rejects.toThrow('error.api.safetyBlock');
  });

  it('should throw on empty response text', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      candidates: [{ finishReason: 'STOP' }],
      text: '',
    });

    await expect(analyzeImage(TEST_IMAGE)).rejects.toThrow('error.api.noText');
  });

  it('should throw on invalid JSON', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      candidates: [{ finishReason: 'STOP' }],
      text: 'not valid json',
    });

    await expect(analyzeImage(TEST_IMAGE)).rejects.toThrow('JSON parse failed');
  });

  it('should normalize riskLevel values', async () => {
    const reportWithWeirdCase = {
      ...FULL_REPORT,
      preservationRisks: [
        { area: 'test', riskLevel: 'HIGH', detail: 'x' },
        { area: 'test2', riskLevel: 'Medium', detail: 'y' },
        { area: 'test3', riskLevel: 'unknown', detail: 'z' },
      ],
    };

    mockGenerateContent.mockResolvedValueOnce({
      candidates: [{ finishReason: 'STOP' }],
      text: JSON.stringify(reportWithWeirdCase),
    });

    const report = await analyzeImage(TEST_IMAGE);
    expect(report.preservationRisks[0].riskLevel).toBe('high');
    expect(report.preservationRisks[1].riskLevel).toBe('medium');
    expect(report.preservationRisks[2].riskLevel).toBe('low'); // fallback
  });

  it('should pass custom model name', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      candidates: [{ finishReason: 'STOP' }],
      text: JSON.stringify(FULL_REPORT),
    });

    await analyzeImage(TEST_IMAGE, 'gemini-2.5-pro');

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.model).toBe('gemini-2.5-pro');
  });
});
