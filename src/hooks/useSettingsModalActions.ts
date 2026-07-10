/**
 * Settings modal actions (save/restore/clear/backup).
 * Extracted to keep main hook under 200 LOC.
 * Storage functions are passed in for future test seam if needed.
 */

import { useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../components/Toast';
import { backupData, clearAppData, restoreData } from '../utils/storage';
import {
  VERTEX_PROXY_ENABLED_KEY,
  VERTEX_PROXY_URL_KEY,
  VERTEX_PROXY_API_KEY_KEY,
} from './useSettingsModalState';

export interface UseSettingsModalActionsConfig {
  localDirectGeminiApiKey: string;
  localImageEditModel: string;
  localImageGenerateModel: string;
  localTextGenerateModel: string;
  localVertexProxyEnabled: boolean;
  localVertexProxyUrl: string;
  localVertexProxyApiKey: string;
  isVertexProxyUrlInvalid: boolean;
  isVertexProxyApiKeyMissing: boolean;
  onClose: () => void;
  setGoogleApiKey: (k: string | null) => void;
  setImageEditModel: (m: string) => void;
  setImageGenerateModel: (m: string) => void;
  setTextGenerateModel: (m: string) => void;
  setVertexProxySettings: (s: any) => void;
  showToast: (msg: string) => void;
  t: (k: string, o?: any) => string;
}

export interface UseSettingsModalActionsReturn {
  handleSave: () => void;
  handleRestore: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleClear: () => Promise<void>;
  handleBackup: () => void;
}

export const useSettingsModalActions = (config: UseSettingsModalActionsConfig): UseSettingsModalActionsReturn => {
  const {
    localDirectGeminiApiKey,
    localImageEditModel,
    localImageGenerateModel,
    localTextGenerateModel,
    localVertexProxyEnabled,
    localVertexProxyUrl,
    localVertexProxyApiKey,
    isVertexProxyUrlInvalid,
    isVertexProxyApiKeyMissing,
    onClose,
    setGoogleApiKey,
    setImageEditModel,
    setImageGenerateModel,
    setTextGenerateModel,
    setVertexProxySettings,
    showToast,
    t,
  } = config;

  const handleSave = useCallback(() => {
    if (localVertexProxyEnabled) {
      if (isVertexProxyUrlInvalid) {
        showToast(t('settingsModal.notifications.vertexProxyInvalidUrl'));
        return;
      }
      if (isVertexProxyApiKeyMissing) {
        showToast(t('settingsModal.notifications.vertexProxyMissingApiKey'));
        return;
      }
    }
    setGoogleApiKey(localDirectGeminiApiKey.trim() || null);
    setImageEditModel(localImageEditModel);
    setImageGenerateModel(localImageGenerateModel);
    setTextGenerateModel(localTextGenerateModel);
    setVertexProxySettings({
      enabled: localVertexProxyEnabled,
      url: localVertexProxyUrl.trim(),
      apiKey: localVertexProxyApiKey.trim(),
    });
    onClose();
  }, [
    localVertexProxyEnabled,
    isVertexProxyUrlInvalid,
    isVertexProxyApiKeyMissing,
    localDirectGeminiApiKey,
    localImageEditModel,
    localImageGenerateModel,
    localTextGenerateModel,
    localVertexProxyApiKey,
    localVertexProxyUrl,
    onClose,
    setGoogleApiKey,
    setImageEditModel,
    setImageGenerateModel,
    setTextGenerateModel,
    setVertexProxySettings,
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
    localStorage.removeItem(VERTEX_PROXY_ENABLED_KEY);
    localStorage.removeItem(VERTEX_PROXY_URL_KEY);
    localStorage.removeItem(VERTEX_PROXY_API_KEY_KEY);
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
