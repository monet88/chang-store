import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/utils/imageUtils', () => ({
  compressImage: vi.fn().mockResolvedValue({ base64: 'mock-base64', mimeType: 'image/png' }),
}));

import {
  DEFAULT_BRAND_MODEL_DEFINITIONS,
  loadDefaultBrandModels,
  loadCustomBrandModels,
  saveCustomBrandModel,
  deleteCustomBrandModel,
  isCustomBrandModel,
  BrandModelProfile,
} from '../../src/config/brandModelRoster';

describe('brandModelRoster', () => {
  it('defines starter brand models for Linh and Mai', () => {
    expect(DEFAULT_BRAND_MODEL_DEFINITIONS).toHaveLength(2);
    const [linh, mai] = DEFAULT_BRAND_MODEL_DEFINITIONS;

    expect(linh.id).toBe('linh');
    expect(linh.name).toBe('Linh');
    expect(linh.metadata.skinTone).toContain('fair');

    expect(mai.id).toBe('mai');
    expect(mai.name).toBe('Mai');
    expect(mai.metadata.styleVibe).toContain('Gen Z');
  });

  it('loads brand model profiles with face and body references', async () => {
    const mockBlob = new Blob(['dummy-image-bytes'], { type: 'image/png' });
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });

    try {
      const models = await loadDefaultBrandModels();
      expect(models).toHaveLength(2);
      expect(models[0].id).toBe('linh');
      expect(models[0].faceImage?.base64).toBe('mock-base64');
      expect(models[1].id).toBe('mai');
      expect(models[1].faceImage?.base64).toBe('mock-base64');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('manages custom brand models in localStorage', () => {
    const customModel: BrandModelProfile = {
      id: 'custom-model-1',
      name: 'Trang',
      metadata: {
        age: 25,
        height: '1m68',
        weight: '50kg',
        bodyType: 'slender',
        skinTone: 'warm fair',
        facialFeatures: 'bright eyes',
        styleVibe: 'casual',
      },
      faceImage: { base64: 'face-64', mimeType: 'image/png' },
      bodyImage: null,
    };

    expect(isCustomBrandModel('linh')).toBe(false);
    expect(isCustomBrandModel('custom-model-1')).toBe(true);

    saveCustomBrandModel(customModel);
    const loaded = loadCustomBrandModels();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Trang');

    deleteCustomBrandModel('custom-model-1');
    expect(loadCustomBrandModels()).toHaveLength(0);
  });
});
