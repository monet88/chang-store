import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getModelsBySelectionType } from '../config/modelRegistry';
import { useApi } from '../contexts/ApiProviderContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useLanguage } from '../contexts/LanguageContext';
import { isDebugEnabled, setDebugEnabled } from '../services/debugService';
import { SelectableModel } from '../types';
import { useToast } from '../components/Toast';
import { backupData, clearAppData, getLocalStorageUsage, restoreData } from '../utils/storage';
import { validateProviderBaseUrl } from '../utils/provider-url-validation';

interface UseSettingsModalParams {
  isOpen: boolean;
  onClose: () => void;
}

interface StorageInfo {
  usageMB: string;
  quotaMB: string;
  storagePercentage: number;
}

const VERTEX_PROXY_ENABLED_KEY = 'vertex_proxy_enabled';
const VERTEX_PROXY_URL_KEY = 'vertex_proxy_url';
const VERTEX_PROXY_API_KEY_KEY = 'vertex_proxy_api_key';

export interface UseSettingsModalReturn {
  imageEditModels: SelectableModel[];
  imageGenerateModels: SelectableModel[];
  textGenerateModels: SelectableModel[];
  localImageEditModel: string;
  localImageGenerateModel: string;
  localTextGenerateModel: string;
  localVertexProxyEnabled: boolean;
  localVertexProxyUrl: string;
  localVertexProxyApiKey: string;
  isVertexProxyUrlInvalid: boolean;
  isVertexProxyUrlCustom: boolean;
  isVertexProxyApiKeyMissing: boolean;
  customVertexProxyHost: string | null;
  setLocalImageEditModel: (modelId: string) => void;
  setLocalImageGenerateModel: (modelId: string) => void;
  setLocalTextGenerateModel: (modelId: string) => void;
  setLocalVertexProxyEnabled: (enabled: boolean) => void;
  setLocalVertexProxyUrl: (url: string) => void;
  setLocalVertexProxyApiKey: (apiKey: string) => void;
  debugMode: boolean;
  handleDebugToggle: () => void;
  restoreInputRef: React.RefObject<HTMLInputElement>;
  handleRestore: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleClear: () => void;
  handleSave: () => void;
  handleBackup: () => void;
  refreshStorageUsage: () => Promise<void>;
  usageMB: string;
  quotaMB: string;
  storagePercentage: number;
}

const toSelectableModels = (
  models: ReturnType<typeof getModelsBySelectionType>,
): SelectableModel[] => models.map(({ modelId, label }) => ({ modelId, label }));

const IMAGE_EDIT_MODELS = toSelectableModels(getModelsBySelectionType('imageEdit'));
const IMAGE_GENERATE_MODELS = toSelectableModels(getModelsBySelectionType('imageGenerate'));
const TEXT_GENERATE_MODELS = toSelectableModels(getModelsBySelectionType('textGenerate'));

const DEFAULT_STORAGE_INFO: StorageInfo = {
  usageMB: '0.00',
  quotaMB: '200.00',
  storagePercentage: 0,
};

