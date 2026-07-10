import React, { createContext, useState, useContext, ReactNode, useEffect, useRef, useMemo, useCallback } from 'react';
import { ImageEditModel, ImageGenerateModel, TextGenerateModel } from '../types';
import { getDefaultModelForSelectionType, isKnownModelForSelectionType, ModelSelectionType } from '../config/modelRegistry';
import { ProviderId, PROVIDER_IDS, getProviderDefaultBaseUrl, getProviderEnvApiKey } from '../config/providerRegistry';
import { configureGeminiClient, setGeminiApiKey } from '../services/apiClient';
import { useToast } from '../components/Toast';
import { validateProviderBaseUrl } from '../utils/provider-url-validation';
import { useLanguage } from './LanguageContext';

/** User-overridable settings for a single provider studio. */
export interface ProviderSettings {
  apiKey: string;
  baseUrl: string;
}

export interface VertexProxySettings {
  enabled: boolean;
  url: string;
  apiKey: string;
}

interface ApiContextType {
  googleApiKey: string | null;
  setGoogleApiKey: (key: string | null) => void;
  imageEditModel: ImageEditModel;
  setImageEditModel: (model: ImageEditModel) => void;
  imageGenerateModel: ImageGenerateModel;
  setImageGenerateModel: (model: ImageGenerateModel) => void;
  textGenerateModel: TextGenerateModel;
  setTextGenerateModel: (model: TextGenerateModel) => void;
  vertexProxySettings: VertexProxySettings;
  setVertexProxySettings: (settings: VertexProxySettings) => void;
  /** Resolved provider settings (env defaults merged with localStorage overrides). */
  providerSettings: Record<ProviderId, ProviderSettings>;
  /** Persist a partial override for a provider. */
  setProviderSettings: (provider: ProviderId, settings: Partial<ProviderSettings>) => void;
  /** Clear user overrides for a provider and fall back to env defaults. */
  resetProviderSettings: (provider: ProviderId) => void;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);
const IMAGE_EDIT_MODEL_KEY = 'image_edit_model';
const IMAGE_GENERATE_MODEL_KEY = 'image_generate_model';
const TEXT_GENERATE_MODEL_KEY = 'text_generate_model';
const LEGACY_GOOGLE_API_KEY = 'google_api_key';
const VERTEX_PROXY_ENABLED_KEY = 'vertex_proxy_enabled';
const VERTEX_PROXY_URL_KEY = 'vertex_proxy_url';
const VERTEX_PROXY_API_KEY_KEY = 'vertex_proxy_api_key';
const DEFAULT_VERTEX_PROXY_ENABLED = true;
const DEFAULT_VERTEX_PROXY_URL = 'https://vertex.monet.uno/gemini';
const LEGACY_CLIPROXY_HOST = 'cliproxy.monet.uno';

const providerApiKeyStorageKey = (provider: ProviderId): string => `provider:${provider}:apiKey`;
const providerBaseUrlStorageKey = (provider: ProviderId): string => `provider:${provider}:baseUrl`;

const safeStorage = {
  getItem: (key: string) => {
    if (typeof localStorage === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn('[safeStorage] Failed to save:', key, error);
    }
  },
  removeItem: (key: string) => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('[safeStorage] Failed to remove:', key, error);
    }
  },
};

const resolveStoredModel = (selectionType: ModelSelectionType, storedValue: string | null): string => {
  if (storedValue && isKnownModelForSelectionType(selectionType, storedValue)) {
    return storedValue;
  }

  return getDefaultModelForSelectionType(selectionType);
};

const isLegacyCliproxyUrl = (url: string): boolean => {
  try {
    return new URL(url).hostname === LEGACY_CLIPROXY_HOST;
  } catch {
    return false;
  }
};

