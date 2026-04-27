import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockUseApi, mockUseImageGallery, mockUseLanguage } from '../__mocks__/contexts';

const { restoreDataMock, setDebugEnabledMock } = vi.hoisted(() => ({
  restoreDataMock: vi.fn(),
  setDebugEnabledMock: vi.fn(),
}));

vi.mock('../../src/contexts/LanguageContext', () =>
  mockUseLanguage({
    t: vi.fn((key: string) => key),
  }),
);
vi.mock('../../src/contexts/ApiProviderContext', () => mockUseApi());
vi.mock('../../src/contexts/ImageGalleryContext', () => mockUseImageGallery());
vi.mock('../../src/utils/storage', () => ({
  getLocalStorageUsage: vi.fn().mockResolvedValue({ usage: 0, quota: 1024 }),
  backupData: vi.fn(),
  restoreData: restoreDataMock,
  clearAppData: vi.fn(),
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
    expect(alertMock).toHaveBeenCalledWith('settingsModal.notifications.restoreFailed');
  });
});
