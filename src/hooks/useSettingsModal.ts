/**
 * Settings Modal Hook (orchestrator)
 *
 * Composes local state/validation (useSettingsModalState) and actions (useSettingsModalActions).
 * Preserves the exact UseSettingsModalReturn surface and model constants so
 * SettingsModal.tsx needs zero changes.
 */

import { useEffect, useMemo } from 'react';
import { getModelsBySelectionType } from '../config/modelRegistry';
import { resolveSelectableModels } from '../config/modelSelectionRules';
import { useServedModels } from './useServedModels';
import { useApi } from '../contexts/ApiProviderContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../components/Toast';
import { useSettingsModalState } from './useSettingsModalState';
import { useSettingsModalActions } from './useSettingsModalActions';
import { SelectableModel } from '../types';

interface UseSettingsModalParams {
  isOpen: boolean;
  onClose: () => void;
}

export interface UseSettingsModalReturn {
  imageEditModels: SelectableModel[];
  imageGenerateModels: SelectableModel[];
  textGenerateModels: SelectableModel[];
  localImageEditModel: string;
  localImageGenerateModel: string;
  localTextGenerateModel: string;
  localCpaGatewayUrl: string;
  localCpaGatewayApiKey: string;
  geminiProfileId: string;
  isCpaGatewayUrlInvalid: boolean;
  isCpaGatewayUrlCustom: boolean;
  isCpaGatewayApiKeyMissing: boolean;
  customCpaGatewayHost: string | null;
  setLocalImageEditModel: (modelId: string) => void;
  setLocalImageGenerateModel: (modelId: string) => void;
  setLocalTextGenerateModel: (modelId: string) => void;
  setLocalCpaGatewayUrl: (url: string) => void;
  setLocalCpaGatewayApiKey: (apiKey: string) => void;
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

export const useSettingsModal = ({ isOpen, onClose }: UseSettingsModalParams): UseSettingsModalReturn => {
  const { t } = useLanguage();
  const api = useApi();
  const { images } = useImageGallery();
  const { showToast } = useToast();

  const state = useSettingsModalState({ isOpen });

  const actions = useSettingsModalActions({
    localImageEditModel: state.localImageEditModel,
    localImageGenerateModel: state.localImageGenerateModel,
    localTextGenerateModel: state.localTextGenerateModel,
    localCpaGatewayUrl: state.localCpaGatewayUrl,
    localCpaGatewayApiKey: state.localCpaGatewayApiKey,
    isCpaGatewayUrlInvalid: state.isCpaGatewayUrlInvalid,
    isCpaGatewayApiKeyMissing: state.isCpaGatewayApiKeyMissing,
    onClose,
    setImageEditModel: api.setImageEditModel,
    setImageGenerateModel: api.setImageGenerateModel,
    setTextGenerateModel: api.setTextGenerateModel,
    setCpaGatewaySettings: api.setCpaGatewaySettings,
    showToast,
    t,
  });

  // Model lists follow the Gemini lane's served models once discovery has run.
  const geminiServed = useServedModels(
    api.geminiProfile.baseUrl,
    api.geminiProfile.apiKey,
    api.servedModelsVersion,
    api.geminiProfile.id,
  );
  const models = useMemo(
    () => ({
      imageEditModels: resolveSelectableModels('imageEdit', geminiServed),
      imageGenerateModels: resolveSelectableModels('imageGenerate', geminiServed),
      textGenerateModels: toSelectableModels(getModelsBySelectionType('textGenerate')),
    }),
    [geminiServed],
  );

  // Close on Escape while the modal is open (matches original behavior).
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  return {
    ...models,
    localImageEditModel: state.localImageEditModel,
    localImageGenerateModel: state.localImageGenerateModel,
    localTextGenerateModel: state.localTextGenerateModel,
    localCpaGatewayUrl: state.localCpaGatewayUrl,
    localCpaGatewayApiKey: state.localCpaGatewayApiKey,
    geminiProfileId: api.geminiProfile.id,
    isCpaGatewayUrlInvalid: state.isCpaGatewayUrlInvalid,
    isCpaGatewayUrlCustom: state.isCpaGatewayUrlCustom,
    isCpaGatewayApiKeyMissing: state.isCpaGatewayApiKeyMissing,
    customCpaGatewayHost: state.customCpaGatewayHost,
    setLocalImageEditModel: state.setLocalImageEditModel,
    setLocalImageGenerateModel: state.setLocalImageGenerateModel,
    setLocalTextGenerateModel: state.setLocalTextGenerateModel,
    setLocalCpaGatewayUrl: state.setLocalCpaGatewayUrl,
    setLocalCpaGatewayApiKey: state.setLocalCpaGatewayApiKey,
    debugMode: state.debugMode,
    handleDebugToggle: state.handleDebugToggle,
    restoreInputRef: state.restoreInputRef,
    handleRestore: actions.handleRestore,
    handleClear: actions.handleClear,
    handleSave: actions.handleSave,
    handleBackup: actions.handleBackup,
    refreshStorageUsage: state.refreshStorageUsage,
    usageMB: state.storageInfo.usageMB,
    quotaMB: state.storageInfo.quotaMB,
    storagePercentage: state.storageInfo.storagePercentage,
  };
};
