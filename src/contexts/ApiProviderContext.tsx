import React, { createContext, useState, useContext, ReactNode, useEffect, useRef, useMemo, useCallback } from 'react';
import { ImageEditModel, ImageGenerateModel, TextGenerateModel } from '../types';
import { getDefaultModelForSelectionType, isKnownModelForSelectionType, ModelSelectionType } from '../config/modelRegistry';
import { ProviderId, PROVIDER_IDS, getProviderDefaultBaseUrl, getProviderEnvApiKey } from '../config/providerRegistry';
import { configureGeminiClient } from '../services/apiClient';
import { useToast } from '../components/Toast';
import { validateProviderBaseUrl } from '../utils/provider-url-validation';
import { useLanguage } from './LanguageContext';

/** User-overridable settings for a single provider studio. */
export interface ProviderSettings {
  apiKey: string;
  baseUrl: string;
}

/** Gateway settings. The gateway is always the Gemini route; only its address
 *  and key are configurable. */
export interface CpaGatewaySettings {
  url: string;
  apiKey: string;
}

interface ApiContextType {
  imageEditModel: ImageEditModel;
  setImageEditModel: (model: ImageEditModel) => void;
  imageGenerateModel: ImageGenerateModel;
  setImageGenerateModel: (model: ImageGenerateModel) => void;
  textGenerateModel: TextGenerateModel;
  setTextGenerateModel: (model: TextGenerateModel) => void;
  cpaGatewaySettings: CpaGatewaySettings;
  setCpaGatewaySettings: (settings: CpaGatewaySettings) => void;
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
const CPA_GATEWAY_URL_KEY = 'cpa_gateway_url';
const CPA_GATEWAY_API_KEY_KEY = 'cpa_gateway_api_key';
const DEFAULT_CPA_GATEWAY_URL = 'https://cliproxy.monet.uno';

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

/** Gateway key from the build environment, used when nothing is stored. */
const readCpaGatewayEnvApiKey = (): string => (process.env.CLIPROXY_API_KEY || '').trim();

const LEGACY_GATEWAY_URL_KEY = 'vertex_proxy_url';
const LEGACY_GATEWAY_API_KEY_KEY = 'vertex_proxy_api_key';

/** Reads a gateway setting, migrating the pre-CPA-rename storage key on first use. */
const readGatewayValue = (key: string, legacyKey: string): string => {
  const current = safeStorage.getItem(key)?.trim() || '';
  if (current) return current;

  const legacy = safeStorage.getItem(legacyKey)?.trim() || '';
  if (legacy) {
    safeStorage.setItem(key, legacy);
    safeStorage.removeItem(legacyKey);
  }
  return legacy;
};

const resolveStoredCpaGatewaySettings = (): { invalidRestore: boolean; settings: CpaGatewaySettings } => {
  const storedUrl = readGatewayValue(CPA_GATEWAY_URL_KEY, LEGACY_GATEWAY_URL_KEY);
  const storedApiKey = readGatewayValue(CPA_GATEWAY_API_KEY_KEY, LEGACY_GATEWAY_API_KEY_KEY);
  const validation = validateProviderBaseUrl(storedUrl || DEFAULT_CPA_GATEWAY_URL);

  return {
    // A stored URL that no longer validates falls back to the default gateway.
    invalidRestore: storedUrl.length > 0 && validation.status === 'invalid',
    settings: {
      url: validation.status === 'invalid' ? DEFAULT_CPA_GATEWAY_URL : validation.url,
      apiKey: storedApiKey || readCpaGatewayEnvApiKey(),
    },
  };
};

export const ApiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const { t } = useLanguage();
  const restoredCpaGatewayRef = useRef(resolveStoredCpaGatewaySettings());
  const [cpaGatewaySettings, setCpaGatewaySettingsState] = useState<CpaGatewaySettings>(
    restoredCpaGatewayRef.current.settings,
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
    if (!restoredCpaGatewayRef.current.invalidRestore) {
      return;
    }

    safeStorage.setItem(CPA_GATEWAY_URL_KEY, restoredCpaGatewayRef.current.settings.url);

    restoredCpaGatewayRef.current.invalidRestore = false;
    showToast(t('settingsModal.notifications.cpaGatewayRestoreInvalid'));
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

  // The gateway is the only Gemini route, so it is always configured; a missing
  // key surfaces as an explicit client error instead of a silent fallback.
  useEffect(() => {
    const validation = validateProviderBaseUrl(cpaGatewaySettings.url);

    configureGeminiClient({
      apiKey: cpaGatewaySettings.apiKey.trim(),
      baseUrl: validation.status === 'invalid' ? DEFAULT_CPA_GATEWAY_URL : validation.url,
    });
  }, [cpaGatewaySettings]);

  const setCpaGatewaySettings = useCallback((settings: CpaGatewaySettings) => {
    setCpaGatewaySettingsState(settings);
    safeStorage.setItem(CPA_GATEWAY_URL_KEY, settings.url);
    safeStorage.setItem(CPA_GATEWAY_API_KEY_KEY, settings.apiKey);
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
      imageEditModel,
      setImageEditModel,
      imageGenerateModel,
      setImageGenerateModel,
      textGenerateModel,
      setTextGenerateModel,
      cpaGatewaySettings,
      setCpaGatewaySettings,
      providerSettings,
      setProviderSettings,
      resetProviderSettings,
  }), [imageEditModel, setImageEditModel, imageGenerateModel, setImageGenerateModel, textGenerateModel, setTextGenerateModel, cpaGatewaySettings, setCpaGatewaySettings, providerSettings, setProviderSettings, resetProviderSettings]);

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
