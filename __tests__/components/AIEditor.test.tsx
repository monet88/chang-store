import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Feature, ImageEngineId, ImageFile } from '@/types';

const handleGenerateMock = vi.fn();
const handleUpscaleMock = vi.fn();
const clearErrorMock = vi.fn();
const setImagesMock = vi.fn();
const setPromptMock = vi.fn();
const setAspectRatioMock = vi.fn();
const setResolutionMock = vi.fn();

let hookState: {
  images: ImageFile[];
  setImages: typeof setImagesMock;
  prompt: string;
  setPrompt: typeof setPromptMock;
  isLoading: boolean;
  error: string | null;
  resultImage: ImageFile | null;
  aspectRatio: 'Default';
  setAspectRatio: typeof setAspectRatioMock;
  resolution: '2K';
  setResolution: typeof setResolutionMock;
  imageEditModel: string;
  handleGenerate: typeof handleGenerateMock;
  handleUpscale: typeof handleUpscaleMock;
  isUpscaling?: boolean;
  clearError: typeof clearErrorMock;
  engineId?: ImageEngineId;
  refLimitNotice?: string | null;
};

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/hooks/useAIEditor', () => ({
  useAIEditor: () => hookState,
}));

vi.mock('@/components/MultiImageUploader', () => ({
  __esModule: true,
  default: ({ onImagesUpload, title }: { onImagesUpload: (images: ImageFile[]) => void; title: string }) => (
    <button onClick={() => onImagesUpload([{ base64: 'uploaded', mimeType: 'image/png' }])}>
      {title}
    </button>
  ),
}));

