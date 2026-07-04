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

const VERTEX_PROXY_ENABLED_KEY = 'vertex_proxy_enabled';
const VERTEX_PROXY_URL_KEY = 'vertex_proxy_url';
const VERTEX_PROXY_API_KEY_KEY = 'vertex_proxy_api_key';

export {
  VERTEX_PROXY_ENABLED_KEY,
  VERTEX_PROXY_URL_KEY,
  VERTEX_PROXY_API_KEY_KEY,
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
  localDirectGeminiApiKey: string;
  setLocalDirectGeminiApiKey: (v: string) => void;
  localVertexProxyEnabled: boolean;
  setLocalVertexProxyEnabled: (v: boolean) => void;
  localVertexProxyUrl: string;
  setLocalVertexProxyUrl: (v: string) => void;
  localVertexProxyApiKey: string;
  setLocalVertexProxyApiKey: (v: string) => void;
  debugMode: boolean;
  handleDebugToggle: () => void;
  isVertexProxyUrlInvalid: boolean;
  isVertexProxyUrlCustom: boolean;
  isVertexProxyApiKeyMissing: boolean;
  customVertexProxyHost: string | null;
  storageInfo: StorageInfo;
  refreshStorageUsage: () => Promise<void>;
  restoreInputRef: React.RefObject<HTMLInputElement>;
}

export const useSettingsModalState = ({ isOpen }: UseSettingsModalStateParams): UseSettingsModalStateReturn => {
  const { t } = useLanguage();
  const {
    googleApiKey,
    imageEditModel,
    imageGenerateModel,
    textGenerateModel,
    vertexProxySettings,
  } = useApi();
  const { images } = useImageGallery();

  const [localImageEditModel, setLocalImageEditModel] = useState(imageEditModel);
  const [localImageGenerateModel, setLocalImageGenerateModel] = useState(imageGenerateModel);
  const [localTextGenerateModel, setLocalTextGenerateModel] = useState(textGenerateModel);
  const [localDirectGeminiApiKey, setLocalDirectGeminiApiKey] = useState(googleApiKey ?? '');
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
  const hasVertexProxyChanges = useMemo(
    () => (
      localVertexProxyEnabled !== vertexProxySettings.enabled
      || localVertexProxyUrl.trim() !== vertexProxySettings.url
      || localVertexProxyApiKey !== vertexProxySettings.apiKey
    ),
    [localVertexProxyApiKey, localVertexProxyEnabled, localVertexProxyUrl, vertexProxySettings],
  );
  const isVertexProxyUrlInvalid = vertexProxyUrlValidation.status === 'invalid';
  const isVertexProxyUrlCustom = vertexProxyUrlValidation.status === 'custom';
  const isVertexProxyApiKeyMissing = localVertexProxyEnabled
    && localVertexProxyApiKey.trim().length === 0
    && hasVertexProxyChanges;
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
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;
    setLocalImageEditModel(imageEditModel);
    setLocalImageGenerateModel(imageGenerateModel);
    setLocalTextGenerateModel(textGenerateModel);
    setLocalDirectGeminiApiKey(googleApiKey ?? '');
    setLocalVertexProxyEnabled(vertexProxySettings.enabled);
    setLocalVertexProxyUrl(vertexProxySettings.url);
    setLocalVertexProxyApiKey(vertexProxySettings.apiKey);
  }, [isOpen, googleApiKey, imageEditModel, imageGenerateModel, textGenerateModel, vertexProxySettings]);

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
    localDirectGeminiApiKey,
    setLocalDirectGeminiApiKey,
    localVertexProxyEnabled,
    setLocalVertexProxyEnabled,
    localVertexProxyUrl,
    setLocalVertexProxyUrl,
    localVertexProxyApiKey,
    setLocalVertexProxyApiKey,
    debugMode,
    handleDebugToggle,
    isVertexProxyUrlInvalid,
    isVertexProxyUrlCustom,
    isVertexProxyApiKeyMissing,
    customVertexProxyHost,
    storageInfo,
    refreshStorageUsage,
    restoreInputRef,
  };
};
