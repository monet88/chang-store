import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { featureStub, passthrough, translations } = vi.hoisted(() => {
  const translations: Record<string, string> = {
    'workspace.utility.title': 'Studio utilities',
    'workspace.utility.description': 'Open your archive, saved prompts, and workspace settings.',
    'workspace.utility.settings': 'Settings',
    'workspace.utility.expand': 'Expand studio utilities',
    'workspace.utility.collapse': 'Collapse studio utilities',
    'modelSelector.scopes.imageEdit': 'Image editing model',
    'modelSelector.scopes.imageGenerate': 'Image generation model',
    'modelSelector.scopes.textGenerate': 'Text generation model',
    'tooltips.headerSettings': 'Open settings',
  };

  function Passthrough({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }

  const passthrough = Passthrough;
  const featureStub = (label: string) => {
    function FeatureStub() {
      return <div>{label}</div>;
    }

    FeatureStub.displayName = `FeatureStub(${label})`;
    return FeatureStub;
  };

  return {
    translations,
    passthrough,
    featureStub,
  };
});

const {
  mockSetImageEditModel,
  mockSetImageGenerateModel,
  mockSetTextGenerateModel,
} = vi.hoisted(() => ({
  mockSetImageEditModel: vi.fn(),
  mockSetImageGenerateModel: vi.fn(),
  mockSetTextGenerateModel: vi.fn(),
}));

vi.mock('../src/contexts/LanguageContext', () => ({
  LanguageProvider: passthrough,
  useLanguage: () => ({
    t: (key: string) => translations[key] ?? key,
  }),
}));

vi.mock('../src/contexts/ImageGalleryContext', () => ({
  ImageGalleryProvider: passthrough,
}));

vi.mock('../src/contexts/ApiProviderContext', () => ({
  ApiProvider: passthrough,
  useApi: () => ({
    imageEditModel: 'gemini-3.1-flash-image-preview',
    setImageEditModel: mockSetImageEditModel,
    imageGenerateModel: 'imagen-4.0-generate-001',
    setImageGenerateModel: mockSetImageGenerateModel,
    textGenerateModel: 'gemini-3-flash-preview',
    setTextGenerateModel: mockSetTextGenerateModel,
  }),
}));

vi.mock('../src/contexts/ImageViewerContext', () => ({
  ImageViewerProvider: passthrough,
}));

vi.mock('../src/contexts/GoogleDriveContext', () => ({
  GoogleDriveProvider: passthrough,
}));

vi.mock('../src/components/Toast', () => ({
  ToastProvider: passthrough,
}));

vi.mock('../src/components/Header', () => ({
  default: ({ setActiveFeature }: { setActiveFeature: (feature: string) => void }) => (
    <div>
      header-shell
      <button type="button" onClick={() => setActiveFeature('try-on')}>
        feature-try-on
      </button>
      <button type="button" onClick={() => setActiveFeature('image-editor')}>
        feature-image-editor
      </button>
      <button type="button" onClick={() => setActiveFeature('outfit-analysis')}>
        feature-outfit-analysis
      </button>
    </div>
  ),
}));

vi.mock('../src/components/MobileMenuButton', () => ({
  default: () => <button type="button">mobile-menu-button</button>,
}));

vi.mock('../src/components/MobileOverlay', () => ({
  default: () => <div>mobile-overlay</div>,
}));

vi.mock('../src/components/Spinner', () => ({
  default: () => <div>loading-spinner</div>,
}));

vi.mock('../src/components/GalleryButton', () => ({
  default: ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      gallery-action
    </button>
  ),
}));

vi.mock('../src/components/PromptLibraryFAB', () => ({
  default: ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      prompt-action
    </button>
  ),
}));

vi.mock('../src/components/VirtualTryOn', () => ({
  default: featureStub('virtual-try-on'),
}));

vi.mock('../src/components/LookbookGenerator', () => ({
  default: featureStub('lookbook-generator'),
}));

