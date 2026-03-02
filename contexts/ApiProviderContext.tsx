import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { Feature, ImageEditModel, ImageGenerateModel, TextGenerateModel } from '../types';
import { setGeminiApiKey } from '../services/apiClient';

interface ApiContextType {
  googleApiKey: string | null;
  setGoogleApiKey: (key: string | null) => void;
  localApiBaseUrl: string | null;
  setLocalApiBaseUrl: (url: string | null) => void;
  localApiKey: string | null;
  setLocalApiKey: (key: string | null) => void;
  antiApiBaseUrl: string | null;
  setAntiApiBaseUrl: (url: string | null) => void;
  antiApiKey: string | null;
  setAntiApiKey: (key: string | null) => void;
  imageEditModel: ImageEditModel;
  setImageEditModel: (model: ImageEditModel) => void;
  imageGenerateModel: ImageGenerateModel;
  setImageGenerateModel: (model: ImageGenerateModel) => void;
  textGenerateModel: TextGenerateModel;
  setTextGenerateModel: (model: TextGenerateModel) => void;
  getModelsForFeature: (feature?: Feature) => {
    imageEditModel: ImageEditModel;
    imageGenerateModel: ImageGenerateModel;
    textGenerateModel: TextGenerateModel;
  };
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export const ApiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const LOCAL_BASE_URL_KEY = 'local_provider_base_url';
  const LOCAL_API_KEY = 'local_provider_api_key';
  const ANTI_BASE_URL_KEY = 'anti_provider_base_url';
  const ANTI_API_KEY = 'anti_provider_api_key';
  const IMAGE_EDIT_MODEL_KEY = 'image_edit_model';
  const IMAGE_GENERATE_MODEL_KEY = 'image_generate_model';
  const TEXT_GENERATE_MODEL_KEY = 'text_generate_model';

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
      } catch {
        // Ignore storage errors (private mode, sandbox, quota).
      }
    },
    removeItem: (key: string) => {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore storage errors (private mode, sandbox, quota).
      }
    },
  };

  const [googleApiKey, setGoogleApiKeyState] = useState<string | null>(() => {
      return safeStorage.getItem('google_api_key');
  });
  const [localApiBaseUrl, setLocalApiBaseUrlState] = useState<string | null>(() => {
      return safeStorage.getItem(LOCAL_BASE_URL_KEY) || import.meta.env.VITE_LOCAL_PROVIDER_BASE_URL || null;
  });
  const [localApiKey, setLocalApiKeyState] = useState<string | null>(() => {
      return safeStorage.getItem(LOCAL_API_KEY) || import.meta.env.VITE_LOCAL_PROVIDER_API_KEY || null;
  });
  const [antiApiBaseUrl, setAntiApiBaseUrlState] = useState<string | null>(() => {
      return safeStorage.getItem(ANTI_BASE_URL_KEY);
  });
  const [antiApiKey, setAntiApiKeyState] = useState<string | null>(() => {
      return safeStorage.getItem(ANTI_API_KEY);
  });

  const [imageEditModel, setImageEditModelState] = useState<ImageEditModel>(() => {
      return safeStorage.getItem(IMAGE_EDIT_MODEL_KEY) || 'gemini-3.1-flash-image-preview';
  });
  const [imageGenerateModel, setImageGenerateModelState] = useState<ImageGenerateModel>(() => {
      return safeStorage.getItem(IMAGE_GENERATE_MODEL_KEY) || 'imagen-4.0-generate-001';
  });
  const [textGenerateModel, setTextGenerateModelState] = useState<TextGenerateModel>(() => {
      return safeStorage.getItem(TEXT_GENERATE_MODEL_KEY) || 'gemini-3-flash-preview';
  });

  // Initialize Gemini client with stored key on mount
  useEffect(() => {
      if (googleApiKey) {
          setGeminiApiKey(googleApiKey);
      }
  }, []);

  const setGoogleApiKey = (key: string | null) => {
    setGoogleApiKeyState(key);
    setGeminiApiKey(key);
    if (key) {
        safeStorage.setItem('google_api_key', key);
    } else {
        safeStorage.removeItem('google_api_key');
    }
  };

  const setLocalApiBaseUrl = (url: string | null) => {
    const normalized = url?.trim() ? url.trim() : null;
    setLocalApiBaseUrlState(normalized);
    if (normalized) {
        safeStorage.setItem(LOCAL_BASE_URL_KEY, normalized);
    } else {
        safeStorage.removeItem(LOCAL_BASE_URL_KEY);
    }
  };

  const setLocalApiKey = (key: string | null) => {
    const normalized = key?.trim() ? key.trim() : null;
    setLocalApiKeyState(normalized);
    if (normalized) {
        safeStorage.setItem(LOCAL_API_KEY, normalized);
    } else {
        safeStorage.removeItem(LOCAL_API_KEY);
    }
  };

  const setAntiApiBaseUrl = (url: string | null) => {
    const normalized = url?.trim() ? url.trim() : null;
    setAntiApiBaseUrlState(normalized);
    if (normalized) {
        safeStorage.setItem(ANTI_BASE_URL_KEY, normalized);
    } else {
        safeStorage.removeItem(ANTI_BASE_URL_KEY);
    }
  };

  const setAntiApiKey = (key: string | null) => {
    const normalized = key?.trim() ? key.trim() : null;
    setAntiApiKeyState(normalized);
    if (normalized) {
        safeStorage.setItem(ANTI_API_KEY, normalized);
    } else {
        safeStorage.removeItem(ANTI_API_KEY);
    }
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

  const getModelsForFeature = (_feature?: Feature) => {
    return {
      imageEditModel,
      imageGenerateModel,
      textGenerateModel,
    };
  };

  return (
    <ApiContext.Provider value={{
        googleApiKey, setGoogleApiKey,
        localApiBaseUrl, setLocalApiBaseUrl,
        localApiKey, setLocalApiKey,
        antiApiBaseUrl, setAntiApiBaseUrl,
        antiApiKey, setAntiApiKey,
        imageEditModel, setImageEditModel,
        imageGenerateModel, setImageGenerateModel,
        textGenerateModel, setTextGenerateModel,
        getModelsForFeature,
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
