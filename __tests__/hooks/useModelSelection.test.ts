import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getModelsBySelectionType } from '@/config/modelRegistry';
import { useModelSelection } from '@/hooks/useModelSelection';
import { Feature } from '@/types';

describe('useModelSelection', () => {
  const setImageEditModel = vi.fn();
  const setImageGenerateModel = vi.fn();
  const setTextGenerateModel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns active scope for image-edit features and hides it for watermark remover', () => {
    const { result, rerender } = renderHook(
      ({ activeFeature }) => useModelSelection({
        activeFeature,
        imageEditModel: 'gemini-3.1-flash-image-preview',
        imageGenerateModel: 'imagen-4.0-generate-001',
        textGenerateModel: 'gemini-3-flash-preview',
        setImageEditModel,
        setImageGenerateModel,
        setTextGenerateModel,
      }),
      {
        initialProps: { activeFeature: Feature.PatternGenerator },
      },
    );

    expect(result.current.activeModelSelectionScope).toMatchObject({
      selectionType: 'imageEdit',
      labelKey: 'modelSelector.scopes.imageEdit',
    });
    expect(result.current.activeModelSelectionScope?.options).toHaveLength(
      getModelsBySelectionType('imageEdit').length,
    );
    expect(result.current.textGenerationOptions).toHaveLength(
      getModelsBySelectionType('textGenerate').length,
    );

    rerender({ activeFeature: Feature.WatermarkRemover });

    expect(result.current.activeModelSelectionScope).toBeNull();
  });

  it('maps selected models and setters by selection type', () => {
    const { result } = renderHook(() => useModelSelection({
      activeFeature: Feature.TryOn,
      imageEditModel: 'gemini-2.5-flash-image',
      imageGenerateModel: 'imagen-4.0-ultra-generate-001',
      textGenerateModel: 'gemini-2.5-pro',
      setImageEditModel,
      setImageGenerateModel,
      setTextGenerateModel,
    }));

    expect(result.current.getSelectedModelBySelectionType('imageEdit')).toBe('gemini-2.5-flash-image');
    expect(result.current.getSelectedModelBySelectionType('imageGenerate')).toBe('imagen-4.0-ultra-generate-001');
    expect(result.current.getSelectedModelBySelectionType('textGenerate')).toBe('gemini-2.5-pro');

    result.current.getModelSetterBySelectionType('imageEdit')('gemini-3-pro-image-preview');
    result.current.getModelSetterBySelectionType('imageGenerate')('imagen-4.0-fast-generate-001');
    result.current.getModelSetterBySelectionType('textGenerate')('gemini-3.1-pro-preview');

    expect(setImageEditModel).toHaveBeenCalledWith('gemini-3-pro-image-preview');
    expect(setImageGenerateModel).toHaveBeenCalledWith('imagen-4.0-fast-generate-001');
    expect(setTextGenerateModel).toHaveBeenCalledWith('gemini-3.1-pro-preview');
  });
});