export const useSettingsModal = ({ isOpen, onClose }: UseSettingsModalParams): UseSettingsModalReturn => {
  const { t } = useLanguage();
  const {
    imageEditModel,
    setImageEditModel,
    imageGenerateModel,
    setImageGenerateModel,
    textGenerateModel,
    setTextGenerateModel,
    vertexProxySettings,
    setVertexProxySettings,
  } = useApi();
  const { images } = useImageGallery();
  const { showToast } = useToast();

  const [localImageEditModel, setLocalImageEditModel] = useState(imageEditModel);
  const [localImageGenerateModel, setLocalImageGenerateModel] = useState(imageGenerateModel);
  const [localTextGenerateModel, setLocalTextGenerateModel] = useState(textGenerateModel);
  const [localVertexProxyEnabled, setLocalVertexProxyEnabled] = useState(vertexProxySettings.enabled);
  const [localVertexProxyUrl, setLocalVertexProxyUrl] = useState(vertexProxySettings.url);
  const [localVertexProxyApiKey, setLocalVertexProxyApiKey] = useState(vertexProxySettings.apiKey);
  const [debugMode, setDebugMode] = useState(() => isDebugEnabled());
  const [storageInfo, setStorageInfo] = useState<StorageInfo>(DEFAULT_STORAGE_INFO);

  const restoreInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  const vertexProxyUrlValidation = useMemo(
    () => validateProviderBaseUrl(localVertexProxyUrl),
    [localVertexProxyUrl],
  );
  const isVertexProxyUrlInvalid = vertexProxyUrlValidation.status === 'invalid';
  const isVertexProxyUrlCustom = vertexProxyUrlValidation.status === 'custom';
  const isVertexProxyApiKeyMissing = localVertexProxyEnabled && localVertexProxyApiKey.trim().length === 0;
  const customVertexProxyHost = isVertexProxyUrlCustom ? vertexProxyUrlValidation.host : null;

  const refreshStorageUsage = useCallback(async (): Promise<void> => {
    const { usage, quota } = await getLocalStorageUsage();
    const safeQuota = quota > 0 ? quota : 200 * 1024 * 1024;

    setStorageInfo({
      usageMB: (usage / 1024 / 1024).toFixed(2),
      quotaMB: (safeQuota / 1024 / 1024).toFixed(2),
      storagePercentage: safeQuota > 0 ? (usage / safeQuota) * 100 : 0,
    });
  }, []);

  const handleDebugToggle = useCallback(() => {
    const nextValue = !debugMode;
    setDebugMode(nextValue);
    setDebugEnabled(nextValue);
  }, [debugMode]);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    if (wasOpenRef.current) {
      return;
    }

    wasOpenRef.current = true;
    setLocalImageEditModel(imageEditModel);
    setLocalImageGenerateModel(imageGenerateModel);
    setLocalTextGenerateModel(textGenerateModel);
    setLocalVertexProxyEnabled(vertexProxySettings.enabled);
    setLocalVertexProxyUrl(vertexProxySettings.url);
    setLocalVertexProxyApiKey(vertexProxySettings.apiKey);
  }, [
    isOpen,
    imageEditModel,
    imageGenerateModel,
    textGenerateModel,
    vertexProxySettings,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void refreshStorageUsage();
  }, [isOpen, images, refreshStorageUsage]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleSave = useCallback(() => {
    if (localVertexProxyEnabled) {
      if (isVertexProxyUrlInvalid) {
        showToast(t('settingsModal.notifications.vertexProxyInvalidUrl'));
        return;
      }

      if (localVertexProxyApiKey.trim().length === 0) {
        showToast(t('settingsModal.notifications.vertexProxyMissingApiKey'));
        return;
      }
    }

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
    isVertexProxyUrlInvalid,
    localImageEditModel,
    localImageGenerateModel,
    localTextGenerateModel,
    localVertexProxyApiKey,
    localVertexProxyEnabled,
    localVertexProxyUrl,
    onClose,
    setImageEditModel,
    setImageGenerateModel,
    setTextGenerateModel,
    setVertexProxySettings,
    showToast,
    t,
  ]);

  const handleRestore = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      if (!file) {
        return;
      }

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
    },
    [t, showToast],
  );

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

  const models = useMemo(
    () => ({
      imageEditModels: IMAGE_EDIT_MODELS,
      imageGenerateModels: IMAGE_GENERATE_MODELS,
      textGenerateModels: TEXT_GENERATE_MODELS,
    }),
    [],
  );

  return {
    ...models,
    localImageEditModel,
    localImageGenerateModel,
    localTextGenerateModel,
    localVertexProxyEnabled,
    localVertexProxyUrl,
    localVertexProxyApiKey,
    isVertexProxyUrlInvalid,
    isVertexProxyUrlCustom,
    isVertexProxyApiKeyMissing,
    customVertexProxyHost,
    setLocalImageEditModel,
    setLocalImageGenerateModel,
    setLocalTextGenerateModel,
    setLocalVertexProxyEnabled,
    setLocalVertexProxyUrl,
    setLocalVertexProxyApiKey,
    debugMode,
    handleDebugToggle,
    restoreInputRef,
    handleRestore,
    handleClear,
    handleSave,
    handleBackup: backupData,
    refreshStorageUsage,
    usageMB: storageInfo.usageMB,
    quotaMB: storageInfo.quotaMB,
    storagePercentage: storageInfo.storagePercentage,
  };
};
