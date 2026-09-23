import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const useClothingTransferMock = vi.fn();

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../src/hooks/useClothingTransfer', () => ({
  useClothingTransfer: () => useClothingTransferMock(),
}));

vi.mock('../../src/components/ImageUploader', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('../../src/components/MultiImageUploader', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('../../src/components/Spinner', () => ({
  default: () => <div>spinner</div>,
}));

vi.mock('../../src/components/HoverableImage', () => ({
  default: ({ altText, onUpscale, onSendToFeature }: { altText: string; onUpscale?: () => void; onSendToFeature?: () => void }) => (
    <div>
      {altText}
      {onUpscale && <button onClick={onUpscale}>mock-upscale</button>}
      {onSendToFeature && <button onClick={onSendToFeature}>mock-send-to-feature</button>}
    </div>
  ),
}));

vi.mock('../../src/components/shared/ResultPlaceholder', () => ({
  default: ({ description }: { description: string }) => <div>{description}</div>,
}));

vi.mock('../../src/components/ImageOptionsPanel', () => ({
  default: () => <div>image-options</div>,
}));
vi.mock('../../src/components/studios/GptImageOptionsPanel', () => ({
  default: () => <div>gpt-image-options</div>,
}));

import ClothingTransfer from '../../src/components/ClothingTransfer';

const setModeMock = vi.fn();

const baseHookState = {
  mode: 'classic' as const,
  setMode: setModeMock,
  ecomPack: {
    sourceOutfitImage: null,
    setSourceOutfitImage: vi.fn(),
    selectedGarmentScopes: ['full-set'],
    toggleGarmentScope: vi.fn(),
    outfitBlueprint: null,
    isAnalyzingOutfit: false,
    setOutfitBlueprint: vi.fn(),
    handleReanalyzeOutfit: vi.fn(),
    brandModels: [],
    selectedBrandModelIds: [],
    selectBrandModel: vi.fn(),
    toggleBrandModel: vi.fn(),
    handleAddCustomModel: vi.fn(),
    handleUpdateBrandModel: vi.fn(),
    handleRemoveCustomModel: vi.fn(),
    isCustomBrandModel: vi.fn().mockReturnValue(false),
    displayTemplates: [],
    selectedTemplateIds: [],
    toggleDisplayTemplate: vi.fn(),
    handleAddTextTemplate: vi.fn(),
    handleRemoveDisplayTemplate: vi.fn(),
    customStagingImages: [],
    handleCustomStagingUpload: vi.fn(),
    handleRemoveCustomStaging: vi.fn(),
    customDestinations: [],
    handleCustomDestinationsUpload: vi.fn(),
    handleRemoveCustomDestination: vi.fn(),
    packItems: [],
    isGenerating: false,
    handleGeneratePack: vi.fn(),
    handleGenerateCategory: vi.fn(),
    handleRegeneratePackItem: vi.fn(),
    handleUpscale: vi.fn(),
    handleRefine: vi.fn(),
    handleDownloadAll: vi.fn(),
    refinePrompts: {},
    setRefinePrompts: vi.fn(),
    isRefining: {},
    upscalingStates: {},
  },
  referenceItems: [{ id: 1, image: null, label: '' }],
  conceptItems: [],
  conceptImages: [],
  selectedConceptItemId: null,
  setSelectedConceptItemId: vi.fn(),
  activeConceptItem: null,
  extraPrompt: '',
  numImages: 1,
  aspectRatio: 'Default',
  resolution: '1K',
  isLoading: false,
  loadingMessage: '',
  error: null,
  upscalingStates: {},
  setExtraPrompt: vi.fn(),
  setNumImages: vi.fn(),
  setAspectRatio: vi.fn(),
  setResolution: vi.fn(),
  setError: vi.fn(),
  handleReferenceUpload: vi.fn(),
  handleReferenceLabel: vi.fn(),
  addReference: vi.fn(),
  removeReference: vi.fn(),
  handleConceptImagesUpload: vi.fn(),
  handleGenerate: vi.fn(),
  handleUpscale: vi.fn(),
  handleRefine: vi.fn(),
  completedCount: 0,
  failedCount: 0,
  canGenerate: false,
  anyUpscaling: false,
  imageEditModel: 'gemini-2.5-flash-image',
  refinePrompts: {},
  setRefinePrompts: vi.fn(),
  isRefining: {},
  engineId: 'gemini' as const,
};
describe('ClothingTransfer component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useClothingTransferMock.mockReturnValue(baseHookState);
  });

  it('renders the multi-concept uploader and disables generate when inputs are incomplete', () => {
    render(<ClothingTransfer />);

    expect(screen.getAllByText('clothingTransfer.conceptImagesTitle').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'clothingTransfer.generateButton' })).toBeDisabled();
    expect(screen.getByText('clothingTransfer.outputPanelDescription')).toBeInTheDocument();
  });

  it('renders batch results when concept items exist', () => {
    useClothingTransferMock.mockReturnValue({
      ...baseHookState,
      canGenerate: true,
      conceptItems: [
        {
          id: 'ct-1',
          conceptImage: { base64: 'concept', mimeType: 'image/png' },
          status: 'completed',
          results: [{ base64: 'result', mimeType: 'image/png' }],
        },
      ],
      conceptImages: [{ base64: 'concept', mimeType: 'image/png' }],
      selectedConceptItemId: 'ct-1',
      activeConceptItem: {
        id: 'ct-1',
        conceptImage: { base64: 'concept', mimeType: 'image/png' },
        status: 'completed',
        results: [{ base64: 'result', mimeType: 'image/png' }],
      },
      completedCount: 1,
    });

    render(<ClothingTransfer />);

    expect(screen.getByRole('button', { name: 'clothingTransfer.generateButton' })).toBeEnabled();
    expect(screen.getByText('clothingTransfer.batchResultsTitle')).toBeInTheDocument();
    expect(screen.getByText('clothingTransfer.conceptBatchLabel - generatedImage.altText 1')).toBeInTheDocument();
  });

  it('renders mode switch and switches to E-Com Pack mode', () => {
    useClothingTransferMock.mockReturnValue({
      ...baseHookState,
      mode: 'ecom-pack',
    });

    render(<ClothingTransfer />);

    expect(screen.getByText('clothingTransfer.modes.classic')).toBeInTheDocument();
    expect(screen.getByText('clothingTransfer.modes.ecomPack')).toBeInTheDocument();
    expect(screen.getByText('clothingTransfer.ecomPack.sourceTitle')).toBeInTheDocument();
    expect(screen.getByText('clothingTransfer.ecomPack.generateButton')).toBeInTheDocument();
  });

  it('renders Gemini generation controls in Gemini Studio Mode', () => {
    render(<ClothingTransfer />);

    expect(screen.getByText('image-options')).toBeInTheDocument();
    expect(screen.queryByText('gpt-image-options')).not.toBeInTheDocument();
    expect(screen.getByText('clothingTransfer.numberOfImages')).toBeInTheDocument();
  });

  it('renders GPT generation controls through the same shared UI in GPT Studio Mode', () => {
    useClothingTransferMock.mockReturnValue({
      ...baseHookState,
      engineId: 'gptImage',
    });

    render(<ClothingTransfer />);

    expect(screen.getByText('gpt-image-options')).toBeInTheDocument();
    expect(screen.queryByText('image-options')).not.toBeInTheDocument();
    expect(screen.queryByText('clothingTransfer.numberOfImages')).not.toBeInTheDocument();
  });

  it('renders GPT generation controls in the shared E-Com Pack workflow', () => {
    useClothingTransferMock.mockReturnValue({
      ...baseHookState,
      engineId: 'gptImage',
      mode: 'ecom-pack',
    });

    render(<ClothingTransfer />);

    expect(screen.getByText('gpt-image-options')).toBeInTheDocument();
    expect(screen.queryByText('image-options')).not.toBeInTheDocument();
    expect(screen.getByText('clothingTransfer.ecomPack.sourceTitle')).toBeInTheDocument();
  });

  it('exposes E-Com Pack templates, category generation, multi-model selection, and result actions', () => {
    const handleGenerateCategory = vi.fn();
    const handleUpscale = vi.fn();
    const handleDownloadAll = vi.fn();
    useClothingTransferMock.mockReturnValue({
      ...baseHookState,
      mode: 'ecom-pack',
      ecomPack: {
        ...baseHookState.ecomPack,
        sourceOutfitImage: { base64: 'source', mimeType: 'image/png' },
        brandModels: [
          {
            id: 'linh',
            name: 'Linh',
            metadata: { age: 22, height: '1m66', weight: '48kg', bodyType: '', skinTone: '', facialFeatures: '', styleVibe: '' },
            faceImage: null,
            bodyImage: null,
          },
          {
            id: 'mai',
            name: 'Mai',
            metadata: { age: 20, height: '1m62', weight: '47kg', bodyType: '', skinTone: '', facialFeatures: '', styleVibe: '' },
            faceImage: null,
            bodyImage: null,
          },
        ],
        selectedBrandModelIds: ['linh', 'mai'],
        displayTemplates: [
          { id: 'hanger', name: 'Clean Studio Hanger', category: 'hanger', modality: 'text', prompt: 'clean hanger' },
        ],
        selectedTemplateIds: ['hanger'],
        packItems: [
          {
            id: 'template-hanger',
            category: 'product',
            title: 'Clean Studio Hanger',
            status: 'completed',
            results: [{ base64: 'result', mimeType: 'image/png' }],
          },
        ],
        handleGenerateCategory,
        handleUpscale,
        handleDownloadAll,
      },
    });

    render(<ClothingTransfer />);

    expect(screen.getAllByText('Clean Studio Hanger').length).toBeGreaterThan(0);
    expect(screen.getByText('Linh')).toBeInTheDocument();
    expect(screen.getByText('Mai')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'clothingTransfer.ecomPack.generateProduct' }));
    expect(handleGenerateCategory).toHaveBeenCalledWith('product');
    fireEvent.click(screen.getByRole('button', { name: 'imageActions.upscale 4K' }));
    expect(handleUpscale).toHaveBeenCalledWith(
      { base64: 'result', mimeType: 'image/png' },
      0,
      'template-hanger',
      '4K',
    );
    fireEvent.click(screen.getByRole('button', { name: 'clothingTransfer.ecomPack.downloadAll' }));
    expect(handleDownloadAll).toHaveBeenCalled();
  });

  it('hides aspect/resolution and image count slider when engineId is localQwen', () => {
    useClothingTransferMock.mockReturnValue({
      ...baseHookState,
      engineId: 'localQwen',
    });

    render(<ClothingTransfer />);

    expect(screen.queryByText('image-options')).not.toBeInTheDocument();
    expect(screen.queryByText('gpt-image-options')).not.toBeInTheDocument();
    expect(screen.queryByText('clothingTransfer.numberOfImages')).not.toBeInTheDocument();
  });

  it('gates Send to Photo Album action when engineId is localQwen', () => {
    const onSendToFeature = vi.fn();
    const completedConcept = {
      id: 'c1',
      conceptImage: { base64: 'concept', mimeType: 'image/png' },
      results: [{ base64: 'result', mimeType: 'image/png' }],
    };

    // 1. Under localQwen: Send to Photo Album must NOT be exposed
    useClothingTransferMock.mockReturnValue({
      ...baseHookState,
      engineId: 'localQwen',
      conceptItems: [completedConcept],
    });

    const { rerender } = render(<ClothingTransfer onSendToFeature={onSendToFeature} />);
    expect(screen.queryByText('mock-send-to-feature')).not.toBeInTheDocument();

    // 2. Under gemini: Send to Photo Album IS exposed
    useClothingTransferMock.mockReturnValue({
      ...baseHookState,
      engineId: 'gemini',
      conceptItems: [completedConcept],
    });

    rerender(<ClothingTransfer onSendToFeature={onSendToFeature} />);
    expect(screen.getByText('mock-send-to-feature')).toBeInTheDocument();
    fireEvent.click(screen.getByText('mock-send-to-feature'));
    expect(onSendToFeature).toHaveBeenCalledWith('photo-album', { base64: 'result', mimeType: 'image/png' });
  });
});
