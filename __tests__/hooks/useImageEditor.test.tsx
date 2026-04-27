import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/imageEditingService', () => ({
  editImage: vi.fn(),
  generateImage: vi.fn(),
}));

vi.mock('@/utils/imageUtils', () => ({
  getErrorMessage: vi.fn((error: Error) => error.message),
}));

import { useImageEditorServiceActions } from '@/hooks/useImageEditor';
import { editImage, generateImage } from '@/services/imageEditingService';
import { ImageFile } from '@/types';

const SOURCE_IMAGE: ImageFile = { base64: 'source-image', mimeType: 'image/png' };
const RESULT_IMAGE: ImageFile = { base64: 'result-image', mimeType: 'image/png' };
const GENERATED_IMAGE: ImageFile = { base64: 'generated-image', mimeType: 'image/png' };

const originalPath2D = globalThis.Path2D;
const originalDomMatrix = globalThis.DOMMatrix;

class Path2DStub {
  addPath = vi.fn();
}

class DOMMatrixStub {
  translate = vi.fn(() => this);
  scale = vi.fn(() => this);
}

const canvasContext = {
  fillStyle: '',
  fillRect: vi.fn(),
  fill: vi.fn(),
};

const createParams = (overrides: Partial<Parameters<typeof useImageEditorServiceActions>[0]> = {}) => ({
  isLoading: false,
  currentImage: SOURCE_IMAGE,
  selectionPath: null,
  getCanvasAndImageMetrics: vi.fn(() => ({ dx: 0, dy: 0, scale: 1, iw: 10, ih: 10 })),
  imageEditModel: 'gemini-2.5-flash-image',
  imageGenerateModel: 'imagen-4.0-generate-001',
  t: vi.fn((key: string, params?: Record<string, unknown>) => {
    const prompts: Record<string, string> = {
      'imageEditor.modal.apiPrompts.aiEditFull': 'full {{prompt}}',
      'imageEditor.modal.apiPrompts.aiEditMasked': 'masked {{prompt}}',
      'imageEditor.modal.apiPrompts.removeBackground': 'remove background',
      'imageEditor.modal.apiPrompts.removeBackgroundMasked': 'remove background masked',
      'imageEditor.modal.loading.performingAction': 'Performing: {{action}}...',
      'imageEditor.modal.loading.generatingNewImage': 'Generating new image...',
    };
    return Object.entries(params ?? {}).reduce(
      (prompt, [paramKey, value]) => prompt.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(value)),
      prompts[key] ?? key,
    );
  }),
  setIsLoading: vi.fn(),
  setError: vi.fn(),
  setLoadingMessage: vi.fn(),
  addToHistory: vi.fn(),
  handleDeselect: vi.fn(),
  loadNewImage: vi.fn(),
  setView: vi.fn(),
  ...overrides,
});

describe('useImageEditorServiceActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.Path2D = Path2DStub as unknown as typeof Path2D;
    globalThis.DOMMatrix = DOMMatrixStub as unknown as typeof DOMMatrix;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,mask-image');
    vi.mocked(editImage).mockResolvedValue([RESULT_IMAGE]);
    vi.mocked(generateImage).mockResolvedValue([GENERATED_IMAGE]);
  });

  afterEach(() => {
    globalThis.Path2D = originalPath2D;
    globalThis.DOMMatrix = originalDomMatrix;
    vi.restoreAllMocks();
  });

  it('sends masked AI edit prompt with generated mask image', async () => {
    const selectionPath = new Path2D();
    const params = createParams({ selectionPath });
    const { result } = renderHook(() => useImageEditorServiceActions(params));

    await act(async () => {
      await result.current.handleGenerateAIEdit('add a hat');
    });

    expect(editImage).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [
          SOURCE_IMAGE,
          expect.objectContaining({ mimeType: 'image/png' }),
        ],
        prompt: 'masked add a hat',
        numberOfImages: 1,
      }),
      'gemini-2.5-flash-image',
      expect.objectContaining({ onStatusUpdate: expect.any(Function) }),
    );
  });

  it('falls back to unmasked prompt when mask creation fails', async () => {
    const selectionPath = new Path2D();
    const params = createParams({
      selectionPath,
      getCanvasAndImageMetrics: vi.fn(() => null),
    });
    const { result } = renderHook(() => useImageEditorServiceActions(params));

    await act(async () => {
      await result.current.handleGenerateAIEdit('add a hat');
    });

    expect(editImage).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [SOURCE_IMAGE],
        prompt: 'full add a hat',
      }),
      'gemini-2.5-flash-image',
      expect.any(Object),
    );
  });

  it('preserves dollar replacement syntax in user prompts', async () => {
    const params = createParams();
    const { result } = renderHook(() => useImageEditorServiceActions(params));

    await act(async () => {
      await result.current.handleGenerateAIEdit('change price to $& and keep $100');
    });

    expect(editImage).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'full change price to $& and keep $100',
      }),
      'gemini-2.5-flash-image',
      expect.any(Object),
    );
  });

  it('uses localized loading messages for edit actions', async () => {
    const params = createParams();
    const { result } = renderHook(() => useImageEditorServiceActions(params));

    await act(async () => {
      await result.current.performApiAction('removeBackground');
    });

    expect(params.setLoadingMessage).toHaveBeenCalledWith('Performing: removeBackground...');
  });

  it('uses localized loading messages for text-to-image generation', async () => {
    const params = createParams({ currentImage: null });
    const { result } = renderHook(() => useImageEditorServiceActions(params));

    await act(async () => {
      await result.current.handleGenerateAIEdit('new editorial scene');
    });

    expect(params.setLoadingMessage).toHaveBeenCalledWith('Generating new image...');
  });

  it('does not start text-to-image generation while already loading', async () => {
    const params = createParams({
      isLoading: true,
      currentImage: null,
    });
    const { result } = renderHook(() => useImageEditorServiceActions(params));

    await act(async () => {
      await result.current.handleGenerateAIEdit('new editorial scene');
    });

    expect(generateImage).not.toHaveBeenCalled();
    expect(params.setIsLoading).not.toHaveBeenCalled();
  });
});
