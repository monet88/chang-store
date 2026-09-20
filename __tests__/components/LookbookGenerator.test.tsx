import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const useLookbookGeneratorMock = vi.fn();

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../src/hooks/useLookbookGenerator', () => ({
  useLookbookGenerator: () => useLookbookGeneratorMock(),
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

vi.mock('../../src/components/ImageOptionsPanel', () => ({
  default: () => <div>image-options</div>,
}));

vi.mock('../../src/components/studios/GptImageOptionsPanel', () => ({
  default: () => <div>gpt-image-options</div>,
}));

vi.mock('../../src/components/AiScanPanel', () => ({
  default: () => <div>ai-scan-panel</div>,
}));

vi.mock('../../src/components/LookbookOutput', () => ({
  LookbookOutput: () => <div>lookbook-output</div>,
}));

import LookbookGenerator from '../../src/components/LookbookGenerator';

const baseHookState = {
  formState: {
    clothingImages: [{ id: '1', image: null }],
    fabricTextureImage: null,
    fabricTexturePrompt: '',
    clothingDescription: '',
    lookbookStyle: 'flat lay' as const,
    garmentType: 'one-piece' as const,
    foldedPresentationType: 'boxed' as const,
    mannequinBackgroundStyle: 'minimalistShowroom' as const,
    negativePrompt: '',
    productShotSubType: 'ghost-mannequin' as const,
    includeAccessories: false,
    includeFootwear: false,
  },
  updateForm: vi.fn(),
  handleClearForm: vi.fn(),
  handleSelectVersion: vi.fn(),
  generatedLookbook: null,
  isLoading: false,
  loadingMessage: '',
  isGeneratingDescription: false,
  isGeneratingVariations: false,
  isGeneratingCloseUp: false,
  error: null,
  setError: vi.fn(),
  variationCount: 2,
  setVariationCount: vi.fn(),
  activeOutputTab: 'main' as const,
  setActiveOutputTab: vi.fn(),
  upscalingStates: {},
  handleGenerateDescription: vi.fn(),
  handleGenerate: vi.fn(),
  handleUpscale: vi.fn(),
  handleGenerateVariations: vi.fn(),
  handleGenerateCloseUp: vi.fn(),
  refinementHistory: [],
  isRefining: false,
  handleRefineImage: vi.fn(),
  handleResetRefinement: vi.fn(),
  aspectRatio: '3:4' as const,
  setAspectRatio: vi.fn(),
  resolution: '1K' as const,
  setResolution: vi.fn(),
  refinementVersions: [],
  selectedVersionIndex: -1,
  originalImageRef: { current: null },
  imageEditModel: 'gemini-3.1-flash-image',
  engineId: 'gemini' as const,
  handleDownloadAll: vi.fn(),
};

describe('LookbookGenerator component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLookbookGeneratorMock.mockReturnValue(baseHookState);
  });

  it('renders Gemini generation controls in Gemini Studio Mode', () => {
    render(<LookbookGenerator />);

    expect(screen.getByText('image-options')).toBeInTheDocument();
    expect(screen.queryByText('gpt-image-options')).not.toBeInTheDocument();
    expect(screen.getByText('ai-scan-panel')).toBeInTheDocument();
    expect(screen.getByText('lookbook-output')).toBeInTheDocument();
  });

  it('renders GPT generation controls through the same shared UI in GPT Studio Mode', () => {
    useLookbookGeneratorMock.mockReturnValue({
      ...baseHookState,
      engineId: 'gptImage',
      imageEditModel: 'gpt-image-2',
    });

    render(<LookbookGenerator />);

    expect(screen.getByText('gpt-image-options')).toBeInTheDocument();
    expect(screen.queryByText('image-options')).not.toBeInTheDocument();
    expect(screen.getByText('ai-scan-panel')).toBeInTheDocument();
    expect(screen.getByText('lookbook-output')).toBeInTheDocument();
  });
});