const resolveStoredVertexProxySettings = (): { invalidRestore: boolean; settings: VertexProxySettings } => {
  const storedEnabled = safeStorage.getItem(VERTEX_PROXY_ENABLED_KEY);
  const enabled = storedEnabled === null ? DEFAULT_VERTEX_PROXY_ENABLED : storedEnabled === 'true';
  const storedUrl = safeStorage.getItem(VERTEX_PROXY_URL_KEY)?.trim() || '';
  // Retired cliproxy host → auto-upgrade so existing installs stop hitting a dead endpoint.
  const rawUrl = !storedUrl || isLegacyCliproxyUrl(storedUrl) ? DEFAULT_VERTEX_PROXY_URL : storedUrl;
  if (storedUrl && isLegacyCliproxyUrl(storedUrl)) {
    safeStorage.setItem(VERTEX_PROXY_URL_KEY, DEFAULT_VERTEX_PROXY_URL);
  }
  const apiKey = safeStorage.getItem(VERTEX_PROXY_API_KEY_KEY)?.trim() || '';
  const validation = validateProviderBaseUrl(rawUrl);
  const hasStoredRuntimeConfig = storedEnabled !== null;
  const hasInvalidRuntimeConfig = hasStoredRuntimeConfig && enabled && (validation.status === 'invalid' || apiKey.length === 0);

  return {
    invalidRestore: hasInvalidRuntimeConfig,
    settings: {
      enabled: hasInvalidRuntimeConfig ? false : enabled,
      url: validation.status === 'invalid' ? DEFAULT_VERTEX_PROXY_URL : rawUrl,
      apiKey,
    },
  };
};

