import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockUseApi, mockUseImageGallery, mockUseLanguage } from '../__mocks__/contexts';

const {
  restoreDataMock,
  setDebugEnabledMock,
  showToastMock,
  clearAppDataMock,
  setGoogleApiKeyMock,
  setImageEditModelMock,
  setImageGenerateModelMock,
  setTextGenerateModelMock,
  getLocalStorageUsageMock,
  apiOverrides,
} = vi.hoisted(() => ({
  restoreDataMock: vi.fn(),
  setDebugEnabledMock: vi.fn(),
  showToastMock: vi.fn(),
  clearAppDataMock: vi.fn(),
  setGoogleApiKeyMock: vi.fn(),
  setImageEditModelMock: vi.fn(),
  setImageGenerateModelMock: vi.fn(),
  setTextGenerateModelMock: vi.fn(),
  getLocalStorageUsageMock: vi.fn(),
  apiOverrides: {} as Record<string, unknown>,
}));

// Wire hoisted mocks into apiOverrides after hoisting
apiOverrides.setGoogleApiKey = setGoogleApiKeyMock;
apiOverrides.setImageEditModel = setImageEditModelMock;
apiOverrides.setImageGenerateModel = setImageGenerateModelMock;
apiOverrides.setTextGenerateModel = setTextGenerateModelMock;

vi.mock('../../src/contexts/LanguageContext', () =>
  mockUseLanguage({
    t: vi.fn((key: string) => key),
  }),
);
vi.mock('../../src/contexts/ApiProviderContext', () =>
  mockUseApi(apiOverrides),
);
vi.mock('../../src/contexts/ImageGalleryContext', () => mockUseImageGallery());
vi.mock('../../src/components/Toast', () => ({
  useToast: () => ({
    showToast: showToastMock,
  }),
}));
vi.mock('../../src/utils/storage', () => ({
  getLocalStorageUsage: getLocalStorageUsageMock,
  backupData: vi.fn(),
  restoreData: restoreDataMock,
  clearAppData: clearAppDataMock,
}));
vi.mock('../../src/services/debugService', () => ({
  isDebugEnabled: () => false,
  setDebugEnabled: setDebugEnabledMock,
}));

import { useSettingsModal } from '../../src/hooks/useSettingsModal';

const onCloseMock = vi.fn();