vi.mock('../src/components/BackgroundReplacer', () => ({
  default: featureStub('background-replacer'),
}));

vi.mock('../src/components/PoseChanger', () => ({
  default: featureStub('pose-changer'),
}));

vi.mock('../src/components/PhotoAlbumCreator', () => ({
  PhotoAlbumCreator: featureStub('photo-album-creator'),
}));

vi.mock('../src/components/OutfitAnalysis', () => ({
  default: featureStub('outfit-analysis'),
}));

vi.mock('../src/components/Relight', () => ({
  default: featureStub('relight'),
}));

vi.mock('../src/components/Upscale', () => ({
  default: featureStub('upscale'),
}));

vi.mock('../src/components/ImageEditor', () => ({
  ImageEditor: featureStub('image-editor'),
}));

vi.mock('../src/components/AIEditor', () => ({
  default: featureStub('ai-editor'),
}));

vi.mock('../src/components/WatermarkRemover', () => ({
  default: featureStub('watermark-remover'),
}));

vi.mock('../src/components/ClothingTransfer', () => ({
  default: featureStub('clothing-transfer'),
}));

vi.mock('../src/components/PatternGenerator', () => ({
  default: featureStub('pattern-generator'),
}));

vi.mock('../src/components/modals/GalleryModal', () => ({
  default: () => <div>gallery-modal</div>,
}));

vi.mock('../src/components/modals/PromptLibraryModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>prompt-library-modal</div> : null),
}));

vi.mock('../src/components/modals/PoseLibraryModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>pose-library-modal</div> : null),
}));

vi.mock('../src/components/modals/SettingsModal', () => ({
  SettingsModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>settings-modal</div> : null),
}));

import App from '../src/App';

describe('App utility dock regression', () => {
  it('mounts the dock in the live app shell and opens utility modals after expanding it', async () => {
    const user = userEvent.setup();

    render(<App />);

    const toggle = await screen.findByRole('button', { name: 'Expand studio utilities' });
    expect(screen.getByText('Studio utilities')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Open your archive, saved prompts, and workspace settings.')).not.toBeInTheDocument();
    expect(screen.queryByText('gallery-action')).not.toBeInTheDocument();

    await user.click(toggle);

    expect(screen.getByRole('button', { name: 'Collapse studio utilities' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Open your archive, saved prompts, and workspace settings.')).toBeInTheDocument();
    expect(screen.getByText('gallery-action')).toBeInTheDocument();
    expect(screen.getByText('prompt-action')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeInTheDocument();

    await user.click(screen.getByText('gallery-action'));
    expect(await screen.findByText('gallery-modal')).toBeInTheDocument();

    await user.click(screen.getByText('prompt-action'));
    expect(await screen.findByText('prompt-library-modal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(await screen.findByText('settings-modal')).toBeInTheDocument();
  });

  it('switches the shared active-task model selector scope and setter by feature', async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(screen.getByLabelText('Image editing model')).toHaveValue('gemini-3.1-flash-image-preview');
    await user.selectOptions(screen.getByLabelText('Image editing model'), 'gemini-2.5-flash-image');
    expect(mockSetImageEditModel).toHaveBeenCalledWith('gemini-2.5-flash-image');

    await user.click(screen.getByText('feature-image-editor'));
    expect(screen.getByLabelText('Image generation model')).toHaveValue('imagen-4.0-generate-001');
    await user.selectOptions(screen.getByLabelText('Image generation model'), 'imagen-4.0-fast-generate-001');
    expect(mockSetImageGenerateModel).toHaveBeenCalledWith('imagen-4.0-fast-generate-001');

    await user.click(screen.getByText('feature-outfit-analysis'));
    expect(screen.getByLabelText('Text generation model')).toHaveValue('gemini-3-flash-preview');
    await user.selectOptions(screen.getByLabelText('Text generation model'), 'gemini-2.5-pro');
    expect(mockSetTextGenerateModel).toHaveBeenCalledWith('gemini-2.5-pro');
  });
});
