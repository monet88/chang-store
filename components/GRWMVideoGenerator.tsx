

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Feature, ImageFile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useApi } from '../contexts/ApiProviderContext';
import { generateVideo } from '../services/imageEditingService';
// FIX: Corrected import path for gemini services
import { generateGRWMVideoSequencePrompts } from '../services/gemini/video';
import { getErrorMessage, cropAndCompressImage } from '../utils/imageUtils';
import Spinner, { ErrorDisplay } from './Spinner';
import { getActiveApiKey } from '../services/apiClient';
import { UploadIcon, FilmIcon, MagicWandIcon, CloseIcon } from './Icons';

// --- Type Definitions ---
interface ImageItem {
  id: string;
  file: ImageFile;
}
interface VideoResult {
  imageId: string;
  videoUrl: string | null;
  playableUrl: string | null;
  prompt: string;
  error: string | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  loadingMessage: string;
}

// --- Main Component ---
export const GRWMVideoGenerator: React.FC = () => {
    const { t } = useLanguage();
    const { addImage } = useImageGallery();
    const { getModelsForFeature, falApiKey, nanobananaApiKey, aivideoautoAccessToken, aivideoautoVideoModels } = useApi();
    const { videoGenerateModel } = getModelsForFeature(Feature.GRWMVideo);

    const [images, setImages] = useState<ImageItem[]>([]);
    const [videoResults, setVideoResults] = useState<Record<string, VideoResult>>({});
    const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [prompts, setPrompts] = useState<Record<string, string>>({});
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    
    const processFiles = useCallback(async (files: FileList) => {
        setError(null);
        const newImageItems: ImageItem[] = [];
        for (const file of Array.from(files)) {
            if (file.type.startsWith('image/')) {
                try {
                    const croppedAndCompressed = await cropAndCompressImage(file, 9 / 16);
                    const id = `${Date.now()}-${Math.random()}`;
                    newImageItems.push({ id, file: croppedAndCompressed });
                    addImage(croppedAndCompressed);
                } catch (err) {
                    console.error('Failed to process file:', file.name, err);
                }
            }
        }
        setImages(prev => [...prev, ...newImageItems]);
    }, [addImage]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(e.target.files);
        }
    };

    const handleDragEnter = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);
    
    const handleDragOver = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragLeave = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer?.files) {
            processFiles(e.dataTransfer.files);
        }
    }, [processFiles]);
    
    useEffect(() => {
        const dropZone = dropZoneRef.current;
        if (dropZone) {
            dropZone.addEventListener('dragenter', handleDragEnter);
            dropZone.addEventListener('dragover', handleDragOver);
            dropZone.addEventListener('dragleave', handleDragLeave);
            dropZone.addEventListener('drop', handleDrop);

            return () => {
                dropZone.removeEventListener('dragenter', handleDragEnter);
                dropZone.removeEventListener('dragover', handleDragOver);
                dropZone.removeEventListener('dragleave', handleDragLeave);
                dropZone.removeEventListener('drop', handleDrop);
            }
        }
    }, [handleDragEnter, handleDragOver, handleDragLeave, handleDrop]);

    const handleGenerateAllPrompts = async () => {
        if (images.length === 0) return;

        setIsGeneratingPrompts(true);
        setError(null);
        setPrompts({});
        try {
            const imageFiles = images.map(item => item.file);
            const generatedPrompts = await generateGRWMVideoSequencePrompts(imageFiles);
            
            const newPrompts: Record<string, string> = {};
            images.forEach((imageItem, index) => {
                newPrompts[imageItem.id] = generatedPrompts[index] || '';
            });
            setPrompts(newPrompts);
        } catch (err) {
            setError(getErrorMessage(err, t));
        } finally {
            setIsGeneratingPrompts(false);
        }
    };
    
    const handleGenerateVideo = async (imageItem: ImageItem) => {
        const promptText = prompts[imageItem.id];
        if (!promptText) {
            setError('Prompt is missing for this image.'); // Should not happen in normal flow
            return;
        }

        setVideoResults(prev => ({
            ...prev,
            [imageItem.id]: { 
                imageId: imageItem.id, 
                videoUrl: null, 
                playableUrl: null, 
                prompt: promptText, 
                error: null,
                status: 'loading',
                loadingMessage: 'Starting video generation...'
            }
        }));
        setError(null);

        try {
            const updateStatus = (message: string) => {
                setVideoResults(prev => ({
                    ...prev,
                    [imageItem.id]: { ...prev[imageItem.id], loadingMessage: message }
                }));
            };

            const downloadLink = await generateVideo(
                promptText,
                videoGenerateModel,
                { falApiKey, nanobananaApiKey, aivideoautoAccessToken, onStatusUpdate: updateStatus, aivideoautoVideoModels },
                imageItem.file
            );

            let finalUrl = downloadLink;
            if (downloadLink.includes('generativelanguage.googleapis.com')) {
                const apiKey = getActiveApiKey();
                if (apiKey) {
                    finalUrl = `${downloadLink}&key=${apiKey}`;
                }
            }

            updateStatus('Fetching video data...');
            const response = await fetch(finalUrl);
            if (!response.ok) throw new Error(`Failed to fetch video: ${response.statusText}`);
            const blob = await response.blob();
            const objectURL = URL.createObjectURL(blob);
            
             setVideoResults(prev => ({
                ...prev,
                [imageItem.id]: { 
                    ...prev[imageItem.id],
                    videoUrl: downloadLink,
                    playableUrl: objectURL,
                    status: 'success',
                    loadingMessage: ''
                }
            }));
        } catch (err) {
            const errorMessage = getErrorMessage(err, t);
             setVideoResults(prev => ({
                ...prev,
                [imageItem.id]: { ...prev[imageItem.id], error: errorMessage, status: 'error', loadingMessage: '' }
            }));
        }
    };

    const handleDeleteImage = (id: string) => {
        setImages(prev => prev.filter(item => item.id !== id));
        setPrompts(prev => {
            const newPrompts = { ...prev };
            delete newPrompts[id];
            return newPrompts;
        });
        setVideoResults(prev => {
            const newResults = { ...prev };
            delete newResults[id];
            return newResults;
        });
    };

    const sortedImages = images.map(img => {
        const result = videoResults[img.id];
        let order = 0; // Not started
        if (result?.status === 'loading') order = 1;
        if (result?.status === 'success') order = 2;
        if (result?.status === 'error') order = 3;
        return { ...img, order };
    }).sort((a, b) => a.order - b.order);

    return (
        <div className="flex flex-col gap-8">
            <div className="text-center">
                <h2 className="text-2xl font-bold mb-1">{t('grwmVideo.title')}</h2>
                <p className="text-zinc-400 max-w-2xl mx-auto">{t('grwmVideo.description')}</p>
            </div>
            
            <div 
                ref={dropZoneRef}
                className={`w-full p-6 bg-zinc-900/50 rounded-lg border-2 border-dashed transition-colors text-center cursor-pointer ${
                    isDragging
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-zinc-700 hover:border-amber-500'
                }`}
                onClick={() => fileInputRef.current?.click()}
            >
                <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
                <UploadIcon className="w-12 h-12 mx-auto text-zinc-500" />
                <p className="mt-2 text-zinc-400">{t('grwmVideo.uploadPlaceholder')}</p>
            </div>

            {images.length > 0 && (
                 <div className="text-center">
                     <button
                         onClick={handleGenerateAllPrompts}
                         disabled={isGeneratingPrompts}
                         className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-8 rounded-full hover:opacity-90 disabled:from-zinc-600 disabled:to-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105 flex items-center justify-center gap-2 mx-auto"
                     >
                         {isGeneratingPrompts ? <Spinner /> : <><MagicWandIcon className="w-5 h-5" /><span>{t('grwmVideo.generatePromptsButton')}</span></>}
                     </button>
                 </div>
            )}
            {isGeneratingPrompts && <p className="text-center text-zinc-400">{t('grwmVideo.generatingPrompts')}</p>}
            {error && <ErrorDisplay title="Error" message={error} onClear={() => setError(null)} />}

            {images.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedImages.map((imageItem) => {
                        const result = videoResults[imageItem.id];
                        const promptText = prompts[imageItem.id];

                        return (
                             <div key={imageItem.id} className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800 flex flex-col gap-4 animate-fade-in">
                                 <div className="relative aspect-square w-full rounded-md overflow-hidden">
                                    <img src={`data:${imageItem.file.mimeType};base64,${imageItem.file.base64}`} alt={`GRWM step`} className="w-full h-full object-cover"/>
                                    <button onClick={() => handleDeleteImage(imageItem.id)} className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white hover:bg-red-500/80 transition-all">
                                        <CloseIcon className="w-4 h-4" />
                                    </button>
                                 </div>

                                {promptText !== undefined && (
                                    <div className="flex flex-col gap-2">
                                        <textarea
                                            value={promptText}
                                            onChange={(e) => setPrompts(prev => ({...prev, [imageItem.id]: e.target.value}))}
                                            placeholder={t('grwmVideo.promptPlaceholderTitle')}
                                            rows={3}
                                            className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-2 text-sm text-zinc-300"
                                        />
                                        <button 
                                            onClick={() => handleGenerateVideo(imageItem)} 
                                            disabled={!promptText || result?.status === 'loading'}
                                            className="w-full bg-cyan-600 text-white font-semibold py-2 rounded-lg text-sm disabled:bg-zinc-600 flex items-center justify-center gap-2"
                                        >
                                            <FilmIcon className="w-4 h-4" />
                                            <span>{t('grwmVideo.generateSingleVideoButton')}</span>
                                        </button>
                                    </div>
                                )}

                                {result && (
                                    <div className="mt-2">
                                        {result.status === 'loading' && (
                                            <div className="text-center p-2 bg-zinc-800 rounded-lg">
                                                <Spinner />
                                                <p className="text-xs text-zinc-400 mt-2">{result.loadingMessage}</p>
                                            </div>
                                        )}
                                        {result.status === 'error' && result.error && (
                                            <ErrorDisplay title="Video Failed" message={result.error} />
                                        )}
                                        {result.status === 'success' && result.playableUrl && (
                                            <div className="aspect-square rounded-lg overflow-hidden">
                                                 <video src={result.playableUrl} controls autoPlay loop muted className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
};
