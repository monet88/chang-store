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

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
};

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
        analyzeOutfitBlueprintFn: vi.fn().mockResolvedValue(''),
      }),
    );

  it('initializes with default garment scope and zero default selections', () => {
    const { result } = setupHook();

    expect(result.current.sourceOutfitImage).toBeNull();
    expect(result.current.selectedGarmentScopes).toEqual(['full-set']);
    expect(result.current.selectedBrandModelIds).toEqual([]);
    expect(result.current.selectedTemplateIds).toEqual([]);
    expect(result.current.customDestinations).toHaveLength(0);
    expect(result.current.packItems).toHaveLength(0);
  });

  it('manages brand model selection and template toggles', () => {
    const { result } = setupHook();

    act(() => {
      result.current.selectBrandModel('mai');
    });
    expect(result.current.selectedBrandModelIds).toEqual(['mai']);

    act(() => {
      result.current.selectBrandModel('mai');
    });
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

  it('supports selecting top and bottom together while other garment scopes remain exclusive', () => {
    const { result } = setupHook();

    act(() => {
      result.current.toggleGarmentScope('top');
      result.current.toggleGarmentScope('bottom');
    });
    expect(result.current.selectedGarmentScopes).toEqual(['top', 'bottom']);

    act(() => {
      result.current.toggleGarmentScope('dress');
    });
    expect(result.current.selectedGarmentScopes).toEqual(['dress']);
  });

  it('supports selecting multiple brand models', () => {
    const { result } = setupHook();

    act(() => {
      result.current.toggleBrandModel('linh');
      result.current.toggleBrandModel('mai');
    });

    expect(result.current.selectedBrandModelIds).toEqual(['linh', 'mai']);
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
      result.current.toggleGarmentScope('top');
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

  it('passes runtime canvas values into GPT Product Staging prompt config', async () => {
    const { result } = renderHook(() =>
      useClothingTransferEComPack({
        driver: mockDriver,
        aspectRatio: '16:9',
        resolution: '2K',
        numImages: 1,
        imageEditModel: 'gpt-image-1.5',
        engineId: 'gptImage',
        extraPrompt: '',
        addImage: addImageMock,
        setError: setErrorMock,
        t: (key) => key,
        analyzeOutfitBlueprintFn: vi.fn().mockResolvedValue(''),
      }),
    );

    await act(async () => {
      result.current.setSourceOutfitImage(mockImage('outfit'));
      result.current.handleCustomStagingUpload([mockImage('staging')]);
    });
    await act(async () => {
      await result.current.handleGeneratePack();
    });

    const request = editImageMock.mock.calls[0][0];
    const text = request.interleavedParts[0].text as string;
    expect(text).toContain('"aspect_ratio": "16:9"');
    expect(text).toContain('"resolution": "2K"');
  });

  it('uses the structured GPT Clothing Transfer prompt for custom destinations', async () => {
    const { result } = renderHook(() =>
      useClothingTransferEComPack({
        driver: mockDriver,
        aspectRatio: '3:4',
        resolution: '1K',
        numImages: 1,
        imageEditModel: 'gpt-image-1.5',
        engineId: 'gptImage',
        extraPrompt: '',
        addImage: addImageMock,
        setError: setErrorMock,
        t: (key) => key,
        analyzeOutfitBlueprintFn: vi.fn().mockResolvedValue('[CORE_GARMENTS]\nSilk blouse'),
      }),
    );

    await act(async () => {
      result.current.setSourceOutfitImage(mockImage('outfit'));
      result.current.handleCustomDestinationsUpload([mockImage('destination')]);
    });
    await act(async () => {
      await result.current.handleGeneratePack();
    });

    const request = editImageMock.mock.calls[0][0];
    const text = request.interleavedParts[0].text as string;
    expect(text).toContain('/* CLOTHING_TRANSFER_CONFIG */');
    expect(text).toContain('"AI_SCAN_BLUEPRINT"');
  });

  it('manages custom staging references upload and handles removal', () => {
    const { result } = setupHook();

    act(() => {
      result.current.handleCustomStagingUpload([mockImage('staging-1'), mockImage('staging-2')]);
    });

    expect(result.current.customStagingImages).toHaveLength(2);
    expect(result.current.selectedTemplateIds).toEqual([
      'custom-staging-flat-lay-0',
      'custom-staging-flat-lay-1',
    ]);
    act(() => {
      result.current.handleRemoveCustomStaging(0);
    });

    expect(result.current.customStagingImages).toHaveLength(1);
    expect(result.current.selectedTemplateIds).not.toContain('custom-staging-flat-lay-0');
  });

  it('keeps custom hanger and flat-lay image templates independent', () => {
    const { result } = setupHook();

    act(() => {
      result.current.handleCustomStagingUpload([mockImage('flat')], 'flat-lay');
      result.current.handleCustomStagingUpload([mockImage('hanger')], 'hanger');
    });

    const customImages = result.current.displayTemplates.filter((template) => template.modality === 'image');
    expect(customImages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'custom-staging-flat-lay-0', category: 'flat-lay' }),
        expect.objectContaining({ id: 'custom-staging-hanger-0', category: 'hanger' }),
      ]),
    );
    expect(result.current.customStagingImages).toHaveLength(2);
  });

  it('adds persistent custom text display templates', () => {
    const { result } = setupHook();

    act(() => {
      result.current.handleAddTextTemplate({
        name: 'Soft Linen',
        category: 'flat-lay',
        prompt: 'Soft ivory linen with daylight',
      });
    });

    const added = result.current.displayTemplates.find((template) => template.name === 'Soft Linen');
    expect(added).toEqual(expect.objectContaining({
      category: 'flat-lay',
      modality: 'text',
      prompt: 'Soft ivory linen with daylight',
    }));
    expect(result.current.selectedTemplateIds).toContain(added!.id);
  });
  it('adds and removes custom brand models', () => {
    const { result } = setupHook();

    act(() => {
      result.current.handleAddCustomModel({
        name: 'Trang Muse',
        faceImage: mockImage('trang-face'),
        bodyImage: mockImage('trang-body'),
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

  it('updates and persists an existing brand model profile', () => {
    const { result } = setupHook();

    act(() => {
      result.current.handleUpdateBrandModel('linh', {
        metadata: { height: '1m70', skinTone: 'warm ivory' },
      });
    });

    const linh = result.current.brandModels.find((model) => model.id === 'linh');
    expect(linh?.metadata.height).toBe('1m70');
    expect(linh?.metadata.skinTone).toBe('warm ivory');
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

  it('does not label a new source outfit with an earlier analysis still in flight', async () => {
    const firstDeferred = createDeferred<string>();
    const analyzeMock = vi.fn()
      .mockReturnValueOnce(firstDeferred.promise)
      .mockResolvedValueOnce('Blueprint for outfit 2');

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

    // 1. Upload outfit 1 -> starts first analysis (in flight)
    act(() => {
      result.current.setSourceOutfitImage(mockImage('outfit-1'));
    });
    expect(result.current.isAnalyzingOutfit).toBe(true);

    // 2. Quickly replace with outfit 2 before first analysis resolves
    await act(async () => {
      result.current.setSourceOutfitImage(mockImage('outfit-2'));
    });
    expect(result.current.outfitBlueprint).toBe('Blueprint for outfit 2');

    // 3. Stale first analysis finishes later -> must not overwrite outfit 2's blueprint
    await act(async () => {
      firstDeferred.resolve('Stale blueprint for outfit 1');
    });

    expect(result.current.outfitBlueprint).toBe('Blueprint for outfit 2');
  });

  it('plans product display assets, brand models, and custom destinations into separate pack cards', async () => {
    const { result } = setupHook();

    act(() => {
      result.current.setSourceOutfitImage(mockImage('outfit'));
      result.current.handleCustomStagingUpload([mockImage('staging-1'), mockImage('staging-2')]);
      result.current.selectBrandModel('mai');
      result.current.handleCustomDestinationsUpload([mockImage('dest-1'), mockImage('dest-2')]);
    });

    await act(async () => {
      await result.current.handleGeneratePack();
    });

    expect(result.current.packItems).toHaveLength(5);
    expect(result.current.packItems.map((item) => item.category)).toEqual([
      'product',
      'product',
      'brand-models',
      'custom-destinations',
      'custom-destinations',
    ]);
    expect(result.current.packItems.map((item) => item.id)).toEqual([
      'template-custom-staging-flat-lay-0',
      'template-custom-staging-flat-lay-1',
      'brand-mai',
      'custom-0',
      'custom-1',
    ]);
    expect(result.current.packItems[2].title).toBe('Mai');
    expect(editImageMock).toHaveBeenCalledTimes(5);
  });

  it('plans one product target per selected top/bottom scope', async () => {
    const { result } = setupHook();

    act(() => {
      result.current.setSourceOutfitImage(mockImage('outfit'));
      result.current.toggleGarmentScope('top');
      result.current.toggleGarmentScope('bottom');
      result.current.handleCustomStagingUpload([mockImage('staging')]);
    });

    await act(async () => {
      await result.current.handleGenerateCategory('product');
    });

    expect(result.current.packItems.map((item) => item.id)).toEqual([
      expect.stringContaining('top'),
      expect.stringContaining('bottom'),
    ]);
    expect(editImageMock).toHaveBeenCalledTimes(2);
  });

  it('keeps top and bottom as separate source scopes for custom destinations', async () => {
    const { result } = setupHook();

    act(() => {
      result.current.setSourceOutfitImage(mockImage('outfit'));
      result.current.toggleGarmentScope('top');
      result.current.toggleGarmentScope('bottom');
      result.current.handleCustomDestinationsUpload([mockImage('destination')]);
    });

    await act(async () => {
      await result.current.handleGenerateCategory('custom-destinations');
    });

    const request = editImageMock.mock.calls[0][0];
    const promptText = request.interleavedParts
      .map((part: { text?: string }) => part.text || '')
      .join('\n');
    expect(promptText).toContain('top garment');
    expect(promptText).toContain('bottom garment');
    expect(promptText).not.toContain('entire fashion outfit');
  });

  it('generates one category without discarding completed sibling categories', async () => {
    const { result } = setupHook();

    act(() => {
      result.current.setSourceOutfitImage(mockImage('outfit'));
      result.current.handleCustomStagingUpload([mockImage('staging')]);
      result.current.handleCustomDestinationsUpload([mockImage('destination')]);
    });

    editImageMock
      .mockResolvedValueOnce([mockImage('product-initial')])
      .mockResolvedValueOnce([mockImage('destination-initial')]);
    await act(async () => {
      await result.current.handleGeneratePack();
    });

    const destinationBefore = result.current.packItems.find((item) => item.category === 'custom-destinations');
    editImageMock.mockClear();
    editImageMock.mockResolvedValueOnce([mockImage('product-refreshed')]);

    await act(async () => {
      await result.current.handleGenerateCategory('product');
    });

    expect(editImageMock).toHaveBeenCalledTimes(1);
    expect(result.current.packItems.find((item) => item.category === 'custom-destinations')?.results)
      .toEqual(destinationBefore?.results);
    expect(result.current.packItems.find((item) => item.category === 'product')?.results)
      .toEqual([mockImage('product-refreshed')]);
  });

  it('caps pack generation concurrency to ten concurrent requests', async () => {
    const deferredResults = Array.from({ length: 12 }, () => createDeferred<ImageFile[]>());
    let activeRequests = 0;
    let maxActiveRequests = 0;
    let callIndex = 0;

    editImageMock.mockImplementation(() => {
      const currentCall = callIndex++;
      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);

      return deferredResults[currentCall].promise.finally(() => {
        activeRequests -= 1;
      });
    });

    const { result } = setupHook();

    act(() => {
      result.current.setSourceOutfitImage(mockImage('outfit'));
      result.current.handleCustomStagingUpload([
        mockImage('s1'),
        mockImage('s2'),
        mockImage('s3'),
        mockImage('s4'),
      ], 'flat-lay');
      result.current.handleCustomStagingUpload([
        mockImage('h1'),
        mockImage('h2'),
        mockImage('h3'),
        mockImage('h4'),
      ], 'hanger');
      result.current.handleCustomDestinationsUpload([
        mockImage('d1'),
        mockImage('d2'),
        mockImage('d3'),
        mockImage('d4'),
      ]);
    });

    const generatePromise = act(async () => {
      await result.current.handleGeneratePack();
    });

    await vi.waitFor(() => {
      expect(editImageMock).toHaveBeenCalledTimes(10);
    });

    deferredResults.forEach(({ resolve }, index) => {
      resolve([mockImage(`res-${index}`)]);
    });

    await generatePromise;
    expect(maxActiveRequests).toBe(10);
    expect(editImageMock).toHaveBeenCalledTimes(12);
    expect(result.current.packItems.every((item) => item.status === 'completed')).toBe(true);
  });

  it('consumes active blueprint and passes it to the active model-family prompt policy', async () => {
    const blueprintText = '[CORE_GARMENTS]\nSilk organza blouse with scalloped hem\n\n[TEXTILE_PHYSICS]\nCrisp structured sheen with soft gravity drape';
    const analyzeMock = vi.fn().mockResolvedValue(blueprintText);

    const { result } = renderHook(() =>
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
        analyzeOutfitBlueprintFn: analyzeMock,
      }),
    );

    act(() => {
      result.current.setSourceOutfitImage(mockImage('outfit'));
      result.current.handleCustomStagingUpload([mockImage('staging-wood')]);
    });

    await act(async () => {
      await result.current.handleGeneratePack();
    });

    const request = editImageMock.mock.calls[0][0];
    const text = request.interleavedParts.find((part: { text?: string }) =>
      part.text?.includes('LAYER 3: GARMENT BLUEPRINT'),
    )?.text;
    expect(text).toContain('Silk organza blouse with scalloped hem');
  });

  it('retains successful sibling pack items when one item generation fails', async () => {
    editImageMock
      .mockRejectedValueOnce(new Error('Staging generation failed'))
      .mockResolvedValueOnce([mockImage('model-res')])
      .mockResolvedValueOnce([mockImage('dest-res')]);

    const { result } = setupHook();

    act(() => {
      result.current.setSourceOutfitImage(mockImage('outfit'));
      result.current.handleCustomStagingUpload([mockImage('staging-1')]);
      result.current.selectBrandModel('mai');
      result.current.handleCustomDestinationsUpload([mockImage('dest-1')]);
    });

    await act(async () => {
      await result.current.handleGeneratePack();
    });

    expect(result.current.packItems).toHaveLength(3);
    expect(result.current.packItems[0].status).toBe('error');
    expect(result.current.packItems[0].error).toBe('Staging generation failed');
    expect(result.current.packItems[1].status).toBe('completed');
    expect(result.current.packItems[1].results).toEqual([mockImage('model-res')]);
    expect(result.current.packItems[2].status).toBe('completed');
    expect(result.current.packItems[2].results).toEqual([mockImage('dest-res')]);
    expect(addImageMock).toHaveBeenCalledTimes(2);
  });

  it('regenerate-one reruns only the selected pack item using its exact planned definition and active blueprint', async () => {
    editImageMock
      .mockResolvedValueOnce([mockImage('res-staging')])
      .mockResolvedValueOnce([mockImage('res-dest')])
      .mockResolvedValueOnce([mockImage('res-dest-regenerated')]);

    const analyzeMock = vi.fn().mockResolvedValue('[CORE_GARMENTS]\nOriginal Linen Dress');

    const { result } = renderHook(() =>
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
        analyzeOutfitBlueprintFn: analyzeMock,
      }),
    );

    act(() => {
      result.current.setSourceOutfitImage(mockImage('outfit'));
      result.current.handleCustomStagingUpload([mockImage('staging-1')]);
      result.current.handleCustomDestinationsUpload([mockImage('dest-1')]);
    });

    await act(async () => {
      await result.current.handleGeneratePack();
    });

    expect(editImageMock).toHaveBeenCalledTimes(2);
    expect(result.current.packItems[0].results).toEqual([mockImage('res-staging')]);
    expect(result.current.packItems[1].results).toEqual([mockImage('res-dest')]);

    // Update blueprint actively before regenerate
    const updatedBlueprint = '[CORE_GARMENTS]\nUpdated Cotton Tunic';
    act(() => {
      result.current.setOutfitBlueprint(updatedBlueprint);
    });

    const destinationItemId = result.current.packItems[1].id;

    await act(async () => {
      await result.current.handleRegeneratePackItem(destinationItemId);
    });

    // Exactly one extra call for the targeted item only
    expect(editImageMock).toHaveBeenCalledTimes(3);

    // Item 0 is untouched
    expect(result.current.packItems[0].results).toEqual([mockImage('res-staging')]);
    expect(result.current.packItems[0].status).toBe('completed');

    // Item 1 was updated
    expect(result.current.packItems[1].results).toEqual([mockImage('res-dest-regenerated')]);
    expect(result.current.packItems[1].status).toBe('completed');

    // 3rd call used the active updated blueprint
    const thirdCallParts = editImageMock.mock.calls[2][0].interleavedParts;
    const thirdCallText = thirdCallParts.find((part: { text?: string }) =>
      part.text?.includes('TASK: Replace the clothing'),
    )?.text;
    expect(thirdCallText).toContain('Updated Cotton Tunic');
  });

  it('regenerates a planned custom destination using its captured image even after destination is removed from form state', async () => {
    editImageMock
      .mockResolvedValueOnce([mockImage('dest-initial')])
      .mockResolvedValueOnce([mockImage('dest-retry')]);

    const { result } = setupHook();

    act(() => {
      result.current.setSourceOutfitImage(mockImage('outfit'));
      result.current.handleCustomDestinationsUpload([mockImage('captured-target-dest')]);
    });

    await act(async () => {
      await result.current.handleGeneratePack();
    });

    expect(result.current.packItems).toHaveLength(1);
    const itemId = result.current.packItems[0].id;

    // Remove custom destination from form selection
    act(() => {
      result.current.handleRemoveCustomDestination(0);
    });
    expect(result.current.customDestinations).toHaveLength(0);

    // Regenerate the item; it must use its captured target definition rather than failing
    await act(async () => {
      await result.current.handleRegeneratePackItem(itemId);
    });

    expect(editImageMock).toHaveBeenCalledTimes(2);
    expect(result.current.packItems[0].status).toBe('completed');
    expect(result.current.packItems[0].results).toEqual([mockImage('dest-retry')]);

    // Verify the second call still sent the original destination image
    const secondCallParts = editImageMock.mock.calls[1][0].interleavedParts;
    const destImagePart = secondCallParts.find(
      (part: { inlineData?: { data?: string } }) =>
        part.inlineData?.data === 'data-captured-target-dest',
    );
    expect(destImagePart).toBeDefined();
  });

  it('handleRegeneratePackItem is a no-op for nonexistent item id', async () => {
    const { result } = setupHook();

    act(() => {
      result.current.setSourceOutfitImage(mockImage('outfit'));
      result.current.handleCustomDestinationsUpload([mockImage('d1')]);
    });

    await act(async () => {
      await result.current.handleGeneratePack();
    });

    expect(editImageMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.handleRegeneratePackItem('nonexistent-id');
    });

    expect(editImageMock).toHaveBeenCalledTimes(1);
  });
});
