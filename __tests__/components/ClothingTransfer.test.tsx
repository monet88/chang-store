import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

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
  default: ({ altText }: { altText: string }) => <div>{altText}</div>,
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
    garmentScope: 'full-set' as const,
    setGarmentScope: vi.fn(),
    outfitBlueprint: null,
    isAnalyzingOutfit: false,
    setOutfitBlueprint: vi.fn(),
    handleReanalyzeOutfit: vi.fn(),
    brandModels: [],
    selectedBrandModelId: null,
    selectedBrandModelIds: [],
    selectBrandModel: vi.fn(),
    toggleBrandModel: vi.fn(),
    handleAddCustomModel: vi.fn(),
    handleRemoveCustomModel: vi.fn(),
    isCustomBrandModel: vi.fn().mockReturnValue(false),
    displayTemplates: [],
    selectedTemplateIds: [],
    toggleDisplayTemplate: vi.fn(),
    customStagingImages: [],
    handleCustomStagingUpload: vi.fn(),
    handleRemoveCustomStaging: vi.fn(),
    customDestinations: [],
    handleCustomDestinationsUpload: vi.fn(),
    handleRemoveCustomDestination: vi.fn(),
    packItems: [],
    isGenerating: false,
    handleGeneratePack: vi.fn(),
    handleRegeneratePackItem: vi.fn(),
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
});
