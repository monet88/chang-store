import { describe, expect, it } from 'vitest';
import { Feature } from '@/types';
import {
  getDefaultModelForSelectionType,
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
      defaultModelId: getDefaultModelForSelectionType('imageEdit'),
    });
    expect(tryOnScope?.options).toHaveLength(getModelOptionsBySelectionType('imageEdit').length);

    expect(backgroundScope).toMatchObject({
      selectionType: 'imageEdit',
      labelKey: 'modelSelector.scopes.imageEdit',
      defaultModelId: getDefaultModelForSelectionType('imageEdit'),
    });
    expect(backgroundScope?.options).toHaveLength(getModelOptionsBySelectionType('imageEdit').length);
  });

  it('maps image-editor to the image-generation scope', () => {
    const imageEditorScope = resolveModelSelectionScope(Feature.ImageEditor);

    expect(imageEditorScope).toMatchObject({
      selectionType: 'imageGenerate',
      labelKey: 'modelSelector.scopes.imageGenerate',
      defaultModelId: getDefaultModelForSelectionType('imageGenerate'),
    });
    expect(imageEditorScope?.options).toHaveLength(getModelOptionsBySelectionType('imageGenerate').length);
  });

  it('maps outfit analysis to the text-generation scope', () => {
    const outfitAnalysisScope = resolveModelSelectionScope(Feature.OutfitAnalysis);

    expect(outfitAnalysisScope).toMatchObject({
      selectionType: 'textGenerate',
      labelKey: 'modelSelector.scopes.textGenerate',
      defaultModelId: getDefaultModelForSelectionType('textGenerate'),
    });
    expect(outfitAnalysisScope?.options).toHaveLength(getModelOptionsBySelectionType('textGenerate').length);
  });

  it('exposes registry-backed options for all shared selection scopes', () => {
    expect(getModelOptionsBySelectionType('imageEdit')).toHaveLength(3);
    expect(getModelOptionsBySelectionType('imageGenerate')).toHaveLength(3);
    expect(getModelOptionsBySelectionType('textGenerate')).toHaveLength(4);
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
