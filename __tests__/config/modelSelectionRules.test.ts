import { describe, expect, it } from 'vitest';
import { Feature } from '@/types';
import {
  getModelCapabilities,
  getModelOptionsBySelectionType,
  getSupportedImageResolutions,
  resolveEffectiveImageResolution,
  resolveImageSizeConfig,
} from '@/config/modelRegistry';
import {
  firstSelectableModelId,
  resolveModelSelectionScope,
  resolveProviderModelOptions,
  resolveSelectableModels,
} from '@/config/modelSelectionRules';
import { GPT_IMAGE_MODELS } from '@/config/gptImageModelRegistry';

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

describe('capability-driven picker rules (US-006 Lớp 2c)', () => {
  it('degrades to the static registry list while discovery has not run', () => {
    expect(resolveSelectableModels('imageEdit')).toEqual([
      { modelId: 'gemini-3.1-flash-image', label: 'Nano Banana 2' },
    ]);
    expect(resolveProviderModelOptions('openai-images', GPT_IMAGE_MODELS)).toEqual([
      { modelId: 'gpt-image-2', label: 'GPT Image 2' },
    ]);
  });

  it('offers only served models as selectable, and lists the rest disabled', () => {
    const options = resolveSelectableModels('imageEdit', ['gemini-3.1-flash-image']);

    expect(options).toEqual([{ modelId: 'gemini-3.1-flash-image', label: 'Nano Banana 2' }]);
    expect(firstSelectableModelId(options)).toBe('gemini-3.1-flash-image');
  });

  it('flags a served catalog model the registry does not carry as unverified', () => {
    const options = resolveSelectableModels('imageEdit', [
      'gemini-3.1-flash-image',
      'agy/gemini-3.1-flash-image',
    ]);

    expect(options).toContainEqual({
      modelId: 'agy/gemini-3.1-flash-image',
      label: 'Nano Banana 2 (agy alias)',
      unverified: true,
    });
  });

  it('never leaks another lane into the Gemini picker', () => {
    const options = resolveSelectableModels('imageEdit', [
      'gemini-3.1-flash-image',
      'gpt-image-2.5-sunburst',
      'gpt-image-2',
    ]);

    expect(options.map((option) => option.modelId)).toEqual(['gemini-3.1-flash-image']);
  });

  it('keeps a text model selectable when the served list says nothing about it', () => {
    const options = resolveSelectableModels('textGenerate', ['gemini-3.8-flash']);

    expect(options.find((option) => option.modelId === 'gemini-3.8-flash')).toEqual({
      modelId: 'gemini-3.8-flash',
      label: 'Gemini 3.8 Flash',
    });
    expect(options.every((option) => option.disabled !== true)).toBe(true);
  });

  it('lists the models a profile serves instead of the pinned studio membership', () => {
    const options = resolveProviderModelOptions(
      'openai-images',
      GPT_IMAGE_MODELS,
      ['gpt-image-2.5-sunburst'],
      'api.xompet.io.vn',
    );

    expect(options).toContainEqual({ modelId: 'gpt-image-2.5-sunburst', label: 'GPT Image 2.5 Sunburst' });
    expect(options).toContainEqual({ modelId: 'gpt-image-2', label: 'GPT Image 2', disabled: true });
    expect(firstSelectableModelId(options)).toBe('gpt-image-2.5-sunburst');
  });

  it('offers a served id the catalog does not know as an unverified option', () => {
    const options = resolveProviderModelOptions('openai-images', GPT_IMAGE_MODELS, ['gpt-image-9-unknown']);

    expect(options).toContainEqual({ modelId: 'gpt-image-9-unknown', label: 'gpt-image-9-unknown', unverified: true });
    expect(firstSelectableModelId(options)).toBe('gpt-image-9-unknown');
  });
});
