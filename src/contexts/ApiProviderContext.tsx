import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { ImageEditModel, ImageGenerateModel, TextGenerateModel } from '../types';
import { setGeminiApiKey } from '../services/apiClient';

interface ApiContextType {
  googleApiKey: string | null;
  setGoogleApiKey: (key: string | null) => void;
  imageEditModel: ImageEditModel;
  setImageEditModel: (model: ImageEditModel) => void;
  imageGenerateModel: ImageGenerateModel;
  setImageGenerateModel: (model: ImageGenerateModel) => void;
  textGenerateModel: TextGenerateModel;
  setTextGenerateModel: (model: TextGenerateModel) => void;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);
const DEFAULT_IMAGE_EDIT_MODEL: ImageEditModel = 'gemini-3.1-flash-image-preview';

export const ApiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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

  const [googleApiKey, setGoogleApiKeyState] = useState<string | null>(() => {
      return safeStorage.getItem('google_api_key');
  });

  const [imageEditModel, setImageEditModelState] = useState<ImageEditModel>(() => {
      return safeStorage.getItem(IMAGE_EDIT_MODEL_KEY) || DEFAULT_IMAGE_EDIT_MODEL;
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
