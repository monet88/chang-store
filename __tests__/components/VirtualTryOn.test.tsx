import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const useVirtualTryOnMock = vi.fn();

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../src/hooks/useVirtualTryOn', () => ({
  useVirtualTryOn: () => useVirtualTryOnMock(),
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

vi.mock('../../src/components/Tooltip', () => ({
  default: ({ children }: { children: unknown }) => <>{children}</>,
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

import VirtualTryOn from '../../src/components/VirtualTryOn';

const baseHookState = {
  subjectItems: [],
  subjectImages: [],
  selectedSubjectItemId: null,
  setSelectedSubjectItemId: vi.fn(),
  activeSubjectItem: null,
  clothingItems: [{ id: 1, image: null }],
  backgroundPrompt: '',
  setBackgroundPrompt: vi.fn(),
  extraPrompt: '',
  setExtraPrompt: vi.fn(),
  numImages: 1,
  setNumImages: vi.fn(),
  aspectRatio: 'Default',
  setAspectRatio: vi.fn(),
  resolution: '1K',
  setResolution: vi.fn(),
  isLoading: false,
  upscalingStates: {},
  loadingMessage: '',
  error: null,
  setError: vi.fn(),
  completedCount: 0,
  failedCount: 0,
  canGenerate: false,
  handleGenerateImage: vi.fn(),
  handleUpscale: vi.fn(),
  handleRefine: vi.fn(),
  handleSubjectImagesUpload: vi.fn(),
  handleClothingUpload: vi.fn(),
  addClothingUploader: vi.fn(),
  removeClothingUploader: vi.fn(),
  anyUpscaling: false,
  imageEditModel: 'gemini-2.5-flash-image',
  refinePrompts: {},
  setRefinePrompts: vi.fn(),
  isRefining: {},
};

describe('VirtualTryOn component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useVirtualTryOnMock.mockReturnValue(baseHookState);
  });

  it('renders the multi-subject uploader and disables generate when batch input is incomplete', () => {
    render(<VirtualTryOn />);

    expect(screen.getByText('virtualTryOn.subjectImagesTitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'virtualTryOn.generateButton' })).toBeDisabled();
    expect(screen.getByText('virtualTryOn.outputPanelDescription')).toBeInTheDocument();
  });

  it('renders batch results when subject items exist', () => {
    useVirtualTryOnMock.mockReturnValue({
      ...baseHookState,
      canGenerate: true,
      subjectItems: [
        {
          id: 'vto-1',
          subjectImage: { base64: 'subject', mimeType: 'image/png' },
          status: 'completed',
          results: [{ base64: 'result', mimeType: 'image/png' }],
        },
      ],
      subjectImages: [{ base64: 'subject', mimeType: 'image/png' }],
      selectedSubjectItemId: 'vto-1',
      activeSubjectItem: {
        id: 'vto-1',
        subjectImage: { base64: 'subject', mimeType: 'image/png' },
        status: 'completed',
        results: [{ base64: 'result', mimeType: 'image/png' }],
      },
      completedCount: 1,
    });

    render(<VirtualTryOn />);

    expect(screen.getByRole('button', { name: 'virtualTryOn.generateButton' })).toBeEnabled();
    expect(screen.getByText('virtualTryOn.batchResultsTitle')).toBeInTheDocument();
    expect(screen.getByText('session-rail')).toBeInTheDocument();
    expect(screen.getByText('virtualTryOn.subjectBatchLabel')).toBeInTheDocument();
    expect(screen.getByText('generatedImage.altText 1')).toBeInTheDocument();
  });
});
