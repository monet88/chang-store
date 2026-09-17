import { describe, expect, it } from 'vitest';
import { Feature } from '@/types';
import {
  getModelCapabilities,
  getModelOptionsBySelectionType,
  getSupportedImageResolutions,
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
    expect(getModelOptionsBySelectionType('imageEdit')).toEqual([
      { id: 'gemini-3.1-flash-image', name: 'Nano Banana 2' },
    ]);
    expect(getModelOptionsBySelectionType('imageGenerate')).toEqual([
      { id: 'gemini-3.1-flash-image', name: 'Nano Banana 2' },
    ]);
    expect(getModelOptionsBySelectionType('textGenerate')).toEqual([
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash' },
      { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash' },
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
      { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite' },
    ]);
  });

  it('preserves existing capability checks for Gemini image models', () => {
    expect(getModelCapabilities('gemini-3.1-flash-image')).toEqual({
      supportsImageSize: true,
      supportsAspectRatio: true,
    });

    expect(getSupportedImageResolutions('gemini-3.1-flash-image')).toEqual(['1K', '2K', '4K']);

    expect(getModelCapabilities('unregistered-model')).toEqual({
      supportsImageSize: false,
      supportsAspectRatio: true,
    });
  });

  it('resolves model-aware image sizes for UI and request config', () => {
    expect(resolveEffectiveImageResolution('gemini-3.1-flash-image', '2K')).toBe('2K');
    expect(resolveEffectiveImageResolution('gemini-3.1-flash-image', '4K')).toBe('4K');
    expect(resolveEffectiveImageResolution('gemini-3.1-flash-image')).toBe('1K');

    expect(resolveImageSizeConfig('gemini-3.1-flash-image', '4K')).toBe('4K');
    expect(resolveImageSizeConfig('gemini-3.1-flash-image')).toBeUndefined();
    expect(resolveImageSizeConfig('unregistered-model', '2K')).toBeUndefined();
  });
});
