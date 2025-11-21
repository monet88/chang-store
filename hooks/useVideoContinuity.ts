

// hooks/useVideoContinuity.ts
import { useState, useEffect } from 'react';
import { ImageFile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { generateVideoContinuitySequence, enhanceSceneDescription, generateVideoPromptVariations } from '../services/gemini/video';
import type { Scene, VideoStyle } from '../services/gemini/video';
import { getErrorMessage } from '../utils/imageUtils';

export const useVideoContinuity = () => {
    const [basePrompt, setBasePrompt] = useState('');
    const [sceneCount, setSceneCount] = useState(4);
    // ... other states
    // FIX: Define imageMode state, which was missing.
    const [imageMode, setImageMode] = useState<'single' | 'multi' | 'brainstorm'>('multi');

    const { t } = useLanguage();

    useEffect(() => {
        // ... logic from component
    }, [sceneCount, imageMode]);

    const handleGenerate = async () => {
        // ... logic
    };
    
    // ... other handlers

    return {
        basePrompt, setBasePrompt,
        // ... other returned values
        handleGenerate,
    };
};
