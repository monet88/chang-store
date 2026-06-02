import { describe, expect, it } from 'vitest';
import { Feature } from '@/types';
import {
  getModelCapabilities,
  getModelOptionsBySelectionType,
} from '@/config/modelRegistry';
import { resolveModelSelectionScope } from '@/config/modelSelectionRules';

describe('model selection rules', () => {
  it('maps image-edit features to the image editing scope', () => {
    const tryOnScope = resolveModelSelectionScope(Feature.TryOn);
    const backgroundScope = resolveModelSelectionScope(Feature.Background);

    expect(tryOnScope).toMatchObject({
      selectionType: 'imageEdit',
      labelKey: 'modelSelector.scopes.imageEdit',
    });
    expect(tryOnScope?.options).toHaveLength(getModelOptionsBySelectionType('imageEdit').length);

    expect(backgroundScope).toMatchObject({
      selectionType: 'imageEdit',
      labelKey: 'modelSelector.scopes.imageEdit',
    });
    expect(backgroundScope?.options).toHaveLength(getModelOptionsBySelectionType('imageEdit').length);
  });

  it('omits model selector for watermark remover', () => {
    expect(resolveModelSelectionScope(Feature.WatermarkRemover)).toBeNull();
  });

  it('exposes registry-backed options for all shared selection scopes', () => {
    expect(getModelOptionsBySelectionType('imageEdit')).toHaveLength(3);
    expect(getModelOptionsBySelectionType('imageGenerate')).toHaveLength(3);
    expect(getModelOptionsBySelectionType('textGenerate')).toHaveLength(3);
  });

  it('preserves existing capability checks for Gemini and Imagen models', () => {
    expect(getModelCapabilities('gemini-3-pro-image-preview')).toEqual({
      supportsImageSize: true,
      supportsAspectRatio: true,
    });

    expect(getModelCapabilities('gemini-2.5-flash-image')).toEqual({
      supportsImageSize: false,
      supportsAspectRatio: true,
    });

    expect(getModelCapabilities('imagen-4.0-generate-001')).toEqual({
      supportsImageSize: true,
      supportsAspectRatio: true,
    });
  });
});
