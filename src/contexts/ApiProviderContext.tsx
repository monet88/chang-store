import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { ImageEditModel, ImageGenerateModel, TextGenerateModel } from '../types';
import { getDefaultModelForSelectionType, isKnownModelForSelectionType, ModelSelectionType } from '../config/modelRegistry';
import { ProviderId, PROVIDER_IDS, getProviderDefaultBaseUrl, getProviderEnvApiKey } from '../config/providerRegistry';
import { setGeminiApiKey } from '../services/apiClient';

/** User-overridable settings for a single provider studio. */
export interface ProviderSettings {
  apiKey: string;
  baseUrl: string;
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

const providerApiKeyStorageKey = (provider: ProviderId): string => `provider:${provider}:apiKey`;
const providerBaseUrlStorageKey = (provider: ProviderId): string => `provider:${provider}:baseUrl`;

const resolveStoredModel = (selectionType: ModelSelectionType, storedValue: string | null): string => {
  if (storedValue && isKnownModelForSelectionType(selectionType, storedValue)) {
    return storedValue;
  }

  return getDefaultModelForSelectionType(selectionType);
};

export const ApiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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
      } catch (e) {
        console.warn('[safeStorage] Failed to save:', key, e);
      }
    },
    removeItem: (key: string) => {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn('[safeStorage] Failed to remove:', key, e);
      }
    },
  };

  const [googleApiKey, setGoogleApiKeyState] = useState<string | null>(null);

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

  const setProviderSettings = (provider: ProviderId, settings: Partial<ProviderSettings>) => {
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
  };

  const resetProviderSettings = (provider: ProviderId) => {
    safeStorage.removeItem(providerApiKeyStorageKey(provider));
    safeStorage.removeItem(providerBaseUrlStorageKey(provider));
    setProviderSettingsState((current) => ({
      ...current,
      [provider]: {
        apiKey: getProviderEnvApiKey(provider),
        baseUrl: getProviderDefaultBaseUrl(provider),
      },
    }));
  };

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

  // One-time cleanup for old persisted API keys from previous releases.
  useEffect(() => {
    safeStorage.removeItem(LEGACY_GOOGLE_API_KEY);
  }, []);

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

  const setGoogleApiKey = (key: string | null) => {
    setGoogleApiKeyState(key);
    setGeminiApiKey(key);
  };

  const setImageEditModel = (model: ImageEditModel) => {
    setImageEditModelState(model);
    safeStorage.setItem(IMAGE_EDIT_MODEL_KEY, model);
  };
  const setImageGenerateModel = (model: ImageGenerateModel) => {
    setImageGenerateModelState(model);
    safeStorage.setItem(IMAGE_GENERATE_MODEL_KEY, model);
  };
  const setTextGenerateModel = (model: TextGenerateModel) => {
    setTextGenerateModelState(model);
    safeStorage.setItem(TEXT_GENERATE_MODEL_KEY, model);
  };

  return (
    <ApiContext.Provider value={{
        googleApiKey, setGoogleApiKey,
        imageEditModel, setImageEditModel,
        imageGenerateModel, setImageGenerateModel,
        textGenerateModel, setTextGenerateModel,
        providerSettings, setProviderSettings, resetProviderSettings,
    }}>
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
