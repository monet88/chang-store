import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { getModelOptionsBySelectionType } from '@/config/modelRegistry';

const translations: Record<string, string> = {
  'settingsModal.eyebrow': 'Studio settings',
  'settingsModal.title': 'Application settings',
  'settingsModal.description': 'Update model defaults.',
  'settingsModal.closeAria': 'Close settings',
  'settingsModal.sections.models.title': 'Default model selection',
  'settingsModal.sections.models.description': 'Choose defaults.',
  'settingsModal.sections.cpaGateway.title': 'CPA Gateway',
  'settingsModal.sections.cpaGateway.description': 'Every Gemini request goes through the gateway.',
  'settingsModal.sections.data.title': 'Application data',
  'settingsModal.sections.data.description': 'Manage backups.',
  'settingsModal.sections.developer.title': 'Developer',
  'settingsModal.sections.developer.description': 'Inspect diagnostics.',
  'settingsModal.fields.textGeneration': 'Text generation',
  'settingsModal.fields.imageEditing': 'Image editing',
  'settingsModal.fields.imageGeneration': 'Image generation',
  'settingsModal.cpaGateway.urlLabel': 'Gateway URL',
  'settingsModal.cpaGateway.urlInvalid': 'Invalid gateway URL',
  'settingsModal.cpaGateway.urlCustomWarning': 'Custom host warning',
  'settingsModal.cpaGateway.apiKeyLabel': 'Gateway API key',
  'settingsModal.cpaGateway.apiKeyPlaceholder': 'Enter gateway API key',
  'settingsModal.cpaGateway.apiKeyHint': 'Gateway key only.',
  'settingsModal.cpaGateway.apiKeyMissing': 'Gateway key missing',
  'settingsModal.cpaGateway.storageWarning': 'Stored in plaintext localStorage.',
  'settingsModal.storage.title': 'Local storage usage',
  'settingsModal.storage.usageHint': 'Usage hint',
  'settingsModal.actions.backup': 'Backup data',
  'settingsModal.actions.restore': 'Restore data',
  'settingsModal.actions.clear': 'Clear all data',
  'settingsModal.developer.debugTitle': 'Debug mode',
  'settingsModal.developer.debugDescription': 'Log API calls.',
  'settingsModal.developer.toggleDebugAria': 'Toggle debug mode',
  'settingsModal.footerHint': 'Model changes apply when you save this panel.',
};

let galleryImages: unknown[] = [];

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => translations[key] ?? key,
  }),
}));

vi.mock('@/contexts/ApiProviderContext', () => ({
  useApi: () => ({
    imageEditModel: 'gemini-3.1-flash-image',
    setImageEditModel: vi.fn(),
    imageGenerateModel: 'gemini-3.1-flash-image',
    setImageGenerateModel: vi.fn(),
    textGenerateModel: 'gemini-3.8-flash',
    setTextGenerateModel: vi.fn(),
    cpaGatewaySettings: {
      url: 'https://cliproxy.monet.uno',
      apiKey: '',
    },
    setCpaGatewaySettings: vi.fn(),
  }),
}));

vi.mock('@/contexts/ImageGalleryContext', () => ({
  useImageGallery: () => ({
    images: galleryImages,
  }),
}));
vi.mock('@/components/Toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock('@/utils/storage', () => ({
  getLocalStorageUsage: vi.fn().mockResolvedValue({ usage: 0, quota: 1024 }),
  backupData: vi.fn(),
  restoreData: vi.fn(),
  clearAppData: vi.fn(),
}));

vi.mock('@/services/debugService', () => ({
  isDebugEnabled: () => false,
  setDebugEnabled: vi.fn(),
}));

vi.mock('@/components/GoogleDriveSettings', () => ({
  GoogleDriveSettings: () => <div>google-drive-settings</div>,
}));

describe('SettingsModal', () => {
  beforeEach(() => {
    galleryImages = [];
  });

  it('renders registry-backed model options for each selection type', async () => {
    render(<SettingsModal isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('google-drive-settings')).toBeInTheDocument();
    });

    const textSelect = screen.getByLabelText('Text generation');
    const imageEditSelect = screen.getByLabelText('Image editing');
    const imageGenerateSelect = screen.getByLabelText('Image generation');

    expect(within(textSelect).getAllByRole('option')).toHaveLength(getModelOptionsBySelectionType('textGenerate').length);
    expect(within(imageEditSelect).getAllByRole('option')).toHaveLength(getModelOptionsBySelectionType('imageEdit').length);
    expect(within(imageGenerateSelect).getAllByRole('option')).toHaveLength(getModelOptionsBySelectionType('imageGenerate').length);

    expect(within(imageEditSelect).getByRole('option', { name: 'Nano Banana 2' })).toBeInTheDocument();
    expect(within(imageGenerateSelect).getByRole('option', { name: 'Nano Banana 2' })).toBeInTheDocument();
    expect(within(textSelect).getByRole('option', { name: 'Gemini 3.8 Flash' })).toBeInTheDocument();
    expect(screen.getByLabelText('Gateway URL')).toHaveValue('https://cliproxy.monet.uno');
    expect(screen.queryByText('Gateway key missing')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Gateway API key')).toHaveValue('');

    // The gateway is always on: the only remaining on/off control is debug mode.
    const toggles = document.querySelectorAll('[aria-pressed]');
    expect(toggles).toHaveLength(1);
    expect(toggles[0]).toHaveAttribute('aria-label', 'Toggle debug mode');
  });

  it('does not reset unsaved model selections when gallery images change while open', async () => {
    const { rerender } = render(<SettingsModal isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('google-drive-settings')).toBeInTheDocument();
    });

    const textSelect = screen.getByLabelText('Text generation');
    fireEvent.change(textSelect, { target: { value: 'gemini-3.7-flash' } });

    expect(textSelect).toHaveValue('gemini-3.7-flash');

    galleryImages = [{ id: 'gallery-image-1' }];
    rerender(<SettingsModal isOpen onClose={vi.fn()} />);

    expect(screen.getByLabelText('Text generation')).toHaveValue('gemini-3.7-flash');
  });
});
