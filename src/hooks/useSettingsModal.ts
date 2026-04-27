import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getModelsBySelectionType } from '../config/modelRegistry';
import { useApi } from '../contexts/ApiProviderContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useLanguage } from '../contexts/LanguageContext';
import { isDebugEnabled, setDebugEnabled } from '../services/debugService';
import { SelectableModel } from '../types';
import { backupData, clearAppData, getLocalStorageUsage, restoreData } from '../utils/storage';

interface UseSettingsModalParams {
  isOpen: boolean;
  onClose: () => void;
}

interface StorageInfo {
  usageMB: string;
  quotaMB: string;
  storagePercentage: number;
}

export interface UseSettingsModalReturn {
  imageEditModels: SelectableModel[];
  imageGenerateModels: SelectableModel[];
  textGenerateModels: SelectableModel[];
  localImageEditModel: string;
  localImageGenerateModel: string;
  localTextGenerateModel: string;
  setLocalImageEditModel: (modelId: string) => void;
  setLocalImageGenerateModel: (modelId: string) => void;
  setLocalTextGenerateModel: (modelId: string) => void;
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
  } = useApi();
  const { images } = useImageGallery();

  const [localImageEditModel, setLocalImageEditModel] = useState(imageEditModel);
  const [localImageGenerateModel, setLocalImageGenerateModel] = useState(imageGenerateModel);
  const [localTextGenerateModel, setLocalTextGenerateModel] = useState(textGenerateModel);
  const [debugMode, setDebugMode] = useState(() => isDebugEnabled());
  const [storageInfo, setStorageInfo] = useState<StorageInfo>(DEFAULT_STORAGE_INFO);

  const restoreInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

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
  }, [isOpen, imageEditModel, imageGenerateModel, textGenerateModel]);

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
    setImageEditModel(localImageEditModel);
    setImageGenerateModel(localImageGenerateModel);
    setTextGenerateModel(localTextGenerateModel);
    onClose();
  }, [
    localImageEditModel,
    localImageGenerateModel,
    localTextGenerateModel,
    setImageEditModel,
    setImageGenerateModel,
    setTextGenerateModel,
    onClose,
  ]);

  const handleRestore = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      if (!file) {
        return;
      }

      input.value = '';

      try {
        await restoreData(file);
        alert(t('settingsModal.notifications.restoreSuccess'));
        window.location.reload();
      } catch (error) {
        alert(
          t('settingsModal.notifications.restoreFailed', {
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    },
    [t],
  );

  const handleClear = useCallback(() => {
    if (!window.confirm(t('settingsModal.confirmations.clearAllData'))) {
      return;
    }

    clearAppData();
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
    setLocalImageEditModel,
    setLocalImageGenerateModel,
    setLocalTextGenerateModel,
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
