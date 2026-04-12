import React from 'react';
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
  'settingsModal.sections.cloud.title': 'Cloud sync',
  'settingsModal.sections.cloud.description': 'Connect sync.',
  'settingsModal.sections.data.title': 'Application data',
  'settingsModal.sections.data.description': 'Manage backups.',
  'settingsModal.sections.developer.title': 'Developer',
  'settingsModal.sections.developer.description': 'Inspect diagnostics.',
  'settingsModal.fields.textGeneration': 'Text generation',
  'settingsModal.fields.imageEditing': 'Image editing',
  'settingsModal.fields.imageGeneration': 'Image generation',
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
    imageEditModel: 'gemini-3.1-flash-image-preview',
    setImageEditModel: vi.fn(),
    imageGenerateModel: 'imagen-4.0-generate-001',
    setImageGenerateModel: vi.fn(),
    textGenerateModel: 'gemini-3-flash-preview',
    setTextGenerateModel: vi.fn(),
  }),
}));

vi.mock('@/contexts/ImageGalleryContext', () => ({
  useImageGallery: () => ({
    images: galleryImages,
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

    expect(screen.getByRole('option', { name: 'Gemini 3.1 Flash Image (Preview)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Imagen 4 Ultra' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Gemini 2.5 Pro' })).toBeInTheDocument();
  });

  it('does not reset unsaved model selections when gallery images change while open', async () => {
    const { rerender } = render(<SettingsModal isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('google-drive-settings')).toBeInTheDocument();
    });

    const imageEditSelect = screen.getByLabelText('Image editing');
    fireEvent.change(imageEditSelect, { target: { value: 'gemini-2.5-flash-image' } });

    expect(imageEditSelect).toHaveValue('gemini-2.5-flash-image');

    galleryImages = [{ id: 'gallery-image-1' }];
    rerender(<SettingsModal isOpen onClose={vi.fn()} />);

    expect(screen.getByLabelText('Image editing')).toHaveValue('gemini-2.5-flash-image');
  });
});
