import { describe, expect, it } from 'vitest';
import { Feature } from '@/types';
import {
  getModelCapabilities,
  getModelOptionsBySelectionType,
  resolveEffectiveImageResolution,
  resolveImageSizeConfig,
} from '@/config/modelRegistry';
import { resolveModelSelectionScope } from '@/config/modelSelectionRules';

describe('model selection rules', () => {
  it('maps image-edit features to the image editing scope', () => {
    const tryOnScope = resolveModelSelectionScope(Feature.TryOn);
    const backgroundScope = resolveModelSelectionScope(Feature.Background);
    const identityTransferScope = resolveModelSelectionScope(Feature.IdentityTransfer);

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
    expect(identityTransferScope).toMatchObject({
      selectionType: 'imageEdit',
      labelKey: 'modelSelector.scopes.imageEdit',
    });
  });

  it('omits model selector for watermark remover', () => {
    expect(resolveModelSelectionScope(Feature.WatermarkRemover)).toBeNull();
  });

  it('exposes registry-backed options for all shared selection scopes', () => {
    expect(getModelOptionsBySelectionType('imageEdit')).toHaveLength(4);
    expect(getModelOptionsBySelectionType('imageGenerate')).toHaveLength(4);
    expect(getModelOptionsBySelectionType('textGenerate')).toHaveLength(3);
  });

  it('includes Nano Banana image-edit variants in registry-backed options', () => {
    expect(getModelOptionsBySelectionType('imageEdit')).toContainEqual({
      id: 'gemini-2.5-flash-image',
      name: 'Nano Banana',
    });
    expect(getModelOptionsBySelectionType('imageEdit')).toContainEqual({
      id: 'gemini-3.1-flash-image',
      name: 'Nano Banana 2',
    });
    expect(getModelOptionsBySelectionType('imageEdit')).toContainEqual({
      id: 'gemini-3.1-flash-lite-image',
      name: 'Nano Banana 2 Lite',
    });
  });

  it('includes Nano Banana 2 Lite in image generation options', () => {
    expect(getModelOptionsBySelectionType('imageGenerate')).toContainEqual({
      id: 'gemini-3.1-flash-lite-image',
      name: 'Nano Banana 2 Lite',
    });
  });

  it('preserves existing capability checks for Gemini image models', () => {
    expect(getModelCapabilities('gemini-3-pro-image')).toEqual({
      supportsImageSize: true,
      supportsAspectRatio: true,
    });

    expect(getModelCapabilities('gemini-2.5-flash-image')).toEqual({
      supportsImageSize: false,
      supportsAspectRatio: true,
      supportedImageSizes: ['1K'],
    });

    expect(getModelCapabilities('gemini-3.1-flash-image')).toEqual({
      supportsImageSize: true,
      supportsAspectRatio: true,
    });

    expect(getModelCapabilities('gemini-3.1-flash-lite-image')).toEqual({
      supportsImageSize: true,
      supportsAspectRatio: true,
      supportedImageSizes: ['1K'],
    });
  });

  it('resolves model-aware image sizes for UI and request config', () => {
    expect(resolveEffectiveImageResolution('gemini-3.1-flash-lite-image', '2K')).toBe('1K');
    expect(resolveEffectiveImageResolution('gemini-3.1-flash-image', '4K')).toBe('4K');

    expect(resolveImageSizeConfig('gemini-3.1-flash-lite-image', '2K')).toBe('1K');
    expect(resolveImageSizeConfig('gemini-3.1-flash-lite-image')).toBe('1K');
    expect(resolveImageSizeConfig('gemini-3.1-flash-image', '4K')).toBe('4K');
    expect(resolveImageSizeConfig('gemini-3.1-flash-image')).toBeUndefined();
    expect(resolveImageSizeConfig('gemini-2.5-flash-image', '2K')).toBeUndefined();
  });
});