describe('useSettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    getLocalStorageUsageMock.mockResolvedValue({ usage: 0, quota: 1024 });
  });

  // ── handleRestore: validation ──────────────────────────────────────

  it('rejects non-json restore files and clears input', async () => {
    const { result } = renderHook(() => useSettingsModal({ isOpen: true, onClose: onCloseMock }));
    const file = new File(['not-json'], 'backup.txt', { type: 'text/plain' });
    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'value', {
      configurable: true,
      writable: true,
      value: 'C:/fakepath/backup.txt',
    });
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });

    const changeEvent = { currentTarget: input } as Parameters<typeof result.current.handleRestore>[0];

    await act(async () => {
      await result.current.handleRestore(changeEvent);
    });

    expect(restoreDataMock).not.toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith('settingsModal.notifications.invalidFileType');
    expect(input.value).toBe('');
  });

  it('rejects oversized restore files and clears input', async () => {
    const { result } = renderHook(() => useSettingsModal({ isOpen: true, onClose: onCloseMock }));
    const file = new File([new Uint8Array(1)], 'backup.json', { type: 'application/json' });
    Object.defineProperty(file, 'size', { value: 51 * 1024 * 1024 });

    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'value', {
      configurable: true,
      writable: true,
      value: 'C:/fakepath/backup.json',
    });
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });

    const changeEvent = { currentTarget: input } as Parameters<typeof result.current.handleRestore>[0];

    await act(async () => {
      await result.current.handleRestore(changeEvent);
    });

    expect(restoreDataMock).not.toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith('settingsModal.notifications.fileTooLarge');
    expect(input.value).toBe('');
  });

  it('clears restore input value after reading selected file', async () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);
    restoreDataMock.mockRejectedValueOnce(new Error('bad backup'));

    const { result } = renderHook(() => useSettingsModal({ isOpen: true, onClose: onCloseMock }));
    const file = new File(['backup'], 'backup.json', { type: 'application/json' });
    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'value', {
      configurable: true,
      writable: true,
      value: 'C:/fakepath/backup.json',
    });
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });

    const changeEvent = { currentTarget: input } as Parameters<typeof result.current.handleRestore>[0];

    await act(async () => {
      await result.current.handleRestore(changeEvent);
    });

    expect(restoreDataMock).toHaveBeenCalledWith(file);
    expect(input.value).toBe('');
    expect(showToastMock).toHaveBeenCalledWith('settingsModal.notifications.restoreFailed');
  });

  it('restores successfully and reloads', async () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);
    const reloadMock = vi.fn();
    vi.stubGlobal('location', { reload: reloadMock });
    restoreDataMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useSettingsModal({ isOpen: true, onClose: onCloseMock }));
    const file = new File(['backup'], 'backup.json', { type: 'application/json' });
    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'value', {
      configurable: true,
      writable: true,
      value: 'C:/fakepath/backup.json',
    });
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });

    const changeEvent = { currentTarget: input } as Parameters<typeof result.current.handleRestore>[0];

    await act(async () => {
      await result.current.handleRestore(changeEvent);
    });

    expect(restoreDataMock).toHaveBeenCalledWith(file);
    expect(alertMock).toHaveBeenCalledWith('settingsModal.notifications.restoreSuccess');
    expect(reloadMock).toHaveBeenCalled();
  });

  // ── handleRestore: no-file edge case ────────────────────────────────

  it('does nothing when no file is selected', async () => {
    const { result } = renderHook(() => useSettingsModal({ isOpen: true, onClose: onCloseMock }));
    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'value', { configurable: true, writable: true, value: '' });
    Object.defineProperty(input, 'files', { configurable: true, value: [] });

    const changeEvent = { currentTarget: input } as Parameters<typeof result.current.handleRestore>[0];

    await act(async () => {
      await result.current.handleRestore(changeEvent);
    });

    expect(restoreDataMock).not.toHaveBeenCalled();
    expect(showToastMock).not.toHaveBeenCalled();
  });

  // ── handleSave ──────────────────────────────────────────────────────

  it('saves model selections and closes modal', () => {
    const { result } = renderHook(() => useSettingsModal({ isOpen: true, onClose: onCloseMock }));

    act(() => {
      result.current.handleSave();
    });

    expect(setGoogleApiKeyMock).toHaveBeenCalledWith(null);
    expect(setImageEditModelMock).toHaveBeenCalledWith('gemini-2.5-flash-image');
    expect(setImageGenerateModelMock).toHaveBeenCalledWith('imagen-4.0-generate-001');
    expect(setTextGenerateModelMock).toHaveBeenCalledWith('gemini-3.5-flash');
    expect(onCloseMock).toHaveBeenCalled();
  });

  // ── handleDebugToggle ───────────────────────────────────────────────

  it('toggles debug mode', () => {
    const { result } = renderHook(() => useSettingsModal({ isOpen: true, onClose: onCloseMock }));

    expect(result.current.debugMode).toBe(false);

    act(() => {
      result.current.handleDebugToggle();
    });

    expect(result.current.debugMode).toBe(true);
    expect(setDebugEnabledMock).toHaveBeenCalledWith(true);

    act(() => {
      result.current.handleDebugToggle();
    });

    expect(result.current.debugMode).toBe(false);
    expect(setDebugEnabledMock).toHaveBeenCalledWith(false);
  });

  // ── Escape key ──────────────────────────────────────────────────────

  it('closes modal on Escape key when open', () => {
    renderHook(() => useSettingsModal({ isOpen: true, onClose: onCloseMock }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onCloseMock).toHaveBeenCalled();
  });

  it('does not close on Escape when modal is closed', () => {
    renderHook(() => useSettingsModal({ isOpen: false, onClose: onCloseMock }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onCloseMock).not.toHaveBeenCalled();
  });

  // ── handleClear ─────────────────────────────────────────────────────

  it('clears app data after confirmation', async () => {
    vi.stubGlobal('confirm', () => true);
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);
    const reloadMock = vi.fn();
    vi.stubGlobal('location', { reload: reloadMock });
    clearAppDataMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useSettingsModal({ isOpen: true, onClose: onCloseMock }));

    await act(async () => {
      result.current.handleClear();
    });

    expect(clearAppDataMock).toHaveBeenCalled();
    expect(alertMock).toHaveBeenCalledWith('settingsModal.notifications.clearSuccess');
    expect(reloadMock).toHaveBeenCalled();
  });

  it('does not clear data when confirmation is canceled', async () => {
    vi.stubGlobal('confirm', () => false);

    const { result } = renderHook(() => useSettingsModal({ isOpen: true, onClose: onCloseMock }));

    await act(async () => {
      result.current.handleClear();
    });

    expect(clearAppDataMock).not.toHaveBeenCalled();
  });

  // ── handleBackup ────────────────────────────────────────────────────

  it('exposes backupData as handleBackup', () => {
    const { result } = renderHook(() => useSettingsModal({ isOpen: true, onClose: onCloseMock }));
    expect(result.current.handleBackup).toBeDefined();
  });

  // ── model lists ─────────────────────────────────────────────────────

  it('returns available model lists', () => {
    const { result } = renderHook(() => useSettingsModal({ isOpen: true, onClose: onCloseMock }));

    expect(result.current.imageEditModels.length).toBeGreaterThan(0);
    expect(result.current.imageGenerateModels.length).toBeGreaterThan(0);
    expect(result.current.textGenerateModels.length).toBeGreaterThan(0);
  });

  // ── local model state setters ───────────────────────────────────────

  it('updates local model selections', () => {
    const { result } = renderHook(() => useSettingsModal({ isOpen: true, onClose: onCloseMock }));

    act(() => {
      result.current.setLocalImageEditModel('custom-edit-model');
    });
    expect(result.current.localImageEditModel).toBe('custom-edit-model');

    act(() => {
      result.current.setLocalImageGenerateModel('custom-gen-model');
    });
    expect(result.current.localImageGenerateModel).toBe('custom-gen-model');

    act(() => {
      result.current.setLocalTextGenerateModel('custom-text-model');
    });
    expect(result.current.localTextGenerateModel).toBe('custom-text-model');

    act(() => {
      result.current.setLocalDirectGeminiApiKey('direct-gemini-key');
    });
    expect(result.current.localDirectGeminiApiKey).toBe('direct-gemini-key');
  });

  // ── restoreInputRef ─────────────────────────────────────────────────

  it('provides a restoreInputRef', () => {
    const { result } = renderHook(() => useSettingsModal({ isOpen: true, onClose: onCloseMock }));
    expect(result.current.restoreInputRef).toBeDefined();
    expect(result.current.restoreInputRef.current).toBeNull();
  });

  // ── storage info defaults ───────────────────────────────────────────

  it('returns default storage info before refresh resolves', () => {
    const { result } = renderHook(() => useSettingsModal({ isOpen: true, onClose: onCloseMock }));

    expect(result.current.usageMB).toBe('0.00');
    expect(result.current.quotaMB).toBe('200.00');
    expect(result.current.storagePercentage).toBe(0);
  });

  // ── wasOpenRef guard ──────────────────────────────────────────────────

  // ── storage edge cases ───────────────────────────────────────────────

  it('handles zero quota by falling back to 200 MB', async () => {
    getLocalStorageUsageMock.mockResolvedValue({ usage: 1048576, quota: 0 });

    const { result } = renderHook(() => useSettingsModal({ isOpen: true, onClose: onCloseMock }));

    await act(async () => {
      await result.current.refreshStorageUsage();
    });

    expect(result.current.quotaMB).toBe('200.00');
    expect(result.current.usageMB).toBe('1.00');
  });

  // ── Escape key: non-Escape key ignored ──────────────────────────────

  it('does not close modal on non-Escape key', () => {
    renderHook(() => useSettingsModal({ isOpen: true, onClose: onCloseMock }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });

    expect(onCloseMock).not.toHaveBeenCalled();
  });

  // ── handleRestore: non-Error thrown ──────────────────────────────────

  it('shows toast with stringified non-Error in restore failure', async () => {
    restoreDataMock.mockRejectedValueOnce('some string error');

    const { result } = renderHook(() => useSettingsModal({ isOpen: true, onClose: onCloseMock }));
    const file = new File(['backup'], 'backup.json', { type: 'application/json' });
    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'value', {
      configurable: true,
      writable: true,
      value: 'C:/fakepath/backup.json',
    });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });

    const changeEvent = { currentTarget: input } as Parameters<typeof result.current.handleRestore>[0];

    await act(async () => {
      await result.current.handleRestore(changeEvent);
    });

    expect(showToastMock).toHaveBeenCalledWith('settingsModal.notifications.restoreFailed');
  });

  // ── wasOpenRef guard ──────────────────────────────────────────────────

  it('does not re-initialize local state when model deps change while open', () => {
    const { result, rerender } = renderHook(
      () => useSettingsModal({ isOpen: true, onClose: onCloseMock }),
      { initialProps: { imageEditModel: 'gemini-2.5-flash-image' } },
    );

    // Change local selection away from the API value
    act(() => {
      result.current.setLocalImageEditModel('custom-changed-model');
    });
    expect(result.current.localImageEditModel).toBe('custom-changed-model');

    // Mutate the API mock to return a different value, then rerender.
    // The wasOpenRef guard at line 105 blocks re-initialization.
    apiOverrides.imageEditModel = 'gemini-3-pro-image-preview';

    rerender({ imageEditModel: 'gemini-3-pro-image-preview' });

    // Local state must NOT be overwritten because wasOpenRef is true
    expect(result.current.localImageEditModel).toBe('custom-changed-model');
  });

  // ── Full interaction flows ──────────────────────────────────────

  it('completes save-then-reopen round-trip with persisted model selections', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }: { isOpen: boolean }) =>
        useSettingsModal({ isOpen, onClose: onCloseMock }),
      { initialProps: { isOpen: true } },
    );

    act(() => {
      result.current.setLocalImageEditModel('my-custom-edit-model');
      result.current.setLocalImageGenerateModel('my-custom-gen-model');
      result.current.setLocalTextGenerateModel('my-custom-text-model');
      result.current.setLocalDirectGeminiApiKey('persisted-direct-key');
    });

    act(() => {
      result.current.handleSave();
    });

    expect(setGoogleApiKeyMock).toHaveBeenCalledWith('persisted-direct-key');
    expect(setImageEditModelMock).toHaveBeenCalledWith('my-custom-edit-model');
    expect(setImageGenerateModelMock).toHaveBeenCalledWith('my-custom-gen-model');
    expect(setTextGenerateModelMock).toHaveBeenCalledWith('my-custom-text-model');
    expect(onCloseMock).toHaveBeenCalled();

    // Simulate modal closed then reopened
    vi.clearAllMocks();
    apiOverrides.googleApiKey = 'persisted-direct-key';
    apiOverrides.imageEditModel = 'my-custom-edit-model';
    apiOverrides.imageGenerateModel = 'my-custom-gen-model';
    apiOverrides.textGenerateModel = 'my-custom-text-model';

    rerender({ isOpen: false });
    rerender({ isOpen: true });

    expect(result.current.localImageEditModel).toBe('my-custom-edit-model');
    expect(result.current.localImageGenerateModel).toBe('my-custom-gen-model');
    expect(result.current.localTextGenerateModel).toBe('my-custom-text-model');
    expect(result.current.localDirectGeminiApiKey).toBe('persisted-direct-key');
  });

  it('does not call API setters when Escape closes modal without save', () => {
    vi.clearAllMocks();

    const { result } = renderHook(() =>
      useSettingsModal({ isOpen: true, onClose: onCloseMock }),
    );

    act(() => {
      result.current.setLocalImageEditModel('unsaved-model');
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onCloseMock).toHaveBeenCalled();
    expect(setImageEditModelMock).not.toHaveBeenCalled();
    expect(setImageGenerateModelMock).not.toHaveBeenCalled();
    expect(setTextGenerateModelMock).not.toHaveBeenCalled();
  });

  it('reinitializes local state from API when modal reopens after close', () => {
    apiOverrides.imageEditModel = 'api-edit-model-v2';

    const { result, rerender } = renderHook(
      ({ isOpen }: { isOpen: boolean }) =>
        useSettingsModal({ isOpen, onClose: onCloseMock }),
      { initialProps: { isOpen: true } },
    );

    act(() => {
      result.current.setLocalImageEditModel('dirty-edit');
    });
    expect(result.current.localImageEditModel).toBe('dirty-edit');

    // Close
    rerender({ isOpen: false });

    // Reopen — should reset from API
    rerender({ isOpen: true });

    expect(result.current.localImageEditModel).toBe('api-edit-model-v2');
  });
});
