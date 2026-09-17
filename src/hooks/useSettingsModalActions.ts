/**
 * Settings modal actions (save/restore/clear/backup).
 * Extracted to keep main hook under 200 LOC.
 * Storage functions are passed in for future test seam if needed.
 */

import { useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../components/Toast';
import { backupData, clearAppData, restoreData } from '../utils/storage';
import type { CpaGatewaySettings } from '../contexts/ApiProviderContext';
import {
  CPA_GATEWAY_URL_KEY,
  CPA_GATEWAY_API_KEY_KEY,
} from './useSettingsModalState';

export interface UseSettingsModalActionsConfig {
  localImageEditModel: string;
  localImageGenerateModel: string;
  localTextGenerateModel: string;
  localCpaGatewayUrl: string;
  localCpaGatewayApiKey: string;
  isCpaGatewayUrlInvalid: boolean;
  isCpaGatewayApiKeyMissing: boolean;
  onClose: () => void;
  setImageEditModel: (m: string) => void;
  setImageGenerateModel: (m: string) => void;
  setTextGenerateModel: (m: string) => void;
  setCpaGatewaySettings: (s: CpaGatewaySettings) => void;
  showToast: (msg: string) => void;
  t: (k: string, o?: Record<string, string | number>) => string;
}

export interface UseSettingsModalActionsReturn {
  handleSave: () => void;
  handleRestore: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleClear: () => Promise<void>;
  handleBackup: () => void;
}

export const useSettingsModalActions = (config: UseSettingsModalActionsConfig): UseSettingsModalActionsReturn => {
  const {
    localImageEditModel,
    localImageGenerateModel,
    localTextGenerateModel,
    localCpaGatewayUrl,
    localCpaGatewayApiKey,
    isCpaGatewayUrlInvalid,
    isCpaGatewayApiKeyMissing,
    onClose,
    setImageEditModel,
    setImageGenerateModel,
    setTextGenerateModel,
    setCpaGatewaySettings,
    showToast,
    t,
  } = config;

  const handleSave = useCallback(() => {
    if (isCpaGatewayUrlInvalid) {
      showToast(t('settingsModal.notifications.cpaGatewayInvalidUrl'));
      return;
    }
    if (isCpaGatewayApiKeyMissing) {
      showToast(t('settingsModal.notifications.cpaGatewayMissingApiKey'));
      return;
    }
    setImageEditModel(localImageEditModel);
    setImageGenerateModel(localImageGenerateModel);
    setTextGenerateModel(localTextGenerateModel);
    setCpaGatewaySettings({
      url: localCpaGatewayUrl.trim(),
      apiKey: localCpaGatewayApiKey.trim(),
    });
    onClose();
  }, [
    isCpaGatewayUrlInvalid,
    isCpaGatewayApiKeyMissing,
    localImageEditModel,
    localImageGenerateModel,
    localTextGenerateModel,
    localCpaGatewayApiKey,
    localCpaGatewayUrl,
    onClose,
    setImageEditModel,
    setImageGenerateModel,
    setTextGenerateModel,
    setCpaGatewaySettings,
    showToast,
    t,
  ]);

  const handleRestore = useCallback(async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      showToast(t('settingsModal.notifications.invalidFileType'));
      input.value = '';
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      showToast(t('settingsModal.notifications.fileTooLarge'));
      input.value = '';
      return;
    }
    input.value = '';

    try {
      await restoreData(file);
      alert(t('settingsModal.notifications.restoreSuccess'));
      window.location.reload();
    } catch (error) {
      showToast(
        t('settingsModal.notifications.restoreFailed', {
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }, [t, showToast]);

  const handleClear = useCallback(async () => {
    if (!window.confirm(t('settingsModal.confirmations.clearAllData'))) {
      return;
    }
    localStorage.removeItem(CPA_GATEWAY_URL_KEY);
    localStorage.removeItem(CPA_GATEWAY_API_KEY_KEY);
    await clearAppData();
    alert(t('settingsModal.notifications.clearSuccess'));
    window.location.reload();
  }, [t]);

  return {
    handleSave,
    handleRestore,
    handleClear,
    handleBackup: backupData,
  };
};
