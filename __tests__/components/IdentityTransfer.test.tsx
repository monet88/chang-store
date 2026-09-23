import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const useIdentityTransferMock = vi.fn();

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return `${key} ${JSON.stringify(params)}`;
      }
      return key;
    },
    language: 'en',
  }),
}));

vi.mock('../../src/hooks/useIdentityTransfer', () => ({
  useIdentityTransfer: () => useIdentityTransferMock(),
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
  default: ({
    altText,
    onRegenerate,
    onUpscale,
  }: {
    altText: string;
    onRegenerate?: () => void;
    onUpscale?: () => void;
  }) => (
    <div>
      <span>{altText}</span>
      {onRegenerate && <button type="button" onClick={onRegenerate}>regenerate-hover</button>}
      {onUpscale && <button type="button" onClick={onUpscale}>upscale-hover</button>}
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

vi.mock('../../src/components/AiScanPanel', () => ({
  default: () => <div>ai-scan-panel</div>,
}));

vi.mock('../../src/components/IdentityTransferPresets', () => ({
  IdentityTransferPresets: () => <div>identity-presets</div>,
}));

import IdentityTransfer from '../../src/components/IdentityTransfer';

const baseHookState = {
  destinationItems: [],
  destinationImages: [],
  aiScanSources: [],
  faceReference: null,
  bodyReference: null,
  backgroundPrompt: '',
  extraPrompt: '',
  aspectRatio: '3:4' as const,
  resolution: '1K' as const,
  isLoading: false,
  loadingMessage: '',
  error: null,
  canGenerate: false,
  completedCount: 0,
  failedCount: 0,
  imageEditModel: 'gemini-3.1-flash-image',
  engineId: 'gemini' as const,
  setFaceReference: vi.fn(),
  setBodyReference: vi.fn(),
  setBackgroundPrompt: vi.fn(),
  setExtraPrompt: vi.fn(),
  setAspectRatio: vi.fn(),
  setResolution: vi.fn(),
  setError: vi.fn(),
  handleDestinationImagesUpload: vi.fn(),
  handleGenerate: vi.fn(),
  handleRegenerateSingle: vi.fn(),
};

describe('IdentityTransfer component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIdentityTransferMock.mockReturnValue(baseHookState);
  });

  it('renders all preserved inputs and disabled generate button when empty', () => {
    render(<IdentityTransfer />);

    expect(screen.getByText('identityTransfer.faceReferenceTitle')).toBeInTheDocument();
    expect(screen.getByText('identityTransfer.bodyReferenceTitle')).toBeInTheDocument();
    expect(screen.getAllByText('identityTransfer.destinationsTitle').length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText('identityTransfer.backgroundPromptPlaceholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('identityTransfer.extraPromptPlaceholder')).toBeInTheDocument();
    expect(screen.getByText('identity-presets')).toBeInTheDocument();
    expect(screen.getByText('ai-scan-panel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'identityTransfer.generateButton' })).toBeDisabled();
    expect(screen.getByText('identityTransfer.outputPanelDescription')).toBeInTheDocument();
  });

  it('renders Gemini generation options in Gemini Studio Mode', () => {
    useIdentityTransferMock.mockReturnValue({
      ...baseHookState,
      engineId: 'gemini',
    });

    render(<IdentityTransfer />);

    expect(screen.getByText('image-options')).toBeInTheDocument();
    expect(screen.queryByText('gpt-image-options')).not.toBeInTheDocument();
  });

  it('renders GPT generation options in GPT Studio Mode through the same shared UI', () => {
    useIdentityTransferMock.mockReturnValue({
      ...baseHookState,
      engineId: 'gptImage',
    });

    render(<IdentityTransfer />);

    expect(screen.getByText('gpt-image-options')).toBeInTheDocument();
    expect(screen.queryByText('image-options')).not.toBeInTheDocument();
  });

  it('hides the feature-level options panel in Local Qwen Studio Mode', () => {
    useIdentityTransferMock.mockReturnValue({
      ...baseHookState,
      engineId: 'localQwen',
    });

    render(<IdentityTransfer />);

    expect(screen.queryByText('image-options')).not.toBeInTheDocument();
    expect(screen.queryByText('gpt-image-options')).not.toBeInTheDocument();
  });

  it('enables generate button and triggers handleGenerate on click', () => {
    const handleGenerate = vi.fn();
    useIdentityTransferMock.mockReturnValue({
      ...baseHookState,
      canGenerate: true,
      handleGenerate,
    });

    render(<IdentityTransfer />);

    const generateBtn = screen.getByRole('button', { name: 'identityTransfer.generateButton' });
    expect(generateBtn).toBeEnabled();
    fireEvent.click(generateBtn);
    expect(handleGenerate).toHaveBeenCalledTimes(1);
  });

  it('renders batch results when destinations exist, preserving successful siblings alongside errors', () => {
    const handleRegenerateSingle = vi.fn();
    useIdentityTransferMock.mockReturnValue({
      ...baseHookState,
      canGenerate: true,
      completedCount: 1,
      failedCount: 1,
      destinationItems: [
        {
          id: 'dest-1',
          destinationImage: { base64: 'dest-1-img', mimeType: 'image/png' },
          status: 'completed',
          results: [{ base64: 'result-1-img', mimeType: 'image/png' }],
        },
        {
          id: 'dest-2',
          destinationImage: { base64: 'dest-2-img', mimeType: 'image/png' },
          status: 'error',
          results: [],
          error: 'Generation failed for dest-2',
        },
      ],
      handleRegenerateSingle,
    });

    render(<IdentityTransfer />);

    expect(screen.getByText('identityTransfer.batchResultsTitle')).toBeInTheDocument();
    // Successful sibling shows result image with altText
    expect(screen.getAllByText(/identityTransfer\.destinationBatchLabel/)).toHaveLength(2);
    // Failed sibling shows error card with retry button
    expect(screen.getByText('Generation failed for dest-2')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: 'identityTransfer.regenerateButton' });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(handleRegenerateSingle).toHaveBeenCalledWith('dest-2');
  });

  it('does not expose upscale action on results in cloud mode', () => {
    useIdentityTransferMock.mockReturnValue({
      ...baseHookState,
      engineId: 'gemini',
      destinationItems: [
        {
          id: 'dest-1',
          destinationImage: { base64: 'dest-1-img', mimeType: 'image/png' },
          status: 'completed',
          results: [{ base64: 'result-1', mimeType: 'image/png' }],
        },
      ],
    });

    render(<IdentityTransfer />);
    expect(screen.queryByRole('button', { name: 'upscale-hover' })).not.toBeInTheDocument();
  });

  it('exposes explicit upscale action on results only in localQwen mode', () => {
    const handleUpscale = vi.fn();
    const mockResult = { base64: 'result-1', mimeType: 'image/png' };
    useIdentityTransferMock.mockReturnValue({
      ...baseHookState,
      engineId: 'localQwen',
      handleUpscale,
      destinationItems: [
        {
          id: 'dest-1',
          destinationImage: { base64: 'dest-1-img', mimeType: 'image/png' },
          status: 'completed',
          results: [mockResult],
        },
      ],
    });

    render(<IdentityTransfer />);
    const upscaleBtn = screen.getByRole('button', { name: 'upscale-hover' });
    expect(upscaleBtn).toBeInTheDocument();
    fireEvent.click(upscaleBtn);
    expect(handleUpscale).toHaveBeenCalledWith(mockResult, 'dest-1');
  });

  it('shows loading message and spinner during generation', () => {
    useIdentityTransferMock.mockReturnValue({
      ...baseHookState,
      isLoading: true,
      loadingMessage: 'Generating identity edit...',
      destinationItems: [
        {
          id: 'dest-1',
          destinationImage: { base64: 'dest-1-img', mimeType: 'image/png' },
          status: 'processing',
          results: [],
        },
      ],
    });

    render(<IdentityTransfer />);

    expect(screen.getByText('Generating identity edit...')).toBeInTheDocument();
    expect(screen.getByText('identityTransfer.processingStatus')).toBeInTheDocument();
    expect(screen.getAllByText('spinner').length).toBeGreaterThan(0);
  });
});
