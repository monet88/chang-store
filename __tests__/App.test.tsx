import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const translations: Record<string, string> = {
  'workspace.utility.title': 'Studio utilities',
  'workspace.utility.description': 'Open your archive, saved prompts, and workspace settings.',
  'workspace.utility.settings': 'Settings',
  'tooltips.headerSettings': 'Open settings',
};

const passthrough = ({ children }: { children: React.ReactNode }) => <>{children}</>;
const featureStub = (label: string) => () => <div>{label}</div>;

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
  default: () => <div>header-shell</div>,
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
  it('mounts the dock in the live app shell and opens utility modals', async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByText('Studio utilities')).toBeInTheDocument();
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
});