vi.mock('@/components/MentionTextarea', () => ({
  __esModule: true,
  default: ({ value, onChange, placeholder, id }: { value: string; onChange: (value: string) => void; placeholder: string; id: string }) => (
    <textarea
      id={id}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock('@/components/ImageOptionsPanel', () => ({
  __esModule: true,
  default: ({ model }: { model: string }) => <div>options:{model}</div>,
}));

vi.mock('@/components/HoverableImage', () => ({
  __esModule: true,
  default: ({ downloadPrefix, onUpscale }: { downloadPrefix: Feature; onUpscale?: () => void }) => (
    <div>
      <span>hoverable:{downloadPrefix}</span>
      {onUpscale && <button onClick={onUpscale}>upscale-result</button>}
    </div>
  ),
}));

vi.mock('@/components/Spinner', () => ({
  __esModule: true,
  default: () => <div>spinner</div>,
  ErrorDisplay: ({ message, onClear }: { message: string; onClear: () => void }) => (
    <div>
      <span>{message}</span>
      <button onClick={onClear}>clear-error</button>
    </div>
  ),
}));

vi.mock('@/components/shared/ResultPlaceholder', () => ({
  __esModule: true,
  default: ({ description }: { description: string }) => <div>{description}</div>,
}));

import AIEditor from '@/components/AIEditor';

describe('AIEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookState = {
      images: [],
      setImages: setImagesMock,
      prompt: '',
      setPrompt: setPromptMock,
      isLoading: false,
      error: null,
      resultImage: null,
      aspectRatio: 'Default',
      setAspectRatio: setAspectRatioMock,
      resolution: '2K',
      setResolution: setResolutionMock,
      imageEditModel: 'gemini-2.5-flash-image',
      handleGenerate: handleGenerateMock,
      handleUpscale: handleUpscaleMock,
      isUpscaling: false,
      clearError: clearErrorMock,
    };
  });

  it('wires uploader, prompt input, and generate button to hook handlers', () => {
    hookState.images = [{ base64: 'existing-image', mimeType: 'image/png' }];

    render(<AIEditor />);

    fireEvent.click(screen.getByRole('button', { name: 'aiEditor.uploadTitle' }));
    expect(setImagesMock).toHaveBeenCalledWith([{ base64: 'uploaded', mimeType: 'image/png' }]);

    fireEvent.change(screen.getByLabelText('aiEditor.promptLabel'), {
      target: { value: 'Make this image cinematic' },
    });
    expect(setPromptMock).toHaveBeenCalledWith('Make this image cinematic');

    fireEvent.click(screen.getByRole('button', { name: 'aiEditor.generateButton' }));
    expect(handleGenerateMock).toHaveBeenCalledTimes(1);
  });

  it('renders result and error states with hook-provided callbacks', () => {
    hookState.images = [{ base64: 'existing-image', mimeType: 'image/png' }];
    hookState.resultImage = { base64: 'result-image', mimeType: 'image/png' };
    hookState.error = 'broken-output';

    render(<AIEditor />);

    expect(screen.getByText(`hoverable:${Feature.AIEditor}`)).toBeInTheDocument();
    expect(screen.getByText('broken-output')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'clear-error' }));
    expect(clearErrorMock).toHaveBeenCalledTimes(1);
  });

  it('wires the result upscale button to the hook handler', () => {
    hookState.images = [{ base64: 'existing-image', mimeType: 'image/png' }];
    hookState.resultImage = { base64: 'result-image', mimeType: 'image/png' };

    render(<AIEditor />);

    fireEvent.click(screen.getByRole('button', { name: 'upscale-result' }));
    expect(handleUpscaleMock).toHaveBeenCalledWith({ base64: 'result-image', mimeType: 'image/png' });
  });

  it('renders the feature-level options panel for cloud engines', () => {
    render(<AIEditor />);

    expect(screen.getByText('options:gemini-2.5-flash-image')).toBeInTheDocument();
  });

  it('hides the feature-level options panel in Local Qwen mode', () => {
    hookState.engineId = 'localQwen';
    hookState.imageEditModel = 'qwen-image-2.1';

    render(<AIEditor />);

    expect(screen.queryByText('options:qwen-image-2.1')).not.toBeInTheDocument();
  });

  it('displays notice when hook reports a local Qwen reference limit', () => {
    hookState.engineId = 'localQwen';
    hookState.refLimitNotice = 'aiEditor.localQwenRefLimitNotice';
    hookState.images = [
      { base64: 'img1', mimeType: 'image/png' },
      { base64: 'img2', mimeType: 'image/png' },
      { base64: 'img3', mimeType: 'image/png' },
      { base64: 'img4', mimeType: 'image/png' },
      { base64: 'img5', mimeType: 'image/png' },
    ];
    hookState.prompt = 'Transform the scenery';

    render(<AIEditor />);

    expect(screen.getByTestId('local-qwen-ref-limit-notice')).toBeInTheDocument();
    expect(screen.getByText('aiEditor.localQwenRefLimitNotice')).toBeInTheDocument();
  });

  it('hides notice when mentions are present even if images > 4 in localQwen mode', () => {
    hookState.images = [
      { base64: 'img1', mimeType: 'image/png' },
      { base64: 'img2', mimeType: 'image/png' },
      { base64: 'img3', mimeType: 'image/png' },
      { base64: 'img4', mimeType: 'image/png' },
      { base64: 'img5', mimeType: 'image/png' },
    ];
    hookState.prompt = 'Apply style from @img1 to @img2';

    render(<AIEditor studioMode="localQwen" />);

    expect(screen.queryByTestId('local-qwen-ref-limit-notice')).not.toBeInTheDocument();
  });

  it('hides notice when images <= 4 in localQwen mode', () => {
    hookState.images = [
      { base64: 'img1', mimeType: 'image/png' },
      { base64: 'img2', mimeType: 'image/png' },
    ];
    hookState.prompt = 'Enhance details';

    render(<AIEditor studioMode="localQwen" />);

    expect(screen.queryByTestId('local-qwen-ref-limit-notice')).not.toBeInTheDocument();
  });

  it('hides notice when studioMode is gemini even with > 4 images', () => {
    hookState.images = [
      { base64: 'img1', mimeType: 'image/png' },
      { base64: 'img2', mimeType: 'image/png' },
      { base64: 'img3', mimeType: 'image/png' },
      { base64: 'img4', mimeType: 'image/png' },
      { base64: 'img5', mimeType: 'image/png' },
    ];
    hookState.prompt = 'Enhance details';

    render(<AIEditor studioMode="gemini" />);

    expect(screen.queryByTestId('local-qwen-ref-limit-notice')).not.toBeInTheDocument();
  });
});
