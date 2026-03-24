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

vi.mock('../../src/components/shared/ImageBatchSessionRail', () => ({
  default: () => <div>session-rail</div>,
}));

import ClothingTransfer from '../../src/components/ClothingTransfer';

const baseHookState = {
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
};

describe('ClothingTransfer component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useClothingTransferMock.mockReturnValue(baseHookState);
  });

  it('renders the multi-concept uploader and disables generate when inputs are incomplete', () => {
    render(<ClothingTransfer />);

    expect(screen.getByText('clothingTransfer.conceptImagesTitle')).toBeInTheDocument();
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
    expect(screen.getByText('session-rail')).toBeInTheDocument();
    expect(screen.getByText('clothingTransfer.conceptBatchLabel')).toBeInTheDocument();
    expect(screen.getByText('generatedImage.altText 1')).toBeInTheDocument();
  });
});
