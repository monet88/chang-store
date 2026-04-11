import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../src/contexts/LanguageContext', () => ({
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLanguage: () => ({
    t: (key: string, params?: { count?: number }) => {
      const translations: Record<string, string> = {
        'tabs.tryOn': 'Try On',
        'navigation.createLooks.label': 'Create Looks',
        'workspace.flows.tryOn': 'Build looks with AI.',
        'workspace.utility.title': 'Studio utilities',
        'workspace.utility.description': 'Open your archive, saved prompts, and workspace settings.',
        'workspace.utility.gallery': 'Gallery',
        'workspace.utility.prompts': 'Prompts',
        'workspace.utility.settings': 'Settings',
        'gallery.title': 'Gallery',
        'gallery.openAria': `Open gallery${params?.count !== undefined ? ` (${params.count})` : ''}`,
        'promptLibrary.title': 'Prompt Library',
        'tooltips.headerSettings': 'Open settings',
        'navigation.workspaceEyebrow': 'Workspace',
        'navigation.toolsEyebrow': 'Tool clusters',
        'navigation.mediaFirstLabel': 'Media-first',
        'navigation.language': 'Language',
        'navigation.closeMenu': 'Close workspace menu',
        'header.title': 'Virtual Fashion Studio',
        'header.description': 'A cinematic AI workspace.',
        'workspace.panels.controlRail': 'Control rail',
        'workspace.panels.resultStage': 'Result stage',
      };

      return translations[key] ?? key;
    },
  }),
}));

vi.mock('../src/contexts/ApiProviderContext', () => ({
  ApiProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../src/contexts/GoogleDriveContext', () => ({
  GoogleDriveProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../src/contexts/ImageGalleryContext', () => ({
  ImageGalleryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useImageGallery: () => ({ images: [] }),
}));

vi.mock('../src/contexts/ImageViewerContext', () => ({
  ImageViewerProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../src/components/Toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../src/components/VirtualTryOn', () => ({
  default: () => <div>virtual-try-on-feature</div>,
}));
vi.mock('../src/components/LookbookGenerator', () => ({
  default: () => <div>lookbook-feature</div>,
}));
vi.mock('../src/components/BackgroundReplacer', () => ({
  default: () => <div>background-feature</div>,
}));
vi.mock('../src/components/PoseChanger', () => ({
  default: () => <div>pose-feature</div>,
}));
vi.mock('../src/components/PhotoAlbumCreator', () => ({
  PhotoAlbumCreator: () => <div>photo-album-feature</div>,
}));
vi.mock('../src/components/OutfitAnalysis', () => ({
  default: () => <div>outfit-analysis-feature</div>,
}));
vi.mock('../src/components/Relight', () => ({
  default: () => <div>relight-feature</div>,
}));
vi.mock('../src/components/Upscale', () => ({
  default: () => <div>upscale-feature</div>,
}));
vi.mock('../src/components/ImageEditor', () => ({
  ImageEditor: () => <div>image-editor-feature</div>,
}));
vi.mock('../src/components/AIEditor', () => ({
  default: () => <div>ai-editor-feature</div>,
}));
vi.mock('../src/components/WatermarkRemover', () => ({
  default: () => <div>watermark-remover-feature</div>,
}));
vi.mock('../src/components/ClothingTransfer', () => ({
  default: () => <div>clothing-transfer-feature</div>,
}));
vi.mock('../src/components/PatternGenerator', () => ({
  default: () => <div>pattern-generator-feature</div>,
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

describe('App', () => {
  it('mounts the utility dock in the app shell and opens each modal action', async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByText('Studio utilities')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open gallery (0)' }));
    expect(await screen.findByText('gallery-modal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Prompt Library' }));
    expect(await screen.findByText('prompt-library-modal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(await screen.findByText('settings-modal')).toBeInTheDocument();
  });
});
