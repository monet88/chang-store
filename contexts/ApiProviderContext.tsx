import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { ImageEditModel, ImageGenerateModel, TextGenerateModel } from '../types';
import { setGeminiApiKey } from '../services/apiClient';

interface ApiContextType {
  googleApiKey: string | null;
  setGoogleApiKey: (key: string | null) => void;
  localApiBaseUrl: string | null;
  setLocalApiBaseUrl: (url: string | null) => void;
  localApiKey: string | null;
  setLocalApiKey: (key: string | null) => void;
  imageEditModel: ImageEditModel;
  setImageEditModel: (model: ImageEditModel) => void;
  imageGenerateModel: ImageGenerateModel;
  setImageGenerateModel: (model: ImageGenerateModel) => void;
  textGenerateModel: TextGenerateModel;
  setTextGenerateModel: (model: TextGenerateModel) => void;
  getModelsForFeature: () => {
    imageEditModel: ImageEditModel;
    imageGenerateModel: ImageGenerateModel;
    textGenerateModel: TextGenerateModel;
  };
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export const ApiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const LOCAL_BASE_URL_KEY = 'local_provider_base_url';
  const LOCAL_API_KEY = 'local_provider_api_key';
  const IMAGE_EDIT_MODEL_KEY = 'image_edit_model';
  const IMAGE_GENERATE_MODEL_KEY = 'image_generate_model';
  const TEXT_GENERATE_MODEL_KEY = 'text_generate_model';

  const [googleApiKey, setGoogleApiKeyState] = useState<string | null>(() => {
      return typeof localStorage !== 'undefined' ? localStorage.getItem('google_api_key') : null;
  });
  const [localApiBaseUrl, setLocalApiBaseUrlState] = useState<string | null>(() => {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_BASE_URL_KEY) : null;
  });
  const [localApiKey, setLocalApiKeyState] = useState<string | null>(() => {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_API_KEY) : null;
  });

  const [imageEditModel, setImageEditModelState] = useState<ImageEditModel>(() => {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(IMAGE_EDIT_MODEL_KEY) : null;
      return saved || 'gemini-3-pro-image-preview';
  });
  const [imageGenerateModel, setImageGenerateModelState] = useState<ImageGenerateModel>(() => {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(IMAGE_GENERATE_MODEL_KEY) : null;
      return saved || 'imagen-4.0-generate-001';
  });
  const [textGenerateModel, setTextGenerateModelState] = useState<TextGenerateModel>(() => {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(TEXT_GENERATE_MODEL_KEY) : null;
      return saved || 'gemini-3-flash-preview';
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
        localStorage.setItem('google_api_key', key);
    } else {
        localStorage.removeItem('google_api_key');
    }
  };

  const setLocalApiBaseUrl = (url: string | null) => {
    const normalized = url?.trim() ? url.trim() : null;
    setLocalApiBaseUrlState(normalized);
    if (normalized) {
        localStorage.setItem(LOCAL_BASE_URL_KEY, normalized);
    } else {
        localStorage.removeItem(LOCAL_BASE_URL_KEY);
    }
  };

  const setLocalApiKey = (key: string | null) => {
    const normalized = key?.trim() ? key.trim() : null;
    setLocalApiKeyState(normalized);
    if (normalized) {
        localStorage.setItem(LOCAL_API_KEY, normalized);
    } else {
        localStorage.removeItem(LOCAL_API_KEY);
    }
  };

  const setImageEditModel = (model: ImageEditModel) => {
    setImageEditModelState(model);
    localStorage.setItem(IMAGE_EDIT_MODEL_KEY, model);
  };
  const setImageGenerateModel = (model: ImageGenerateModel) => {
    setImageGenerateModelState(model);
    localStorage.setItem(IMAGE_GENERATE_MODEL_KEY, model);
  };
  const setTextGenerateModel = (model: TextGenerateModel) => {
    setTextGenerateModelState(model);
    localStorage.setItem(TEXT_GENERATE_MODEL_KEY, model);
  };

  const getModelsForFeature = () => {
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
