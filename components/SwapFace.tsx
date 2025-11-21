
import React, { useState } from 'react';
import { Feature, ImageFile, AspectRatio } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useApi } from '../contexts/ApiProviderContext';
import { recreateImageWithFace } from '../services/imageEditingService';
import { generateStylePromptFromImage } from '../services/gemini/text';
import { getErrorMessage } from '../utils/imageUtils';
import ImageUploader from './ImageUploader';
import Spinner, { ErrorDisplay } from './Spinner';
import HoverableImage from './HoverableImage';
import { GalleryIcon, MagicWandIcon } from './Icons';
import AspectRatioSelector from './AspectRatioSelector';

const SwapFace: React.FC = () => {
    const { t } = useLanguage();
    const { addImage } = useImageGallery();
    const { getModelsForFeature, falApiKey, nanobananaApiKey } = useApi();
    const { imageEditModel } = getModelsForFeature(Feature.SwapFace);

    const [styleImage, setStyleImage] = useState<ImageFile | null>(null);
    const [faceImage, setFaceImage] = useState<ImageFile | null>(null);
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [generatedImage, setGeneratedImage] = useState<ImageFile | null>(null);
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Default');
    
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAnalyzeStyle = async () => {
        if (!styleImage) {
            setError(t('swapFace.error.styleMissing'));
            return;
        }
        setIsAnalyzing(true);
        setError(null);
        try {
            const prompt = await generateStylePromptFromImage(styleImage);
            setGeneratedPrompt(prompt);
        } catch (err) {
            setError(getErrorMessage(err, t));
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleGenerate = async () => {
        if (!generatedPrompt.trim()) {
            setError(t('swapFace.error.promptMissing'));
            return;
        }
        if (!faceImage) {
            setError(t('swapFace.error.faceMissing'));
            return;
        }
        if (!styleImage) {
            setError(t('swapFace.error.styleMissing'));
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedImage(null);

        try {
            const result = await recreateImageWithFace(
                generatedPrompt, 
                faceImage, 
                styleImage,
                imageEditModel, {
                falApiKey,
                nanobananaApiKey,
                onStatusUpdate: () => {},
            },
            aspectRatio
            );
            setGeneratedImage(result);
            addImage(result);
        } catch (err) {
            setError(getErrorMessage(err, t));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Left Column: Inputs */}
            <div className="flex flex-col gap-6">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-1">{t('tabs.swapFace')}</h2>
                    <p className="text-zinc-400 max-w-xl mx-auto">{t('swapFace.description')}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ImageUploader 
                        image={styleImage} 
                        onImageUpload={(file) => { setStyleImage(file); if (file) addImage(file); }} 
                        title={t('swapFace.styleImageTitle')} 
                        id="recreation-style-upload"
                    />
                    <ImageUploader 
                        image={faceImage} 
                        onImageUpload={(file) => { setFaceImage(file); if (file) addImage(file); }} 
                        title={t('swapFace.faceImageTitle')} 
                        id="recreation-face-upload"
                    />
                </div>

                <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-4">
                    <button 
                        onClick={handleAnalyzeStyle}
                        disabled={!styleImage || isAnalyzing}
                        className="w-full flex items-center justify-center gap-2 bg-zinc-700/80 text-zinc-200 font-semibold py-2.5 px-4 rounded-lg hover:bg-zinc-700 transition-colors duration-200 disabled:opacity-50"
                    >
                        {isAnalyzing ? <Spinner /> : <><MagicWandIcon className="w-5 h-5" /> <span>{t('swapFace.analyzeButton')}</span></>}
                    </button>
                    {isAnalyzing && <p className="text-center text-zinc-400 text-sm">{t('swapFace.analyzingStatus')}</p>}

                    <div>
                        <label htmlFor="generated-prompt" className="block text-sm font-medium text-zinc-300 mb-2">{t('swapFace.promptLabel')}</label>
                        <textarea
                            id="generated-prompt"
                            value={generatedPrompt}
                            onChange={(e) => setGeneratedPrompt(e.target.value)}
                            placeholder={t('swapFace.promptPlaceholder')}
                            rows={6}
                            className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:ring-2 focus:ring-amber-500"
                        />
                    </div>
                    <AspectRatioSelector aspectRatio={aspectRatio} setAspectRatio={setAspectRatio} />
                </div>
                
                <div className="text-center">
                    <button 
                        onClick={handleGenerate} 
                        disabled={isLoading || !generatedPrompt.trim() || !faceImage} 
                        className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-8 rounded-full hover:opacity-90 disabled:from-zinc-600 disabled:to-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105"
                    >
                        {isLoading ? <Spinner /> : t('swapFace.generateButton')}
                    </button>
                </div>
            </div>

            {/* Right Column: Output */}
            <div className="sticky top-8">
                <div className="relative w-full bg-zinc-900/50 rounded-2xl border border-zinc-800 flex items-center justify-center p-4 min-h-[50vh] lg:min-h-0 lg:aspect-[4/5]">
                    {isLoading ? (
                        <div className="text-center">
                            <Spinner />
                            <p className="mt-4 text-zinc-400">{t('swapFace.generatingStatus')}</p>
                        </div>
                    ) : error ? (
                        <div className="p-4 w-full">
                            <ErrorDisplay title={t('common.generationFailed')} message={error} onClear={() => setError(null)} />
                        </div>
                    ) : generatedImage ? (
                        <HoverableImage 
                            image={generatedImage} 
                            altText="Generated recreation image" 
                            onRegenerate={handleGenerate}
                            isGenerating={isLoading}
                        />
                    ) : (
                        <div className="text-center text-zinc-500 pointer-events-none p-4">
                            <GalleryIcon className="mx-auto h-16 w-16" />
                            <h3 className="mt-4 text-lg font-semibold text-zinc-400">{t('common.outputPanelTitle')}</h3>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SwapFace;
