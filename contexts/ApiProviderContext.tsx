import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { ImageEditModel, ImageGenerateModel, VideoGenerateModel, AIVideoAutoModel, Feature } from '../types';
import { setGeminiApiKey } from '../services/apiClient';

interface ApiContextType {
  falApiKey: string | null;
  setFalApiKey: (key: string | null) => void;
  nanobananaApiKey: string | null;
  setNanobananaApiKey: (key: string | null) => void;
  googleApiKey: string | null;
  setGoogleApiKey: (key: string | null) => void;
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
  imgbbApiKey: string | null;
  setImgbbApiKey: (key: string | null) => void;
  getModelsForFeature: (feature: Feature) => {
    imageEditModel: ImageEditModel;
    imageGenerateModel: ImageGenerateModel;
    videoGenerateModel: VideoGenerateModel;
  };
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export const ApiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [falApiKey, setFalApiKeyState] = useState<string | null>(null);
  const [nanobananaApiKey, setNanobananaApiKeyState] = useState<string | null>(null);
  const [googleApiKey, setGoogleApiKeyState] = useState<string | null>(() => {
      return typeof localStorage !== 'undefined' ? localStorage.getItem('google_api_key') : null;
  });
  const [aivideoautoAccessToken, setAivideoautoAccessTokenState] = useState<string | null>(null);
  
  const [aivideoautoImageModels, setAivideoautoImageModelsState] = useState<AIVideoAutoModel[]>([]);
  const [aivideoautoVideoModels, setAivideoautoVideoModelsState] = useState<AIVideoAutoModel[]>([]);

  const [imgbbApiKey, setImgbbApiKeyState] = useState<string | null>(null);

  const [imageEditModel, setImageEditModelState] = useState<ImageEditModel>('gemini-2.5-flash-image');
  const [imageGenerateModel, setImageGenerateModelState] = useState<ImageGenerateModel>('imagen-4.0-generate-001');
  const [videoGenerateModel, setVideoGenerateModelState] = useState<VideoGenerateModel>('');

  // Initialize Gemini client with stored key on mount
  useEffect(() => {
      if (googleApiKey) {
          setGeminiApiKey(googleApiKey);
      }
  }, []);

  const setFalApiKey = (key: string | null) => {
    setFalApiKeyState(key);
  };

  const setNanobananaApiKey = (key: string | null) => {
    setNanobananaApiKeyState(key);
  };

  const setGoogleApiKey = (key: string | null) => {
    setGoogleApiKeyState(key);
    setGeminiApiKey(key);
    if (key) {
        localStorage.setItem('google_api_key', key);
    } else {
        localStorage.removeItem('google_api_key');
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
  
  const setImgbbApiKey = (key: string | null) => {
    setImgbbApiKeyState(key);
  };

  const getModelsForFeature = (feature: Feature) => {
    const isVideoFeature = [Feature.Video, Feature.GRWMVideo, Feature.VideoContinuity].includes(feature);

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
    };
  };

  return (
    <ApiContext.Provider value={{ 
        falApiKey, setFalApiKey, 
        nanobananaApiKey, setNanobananaApiKey,
        googleApiKey, setGoogleApiKey,
        aivideoautoAccessToken, setAivideoautoAccessToken,
        aivideoautoImageModels, setAivideoautoImageModels,
        aivideoautoVideoModels, setAivideoautoVideoModels,
        imageEditModel, setImageEditModel,
        imageGenerateModel, setImageGenerateModel,
        videoGenerateModel, setVideoGenerateModel,
        imgbbApiKey, setImgbbApiKey,
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