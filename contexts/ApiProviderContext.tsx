import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { ImageEditModel, ImageGenerateModel, VideoGenerateModel, TextGenerateModel, AIVideoAutoModel, Feature } from '../types';
import { setGeminiApiKey } from '../services/apiClient';

interface ApiContextType {
  googleApiKey: string | null;
  setGoogleApiKey: (key: string | null) => void;
  localApiBaseUrl: string | null;
  setLocalApiBaseUrl: (url: string | null) => void;
  localApiKey: string | null;
  setLocalApiKey: (key: string | null) => void;
  aivideoautoAccessToken: string | null;
  setAivideoautoAccessToken: (key: string | null) => void;
  aivideoautoImageModels: AIVideoAutoModel[];
  setAivideoautoImageModels: (models: AIVideoAutoModel[]) => void;
  aivideoautoVideoModels: AIVideoAutoModel[];
  setAivideoautoVideoModels: (models: AIVideoAutoModel[]) => void;
  imageEditModel: ImageEditModel;
  setImageEditModel: (model: ImageEditModel) => void;
  imageGenerateModel: ImageGenerateModel;
  setImageGenerateModel: (model: ImageGenerateModel) => void;
  videoGenerateModel: VideoGenerateModel;
  setVideoGenerateModel: (model: VideoGenerateModel) => void;
  textGenerateModel: TextGenerateModel;
  setTextGenerateModel: (model: TextGenerateModel) => void;
  getModelsForFeature: (feature: Feature) => {
    imageEditModel: ImageEditModel;
    imageGenerateModel: ImageGenerateModel;
    videoGenerateModel: VideoGenerateModel;
    textGenerateModel: TextGenerateModel;
  };
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export const ApiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const LOCAL_BASE_URL_KEY = 'local_provider_base_url';
  const LOCAL_API_KEY = 'local_provider_api_key';
  const [googleApiKey, setGoogleApiKeyState] = useState<string | null>(() => {
      return typeof localStorage !== 'undefined' ? localStorage.getItem('google_api_key') : null;
  });
  const [localApiBaseUrl, setLocalApiBaseUrlState] = useState<string | null>(() => {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_BASE_URL_KEY) : null;
  });
  const [localApiKey, setLocalApiKeyState] = useState<string | null>(() => {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_API_KEY) : null;
  });
  const [aivideoautoAccessToken, setAivideoautoAccessTokenState] = useState<string | null>(null);

  const [aivideoautoImageModels, setAivideoautoImageModelsState] = useState<AIVideoAutoModel[]>([]);
  const [aivideoautoVideoModels, setAivideoautoVideoModelsState] = useState<AIVideoAutoModel[]>([]);

  const [imageEditModel, setImageEditModelState] = useState<ImageEditModel>('gemini-3-pro-image-preview');
  const [imageGenerateModel, setImageGenerateModelState] = useState<ImageGenerateModel>('imagen-4.0-generate-001');
  const [videoGenerateModel, setVideoGenerateModelState] = useState<VideoGenerateModel>('');
  const [textGenerateModel, setTextGenerateModelState] = useState<TextGenerateModel>('gemini-3-flash-preview');

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
    setLocalApiBaseUrlState(url);
    if (url) {
        localStorage.setItem(LOCAL_BASE_URL_KEY, url);
    } else {
        localStorage.removeItem(LOCAL_BASE_URL_KEY);
    }
  };

  const setLocalApiKey = (key: string | null) => {
    setLocalApiKeyState(key);
    if (key) {
        localStorage.setItem(LOCAL_API_KEY, key);
    } else {
        localStorage.removeItem(LOCAL_API_KEY);
    }
  };

  const setAivideoautoAccessToken = (key: string | null) => {
    setAivideoautoAccessTokenState(key);
  };

  const setAivideoautoImageModels = (models: AIVideoAutoModel[]) => {
    setAivideoautoImageModelsState(models);
  };

  const setAivideoautoVideoModels = (models: AIVideoAutoModel[]) => {
    setAivideoautoVideoModelsState(models);
  };

  const setImageEditModel = (model: ImageEditModel) => {
    setImageEditModelState(model);
  };
  const setImageGenerateModel = (model: ImageGenerateModel) => {
    setImageGenerateModelState(model);
  };
  const setVideoGenerateModel = (model: VideoGenerateModel) => {
    setVideoGenerateModelState(model);
  };
  const setTextGenerateModel = (model: TextGenerateModel) => {
    setTextGenerateModelState(model);
  };

  const getModelsForFeature = (feature: Feature) => {
    const isVideoFeature = [Feature.Video, Feature.GRWMVideo].includes(feature);

    let finalVideoModel = videoGenerateModel;

    if (isVideoFeature) {
        // RULE: All video generation MUST use AIVideoAuto.
        // If the current model (from settings or global default) is not an AIVideoAuto model,
        // we override it with the first available AIVideoAuto model.
        if (!finalVideoModel.startsWith('aivideoauto--')) {
            if (aivideoautoVideoModels.length > 0) {
                finalVideoModel = `aivideoauto--${aivideoautoVideoModels[0].id_base}`;
            }
            // If no AIVideoAuto models are loaded, we let the invalid model pass through.
            // The service layer will then throw a user-friendly error about configuration.
        }
    }

    return {
      imageEditModel: imageEditModel,
      imageGenerateModel: imageGenerateModel,
      videoGenerateModel: finalVideoModel,
      textGenerateModel: textGenerateModel,
    };
  };

  return (
    <ApiContext.Provider value={{
        googleApiKey, setGoogleApiKey,
        localApiBaseUrl, setLocalApiBaseUrl,
        localApiKey, setLocalApiKey,
        aivideoautoAccessToken, setAivideoautoAccessToken,
        aivideoautoImageModels, setAivideoautoImageModels,
        aivideoautoVideoModels, setAivideoautoVideoModels,
        imageEditModel, setImageEditModel,
        imageGenerateModel, setImageGenerateModel,
        videoGenerateModel, setVideoGenerateModel,
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