export const ApiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const { t } = useLanguage();
  const restoredVertexProxyRef = useRef(resolveStoredVertexProxySettings());
  const storedGoogleApiKey = safeStorage.getItem(LEGACY_GOOGLE_API_KEY)?.trim() || null;
  const [googleApiKey, setGoogleApiKeyState] = useState<string | null>(storedGoogleApiKey);
  const [vertexProxySettings, setVertexProxySettingsState] = useState<VertexProxySettings>(
    restoredVertexProxyRef.current.settings,
  );

  const resolveProviderSettings = (provider: ProviderId): ProviderSettings => {
    const storedApiKey = safeStorage.getItem(providerApiKeyStorageKey(provider));
    const storedBaseUrl = safeStorage.getItem(providerBaseUrlStorageKey(provider));
    return {
      apiKey: storedApiKey ?? getProviderEnvApiKey(provider),
      baseUrl: storedBaseUrl ?? getProviderDefaultBaseUrl(provider),
    };
  };

  const [providerSettings, setProviderSettingsState] = useState<Record<ProviderId, ProviderSettings>>(() => {
    const initial = {} as Record<ProviderId, ProviderSettings>;
    for (const provider of PROVIDER_IDS) {
      initial[provider] = resolveProviderSettings(provider);
    }
    return initial;
  });

  const setProviderSettings = useCallback((provider: ProviderId, settings: Partial<ProviderSettings>) => {
    setProviderSettingsState((current) => {
      const next: ProviderSettings = { ...current[provider], ...settings };
      if (settings.apiKey !== undefined) {
        safeStorage.setItem(providerApiKeyStorageKey(provider), next.apiKey);
      }
      if (settings.baseUrl !== undefined) {
        safeStorage.setItem(providerBaseUrlStorageKey(provider), next.baseUrl);
      }
      return { ...current, [provider]: next };
    });
  }, []);

  const resetProviderSettings = useCallback((provider: ProviderId) => {
    safeStorage.removeItem(providerApiKeyStorageKey(provider));
    safeStorage.removeItem(providerBaseUrlStorageKey(provider));
    setProviderSettingsState((current) => ({
      ...current,
      [provider]: {
        apiKey: getProviderEnvApiKey(provider),
        baseUrl: getProviderDefaultBaseUrl(provider),
      },
    }));
  }, []);

  const [imageEditModel, setImageEditModelState] = useState<ImageEditModel>(() => {
    const saved = safeStorage.getItem(IMAGE_EDIT_MODEL_KEY);
    return resolveStoredModel('imageEdit', saved);
  });
  const [imageGenerateModel, setImageGenerateModelState] = useState<ImageGenerateModel>(() => {
    const saved = safeStorage.getItem(IMAGE_GENERATE_MODEL_KEY);
    return resolveStoredModel('imageGenerate', saved);
  });
  const [textGenerateModel, setTextGenerateModelState] = useState<TextGenerateModel>(() => {
    const saved = safeStorage.getItem(TEXT_GENERATE_MODEL_KEY);
    return resolveStoredModel('textGenerate', saved);
  });

  useEffect(() => {
    if (!restoredVertexProxyRef.current.invalidRestore) {
      return;
    }

    safeStorage.setItem(VERTEX_PROXY_ENABLED_KEY, 'false');
    safeStorage.setItem(VERTEX_PROXY_URL_KEY, restoredVertexProxyRef.current.settings.url);

    if (restoredVertexProxyRef.current.settings.apiKey) {
      safeStorage.setItem(VERTEX_PROXY_API_KEY_KEY, restoredVertexProxyRef.current.settings.apiKey);
    } else {
      safeStorage.removeItem(VERTEX_PROXY_API_KEY_KEY);
    }

    restoredVertexProxyRef.current.invalidRestore = false;
    showToast(t('settingsModal.notifications.vertexProxyRestoreInvalid'));
  }, [showToast, t]);

  useEffect(() => {
    const storedImageEditModel = safeStorage.getItem(IMAGE_EDIT_MODEL_KEY);
    if (storedImageEditModel && !isKnownModelForSelectionType('imageEdit', storedImageEditModel)) {
      safeStorage.setItem(IMAGE_EDIT_MODEL_KEY, imageEditModel);
    }

    const storedImageGenerateModel = safeStorage.getItem(IMAGE_GENERATE_MODEL_KEY);
    if (storedImageGenerateModel && !isKnownModelForSelectionType('imageGenerate', storedImageGenerateModel)) {
      safeStorage.setItem(IMAGE_GENERATE_MODEL_KEY, imageGenerateModel);
    }

    const storedTextGenerateModel = safeStorage.getItem(TEXT_GENERATE_MODEL_KEY);
    if (storedTextGenerateModel && !isKnownModelForSelectionType('textGenerate', storedTextGenerateModel)) {
      safeStorage.setItem(TEXT_GENERATE_MODEL_KEY, textGenerateModel);
    }
  }, [imageEditModel, imageGenerateModel, textGenerateModel]);

  useEffect(() => {
    if (vertexProxySettings.enabled) {
      const validation = validateProviderBaseUrl(vertexProxySettings.url);
      const proxyApiKey = vertexProxySettings.apiKey.trim();

      if (validation.status !== 'invalid' && proxyApiKey) {
        configureGeminiClient({
          apiKey: proxyApiKey,
          baseUrl: validation.url,
          requireExplicitApiKey: true,
        });
        return;
      }
    }

    configureGeminiClient({
      apiKey: googleApiKey,
      baseUrl: null,
      requireExplicitApiKey: false,
    });
  }, [googleApiKey, vertexProxySettings]);

  const setGoogleApiKey = useCallback((key: string | null) => {
    const trimmedKey = key?.trim() || null;
    setGoogleApiKeyState(trimmedKey);
    if (trimmedKey) {
      safeStorage.setItem(LEGACY_GOOGLE_API_KEY, trimmedKey);
    } else {
      safeStorage.removeItem(LEGACY_GOOGLE_API_KEY);
    }
    setGeminiApiKey(trimmedKey);
  }, []);

  const setVertexProxySettings = useCallback((settings: VertexProxySettings) => {
    setVertexProxySettingsState(settings);
    safeStorage.setItem(VERTEX_PROXY_ENABLED_KEY, String(settings.enabled));
    safeStorage.setItem(VERTEX_PROXY_URL_KEY, settings.url);
    safeStorage.setItem(VERTEX_PROXY_API_KEY_KEY, settings.apiKey);
  }, []);

  const setImageEditModel = useCallback((model: ImageEditModel) => {
    setImageEditModelState(model);
    safeStorage.setItem(IMAGE_EDIT_MODEL_KEY, model);
  }, []);

  const setImageGenerateModel = useCallback((model: ImageGenerateModel) => {
    setImageGenerateModelState(model);
    safeStorage.setItem(IMAGE_GENERATE_MODEL_KEY, model);
  }, []);

  const setTextGenerateModel = useCallback((model: TextGenerateModel) => {
    setTextGenerateModelState(model);
    safeStorage.setItem(TEXT_GENERATE_MODEL_KEY, model);
  }, []);

  // ⚡ Bolt: Wrap Context Provider value in useMemo to preserve object identity
  // and prevent massive cascading re-renders across all consumer components.
  const contextValue = useMemo(() => ({
      googleApiKey,
      setGoogleApiKey,
      imageEditModel,
      setImageEditModel,
      imageGenerateModel,
      setImageGenerateModel,
      textGenerateModel,
      setTextGenerateModel,
      vertexProxySettings,
      setVertexProxySettings,
      providerSettings,
      setProviderSettings,
      resetProviderSettings,
  }), [googleApiKey, setGoogleApiKey, imageEditModel, setImageEditModel, imageGenerateModel, setImageGenerateModel, textGenerateModel, setTextGenerateModel, vertexProxySettings, setVertexProxySettings, providerSettings, setProviderSettings, resetProviderSettings]);

  return (
    <ApiContext.Provider value={contextValue}>
      {children}
    </ApiContext.Provider>
  );
};

export const useApi = (): ApiContextType => {
  const context = useContext(ApiContext);
  if (context === undefined) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};
