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
  const LEGACY_GOOGLE_API_KEY = 'google_api_key';

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

  const [imageEditModel, setImageEditModelState] = useState<ImageEditModel>(() => {
      const saved = safeStorage.getItem(IMAGE_EDIT_MODEL_KEY);
      return (saved && saved.startsWith('gemini')) ? saved : DEFAULT_IMAGE_EDIT_MODEL;
  });
  const [imageGenerateModel, setImageGenerateModelState] = useState<ImageGenerateModel>(() => {
      const saved = safeStorage.getItem(IMAGE_GENERATE_MODEL_KEY);
      return (saved && (saved.startsWith('imagen') || saved.startsWith('gemini'))) ? saved : 'imagen-4.0-generate-001';
  });
  const [textGenerateModel, setTextGenerateModelState] = useState<TextGenerateModel>(() => {
      const saved = safeStorage.getItem(TEXT_GENERATE_MODEL_KEY);
      return (saved && saved.startsWith('gemini')) ? saved : 'gemini-3-flash-preview';
  });

  // One-time cleanup for old persisted API keys from previous releases.
  useEffect(() => {
    safeStorage.removeItem(LEGACY_GOOGLE_API_KEY);
  }, []);

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
