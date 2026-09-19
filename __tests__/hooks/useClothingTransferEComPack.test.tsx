import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClothingTransferEComPack } from '../../src/hooks/useClothingTransferEComPack';
import { ImageFile } from '../../src/types';

const editImageMock = vi.fn();
const upscaleImageMock = vi.fn();
const addImageMock = vi.fn();
const setErrorMock = vi.fn();

const mockDriver = {
  editImage: editImageMock,
  upscaleImage: upscaleImageMock,
};

const mockImage = (id: string): ImageFile => ({
  base64: `data-${id}`,
  mimeType: 'image/png',
});

describe('useClothingTransferEComPack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editImageMock.mockResolvedValue([mockImage('result-1')]);
  });

  const setupHook = () =>
    renderHook(() =>
      useClothingTransferEComPack({
        driver: mockDriver,
        aspectRatio: '3:4',
        resolution: '1K',
        numImages: 1,
        imageEditModel: 'gemini-2.5-flash-image',
        engineId: 'gemini',
        extraPrompt: '',
        addImage: addImageMock,
        setError: setErrorMock,
        t: (key) => key,
      }),
    );

  it('initializes with default garment scope and zero default selections', () => {
    const { result } = setupHook();

    expect(result.current.sourceOutfitImage).toBeNull();
    expect(result.current.garmentScope).toBe('full-set');
    expect(result.current.selectedBrandModelId).toBeNull();
    expect(result.current.selectedBrandModelIds).toEqual([]);
    expect(result.current.selectedTemplateIds).toEqual([]);
    expect(result.current.customDestinations).toHaveLength(0);
    expect(result.current.packItems).toHaveLength(0);
  });

  it('manages single brand model selection and template toggles', () => {
    const { result } = setupHook();

    act(() => {
      result.current.selectBrandModel('mai');
    });
    expect(result.current.selectedBrandModelId).toBe('mai');
    expect(result.current.selectedBrandModelIds).toEqual(['mai']);

    act(() => {
      result.current.selectBrandModel('mai');
    });
    expect(result.current.selectedBrandModelId).toBeNull();
    expect(result.current.selectedBrandModelIds).toEqual([]);

    act(() => {
      result.current.toggleDisplayTemplate('custom-staging-0');
    });
    expect(result.current.selectedTemplateIds).toEqual(['custom-staging-0']);

    act(() => {
      result.current.toggleDisplayTemplate('custom-staging-0');
    });
    expect(result.current.selectedTemplateIds).toEqual([]);
  });

  it('manages custom destination images with maximum limit of 4', () => {
    const { result } = setupHook();

    act(() => {
      result.current.handleCustomDestinationsUpload([
        mockImage('c1'),
        mockImage('c2'),
        mockImage('c3'),
      ]);
    });
    expect(result.current.customDestinations).toHaveLength(3);

    act(() => {
      result.current.handleCustomDestinationsUpload([mockImage('c4'), mockImage('c5')]);
    });
    // Capped at 4
    expect(result.current.customDestinations).toHaveLength(4);

    act(() => {
      result.current.handleRemoveCustomDestination(1);
    });
    expect(result.current.customDestinations).toHaveLength(3);
  });

  it('requires sourceOutfitImage to run generation', async () => {
    const { result } = setupHook();

    await act(async () => {
      await result.current.handleGeneratePack();
    });

    expect(setErrorMock).toHaveBeenCalledWith('clothingTransfer.ecomPack.inputError');
    expect(editImageMock).not.toHaveBeenCalled();
  });

  it('generates e-com pack bundle and saves results to gallery', async () => {
    const { result } = setupHook();

    act(() => {
      result.current.setSourceOutfitImage(mockImage('outfit'));
      result.current.setGarmentScope('top');
      result.current.handleCustomStagingUpload([mockImage('staging-wood')]);
    });

    await act(async () => {
      await result.current.handleGeneratePack();
    });

    expect(setErrorMock).toHaveBeenCalledWith(null);
    expect(result.current.packItems.length).toBeGreaterThan(0);
    expect(editImageMock).toHaveBeenCalled();
    expect(addImageMock).toHaveBeenCalledWith(
      expect.objectContaining({ base64: 'data-result-1' }),
      'clothing-transfer',
      'gemini',
    );
  });

  it('manages custom staging references upload and handles removal', () => {
    const { result } = setupHook();

    act(() => {
      result.current.handleCustomStagingUpload([mockImage('staging-1'), mockImage('staging-2')]);
    });

    expect(result.current.customStagingImages).toHaveLength(2);
    expect(result.current.selectedTemplateIds).toEqual(['custom-staging-0', 'custom-staging-1']);
    act(() => {
      result.current.handleRemoveCustomStaging(0);
    });

    expect(result.current.customStagingImages).toHaveLength(1);
    expect(result.current.selectedTemplateIds).not.toContain('custom-staging-0');
  });
  it('adds and removes custom brand models', () => {
    const { result } = setupHook();

    act(() => {
      result.current.handleAddCustomModel({
        name: 'Trang Muse',
        faceImage: mockImage('trang-face'),
        bodyImage: null,
      });
    });

    const added = result.current.brandModels.find((m) => m.name === 'Trang Muse');
    expect(added).toBeDefined();
    expect(result.current.selectedBrandModelIds).toContain(added!.id);

    act(() => {
      result.current.handleRemoveCustomModel(added!.id);
    });

    expect(result.current.brandModels.find((m) => m.name === 'Trang Muse')).toBeUndefined();
    expect(result.current.selectedBrandModelIds).not.toContain(added!.id);
  });

  it('analyzes outfit blueprint on source outfit upload', async () => {
    const analyzeMock = vi.fn().mockResolvedValue('Mock Blueprint: Top & Tiered Skirt');
    const { result } = renderHook(() =>
      useClothingTransferEComPack({
        driver: mockDriver,
        aspectRatio: '3:4',
        resolution: '1K',
        numImages: 1,
        imageEditModel: 'gemini-2.5-flash-image',
        textGenerateModel: 'gemini-3.8-flash',
        engineId: 'gemini',
        extraPrompt: '',
        addImage: addImageMock,
        setError: setErrorMock,
        t: (key) => key,
        analyzeOutfitBlueprintFn: analyzeMock,
      }),
    );

    await act(async () => {
      result.current.setSourceOutfitImage(mockImage('my-outfit'));
    });

    expect(analyzeMock).toHaveBeenCalledWith(
      expect.objectContaining({ base64: 'data-my-outfit' }),
      'gemini-3.8-flash',
    );
    expect(result.current.outfitBlueprint).toBe('Mock Blueprint: Top & Tiered Skirt');
  });
});
