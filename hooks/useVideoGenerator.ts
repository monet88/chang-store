

// hooks/useVideoGenerator.ts
import { useState, useRef, useEffect } from 'react';
import { Feature, ImageFile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useImageGallery } from '../contexts/ImageGalleryProvider';
import { useApi } from '../contexts/ApiProviderContext';
import { generateVideo } from '../services/imageEditingService';
// FIX: `analyzeScene` is in the `text` service, not `video`.
import { enforceVisualPreservation, generateVideoSceneSuggestions, enhanceSceneDescription } from '../services/gemini/video';
import { analyzeScene } from '../services/gemini/text';
import { getErrorMessage } from '../utils/imageUtils';
import { getActiveApiKey } from '../services/apiClient';

export const useVideoGenerator = () => {
    const [faceImage, setFaceImage] = useState<ImageFile | null>(null);
    // ... other states

    const { t } = useLanguage();
    const { addImage } = useImageGallery();
    const { getModelsForFeature, falApiKey, nanobananaApiKey, aivideoautoAccessToken, aivideoautoVideoModels } = useApi();

    const handleSuggestScenes = async () => {
        // ... logic
    };

    const handleGenerateVideo = async () => {
        // ... logic
    };

    // ... other handlers and effects

    return {
        faceImage, setFaceImage,
        // ... other returned values
        handleSuggestScenes,
        handleGenerateVideo,
    };
};
