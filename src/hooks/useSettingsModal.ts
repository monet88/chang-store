/**
 * Settings Modal Hook (orchestrator)
 *
 * Composes local state/validation (useSettingsModalState) and actions (useSettingsModalActions).
 * Preserves the exact UseSettingsModalReturn surface and model constants so
 * SettingsModal.tsx needs zero changes.
 */

import { useEffect, useMemo } from 'react';
import { getModelsBySelectionType } from '../config/modelRegistry';
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
  localDirectGeminiApiKey: string;
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
  setLocalDirectGeminiApiKey: (apiKey: string) => void;
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

export const useSettingsModal = ({ isOpen, onClose }: UseSettingsModalParams): UseSettingsModalReturn => {
  const { t } = useLanguage();
  const api = useApi();
  const { images } = useImageGallery();
  const { showToast } = useToast();

  const state = useSettingsModalState({ isOpen });

  const actions = useSettingsModalActions({
    localDirectGeminiApiKey: state.localDirectGeminiApiKey,
    localImageEditModel: state.localImageEditModel,
    localImageGenerateModel: state.localImageGenerateModel,
    localTextGenerateModel: state.localTextGenerateModel,
    localVertexProxyEnabled: state.localVertexProxyEnabled,
    localVertexProxyUrl: state.localVertexProxyUrl,
    localVertexProxyApiKey: state.localVertexProxyApiKey,
    isVertexProxyUrlInvalid: state.isVertexProxyUrlInvalid,
    isVertexProxyApiKeyMissing: state.isVertexProxyApiKeyMissing,
    onClose,
    setGoogleApiKey: api.setGoogleApiKey,
    setImageEditModel: api.setImageEditModel,
    setImageGenerateModel: api.setImageGenerateModel,
    setTextGenerateModel: api.setTextGenerateModel,
    setVertexProxySettings: api.setVertexProxySettings,
    showToast,
    t,
  });

  const models = useMemo(
    () => ({
      imageEditModels: IMAGE_EDIT_MODELS,
      imageGenerateModels: IMAGE_GENERATE_MODELS,
      textGenerateModels: TEXT_GENERATE_MODELS,
    }),
    [],
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
    localDirectGeminiApiKey: state.localDirectGeminiApiKey,
    localVertexProxyEnabled: state.localVertexProxyEnabled,
    localVertexProxyUrl: state.localVertexProxyUrl,
    localVertexProxyApiKey: state.localVertexProxyApiKey,
    isVertexProxyUrlInvalid: state.isVertexProxyUrlInvalid,
    isVertexProxyUrlCustom: state.isVertexProxyUrlCustom,
    isVertexProxyApiKeyMissing: state.isVertexProxyApiKeyMissing,
    customVertexProxyHost: state.customVertexProxyHost,
    setLocalImageEditModel: state.setLocalImageEditModel,
    setLocalImageGenerateModel: state.setLocalImageGenerateModel,
    setLocalTextGenerateModel: state.setLocalTextGenerateModel,
    setLocalDirectGeminiApiKey: state.setLocalDirectGeminiApiKey,
    setLocalVertexProxyEnabled: state.setLocalVertexProxyEnabled,
    setLocalVertexProxyUrl: state.setLocalVertexProxyUrl,
    setLocalVertexProxyApiKey: state.setLocalVertexProxyApiKey,
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
