/**
 * Settings modal local state + derived validation + storage usage.
 * Extracted to keep useSettingsModal under the 200 LOC limit.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { isDebugEnabled, setDebugEnabled } from '../services/debugService';
import { validateProviderBaseUrl } from '../utils/provider-url-validation';
import { getLocalStorageUsage } from '../utils/storage';
import { isStoredDesktopCredential } from '../platform/desktopGateway';

const CPA_GATEWAY_URL_KEY = 'cpa_gateway_url';
const CPA_GATEWAY_API_KEY_KEY = 'cpa_gateway_api_key';

export {
  CPA_GATEWAY_URL_KEY,
  CPA_GATEWAY_API_KEY_KEY,
};

interface StorageInfo {
  usageMB: string;
  quotaMB: string;
  storagePercentage: number;
}

const DEFAULT_STORAGE_INFO: StorageInfo = {
  usageMB: '0.00',
  quotaMB: '200.00',
  storagePercentage: 0,
};

export interface UseSettingsModalStateParams {
  isOpen: boolean;
}

export interface UseSettingsModalStateReturn {
  localImageEditModel: string;
  setLocalImageEditModel: (v: string) => void;
  localImageGenerateModel: string;
  setLocalImageGenerateModel: (v: string) => void;
  localTextGenerateModel: string;
  setLocalTextGenerateModel: (v: string) => void;
  localCpaGatewayUrl: string;
  setLocalCpaGatewayUrl: (v: string) => void;
  localCpaGatewayApiKey: string;
  setLocalCpaGatewayApiKey: (v: string) => void;
  debugMode: boolean;
  handleDebugToggle: () => void;
  isCpaGatewayUrlInvalid: boolean;
  isCpaGatewayUrlCustom: boolean;
  isCpaGatewayApiKeyMissing: boolean;
  customCpaGatewayHost: string | null;
  storageInfo: StorageInfo;
  refreshStorageUsage: () => Promise<void>;
  restoreInputRef: React.RefObject<HTMLInputElement>;
}

export const useSettingsModalState = ({ isOpen }: UseSettingsModalStateParams): UseSettingsModalStateReturn => {
  const { t } = useLanguage();
  const {
    imageEditModel,
    imageGenerateModel,
    textGenerateModel,
    cpaGatewaySettings,
  } = useApi();
  const { images } = useImageGallery();

  const [localImageEditModel, setLocalImageEditModel] = useState(imageEditModel);
  const [localImageGenerateModel, setLocalImageGenerateModel] = useState(imageGenerateModel);
  const [localTextGenerateModel, setLocalTextGenerateModel] = useState(textGenerateModel);
  const [localCpaGatewayUrl, setLocalCpaGatewayUrl] = useState(cpaGatewaySettings.url);
  const [localCpaGatewayApiKey, setLocalCpaGatewayApiKey] = useState(cpaGatewaySettings.apiKey);
  const [debugMode, setDebugMode] = useState(() => isDebugEnabled());
  const [storageInfo, setStorageInfo] = useState<StorageInfo>(DEFAULT_STORAGE_INFO);

  const restoreInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  const cpaGatewayUrlValidation = useMemo(
    () => validateProviderBaseUrl(localCpaGatewayUrl),
    [localCpaGatewayUrl],
  );
  const hasCpaGatewayChanges = useMemo(
    () => (
      localCpaGatewayUrl.trim() !== cpaGatewaySettings.url
      || localCpaGatewayApiKey !== cpaGatewaySettings.apiKey
    ),
    [localCpaGatewayApiKey, localCpaGatewayUrl, cpaGatewaySettings],
  );
  const isCpaGatewayUrlInvalid = cpaGatewayUrlValidation.status === 'invalid';
  const isCpaGatewayUrlCustom = cpaGatewayUrlValidation.status === 'custom';
  const cpaGatewayUrlChanged = localCpaGatewayUrl.trim() !== cpaGatewaySettings.url;
  const isCpaGatewayApiKeyMissing = (
    localCpaGatewayApiKey.trim().length === 0
    || (cpaGatewayUrlChanged && isStoredDesktopCredential(localCpaGatewayApiKey))
  ) && hasCpaGatewayChanges;
  const customCpaGatewayHost = isCpaGatewayUrlCustom ? cpaGatewayUrlValidation.host : null;

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
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;
    setLocalImageEditModel(imageEditModel);
    setLocalImageGenerateModel(imageGenerateModel);
    setLocalTextGenerateModel(textGenerateModel);
    setLocalCpaGatewayUrl(cpaGatewaySettings.url);
    setLocalCpaGatewayApiKey(cpaGatewaySettings.apiKey);
  }, [isOpen, imageEditModel, imageGenerateModel, textGenerateModel, cpaGatewaySettings]);

  useEffect(() => {
    if (!isOpen) return;
    void refreshStorageUsage();
  }, [isOpen, images, refreshStorageUsage]);

  return {
    localImageEditModel,
    setLocalImageEditModel,
    localImageGenerateModel,
    setLocalImageGenerateModel,
    localTextGenerateModel,
    setLocalTextGenerateModel,
    localCpaGatewayUrl,
    setLocalCpaGatewayUrl,
    localCpaGatewayApiKey,
    setLocalCpaGatewayApiKey,
    debugMode,
    handleDebugToggle,
    isCpaGatewayUrlInvalid,
    isCpaGatewayUrlCustom,
    isCpaGatewayApiKeyMissing,
    customCpaGatewayHost,
    storageInfo,
    refreshStorageUsage,
    restoreInputRef,
  };
};
