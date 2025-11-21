




import React, { useState, useEffect, useRef } from 'react';
import { useApi } from '../../contexts/ApiProviderContext';
import { getLocalStorageUsage, backupData, restoreData, clearAppData } from '../../utils/storage';
import { useImageGallery } from '../../contexts/ImageGalleryContext';
import { listModels } from '../../services/aivideoautoService';
// FIX: Corrected import path for Spinner component.
import Spinner from './Spinner';
// FIX: Add missing CheckCircleIcon import
import { CloseIcon, CheckCircleIcon } from '../Icons';
import { ImageEditModel, ImageGenerateModel, VideoGenerateModel } from '../../types';

const ServiceModelSelector: React.FC<{
    label: string;
    services: {id: string, name: string}[];
    modelsByService: Record<string, {id: string, name: string}[]>;
    selectedModel: string;
    onModelChange: (modelId: string) => void;
}> = ({ label, services, modelsByService, selectedModel, onModelChange }) => {

    const parseModelId = (modelId: string): { service: string, model: string } => {
        if (modelId.startsWith('aivideoauto--')) return { service: 'aivideoauto', model: modelId };
        if (modelId.startsWith('fal-ai/')) return { service: 'fal-ai', model: modelId };
        if (modelId.startsWith('nanobanana/')) return { service: 'nanobanana', model: modelId };
        return { service: 'google', model: modelId };
    };
    
    const { service: currentService } = parseModelId(selectedModel);
    const availableModels = modelsByService[currentService] || [];

    const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newService = e.target.value;
        const firstModelForService = (modelsByService[newService] || [])[0];
        if (firstModelForService) {
            onModelChange(firstModelForService.id);
        }
    };
    
    const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newModelId = e.target.value;
        console.log('[SettingsModal] Model selection changed:', {
            label,
            oldModel: selectedModel,
            newModel: newModelId,
            availableModels: availableModels.map(m => m.id)
        });
        onModelChange(newModelId);
    };
    
    return (
        <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Service</label>
                    {services.length > 1 ? (
                        <select value={currentService} onChange={handleServiceChange} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-slate-200 text-sm h-[38px]">
                            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    ) : (
                        <div className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-slate-400 text-sm h-[38px] flex items-center">
                            {services[0]?.name || 'N/A'}
                        </div>
                    )}
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Model</label>
                    <select value={selectedModel} onChange={handleModelChange} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-slate-200 text-sm h-[38px]" disabled={availableModels.length === 0}>
                        {availableModels.length > 0 ? (
                            availableModels.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)
                        ) : (
                            <option>No models available</option>
                        )}
                    </select>
                </div>
            </div>
        </div>
    );
};


export const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const {
        falApiKey, setFalApiKey,
        nanobananaApiKey, setNanobananaApiKey,
        aivideoautoAccessToken, setAivideoautoAccessToken,
        aivideoautoImageModels, setAivideoautoImageModels,
        aivideoautoVideoModels, setAivideoautoVideoModels,
        imageEditModel, setImageEditModel,
        imageGenerateModel, setImageGenerateModel,
        videoGenerateModel, setVideoGenerateModel,
        imgbbApiKey, setImgbbApiKey,
    } = useApi();
    
    // Local state for all settings
    const [localFalKey, setLocalFalKey] = useState(falApiKey || '');
    const [localNanoBananaKey, setLocalNanoBananaKey] = useState(nanobananaApiKey || '');
    const [localImgbbKey, setLocalImgbbKey] = useState(imgbbApiKey || '');
    const [localAivideoautoKey, setLocalAivideoautoKey] = useState(aivideoautoAccessToken || '');
    
    const [localImageEditModel, setLocalImageEditModel] = useState(imageEditModel);
    const [localImageGenerateModel, setLocalImageGenerateModel] = useState(imageGenerateModel);
    const [localVideoGenerateModel, setLocalVideoGenerateModel] = useState(videoGenerateModel);
    
    const [isTestingAivideoauto, setIsTestingAivideoauto] = useState(false);
    const [aivideoautoError, setAivideoautoError] = useState<string | null>(null);
    const [aivideoautoSaveSuccess, setAivideoautoSaveSuccess] = useState(false);
    
    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleEsc);
        
        // Sync local state with context when modal opens
        setLocalFalKey(falApiKey || '');
        setLocalNanoBananaKey(nanobananaApiKey || '');
        setLocalImgbbKey(imgbbApiKey || '');
        setLocalAivideoautoKey(aivideoautoAccessToken || '');
        setLocalImageEditModel(imageEditModel);
        setLocalImageGenerateModel(imageGenerateModel);
        setLocalVideoGenerateModel(videoGenerateModel);

        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose, falApiKey, nanobananaApiKey, imgbbApiKey, aivideoautoAccessToken, imageEditModel, imageGenerateModel, videoGenerateModel]);
    
    if (!isOpen) return null;

    const handleAivideoautoKeyCheckAndSave = async () => {
        setIsTestingAivideoauto(true);
        setAivideoautoError(null);
        setAivideoautoSaveSuccess(false);
        try {
            const [videoModels, imageModels] = await Promise.all([
                listModels(localAivideoautoKey, 'video'),
                listModels(localAivideoautoKey, 'image')
            ]);
    
            setAivideoautoAccessToken(localAivideoautoKey);
            setAivideoautoVideoModels(videoModels);
            setAivideoautoImageModels(imageModels);
            setAivideoautoSaveSuccess(true);
            setTimeout(() => setAivideoautoSaveSuccess(false), 2000);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'An unknown error occurred.';
            setAivideoautoError(message);
        } finally {
            setIsTestingAivideoauto(false);
        }
    };
    
    const handleSave = () => {
        setFalApiKey(localFalKey);
        setNanobananaApiKey(localNanoBananaKey);
        setImgbbApiKey(localImgbbKey);
        // AIVideoAuto is saved on check
        
        setImageEditModel(localImageEditModel);
        setImageGenerateModel(localImageGenerateModel);
        setVideoGenerateModel(localVideoGenerateModel);
        
        onClose();
    };
    
    const IMAGE_EDIT_SERVICES = [
        { id: 'google', name: 'Google' }, { id: 'aivideoauto', name: 'AIVideoAuto' },
        { id: 'fal-ai', name: 'FAL' }, { id: 'nanobanana', name: 'NanoBanana' },
    ];
    const VIDEO_GENERATE_SERVICES = [
        { id: 'google', name: 'Google' }, { id: 'aivideoauto', name: 'AIVideoAuto' },
        { id: 'fal-ai', name: 'FAL' }, { id: 'nanobanana', name: 'NanoBanana' },
    ];

    const MODELS_BY_SERVICE = {
        imageEdit: {
            'google': [{ id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image' }],
            'fal-ai': [{ id: 'fal-ai/bytedance/seedream/v4/edit', name: 'Seedream V4 Edit' }],
            'nanobanana': [{ id: 'nanobanana/generate', name: 'Image to Image' }],
            'aivideoauto': aivideoautoImageModels.map(m => ({ id: `aivideoauto--${m.id_base}`, name: m.name })),
        },
        imageGenerate: {
            'google': [{ id: 'imagen-4.0-generate-001', name: 'Imagen 4' }],
            'fal-ai': [{ id: 'fal-ai/fast-sdxl', name: 'Fast SDXL' }],
            'nanobanana': [{ id: 'nanobanana/generate', name: 'Text to Image' }],
            'aivideoauto': aivideoautoImageModels.map(m => ({ id: `aivideoauto--${m.id_base}`, name: m.name })),
        },
        videoGenerate: {
            'google': [{ id: 'veo-3.1-fast-generate-preview', name: 'Veo Fast' }],
            'fal-ai': [{ id: 'fal-ai/fast-svd-lcm', name: 'Fast SVD LCM (Image-to-Video)' }],
            'nanobanana': [{ id: 'nanobanana/generate-video', name: 'Image to Video' }],
            'aivideoauto': aivideoautoVideoModels.map(m => ({ id: `aivideoauto--${m.id_base}`, name: m.name })),
        },
    };

    console.log('[SettingsModal] MODELS_BY_SERVICE:', {
        aivideoautoImageModelsCount: aivideoautoImageModels.length,
        aivideoautoImageModelsMapped: MODELS_BY_SERVICE.imageEdit.aivideoauto,
        localImageEditModel,
        localImageGenerateModel,
    });
    
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" onClick={onClose}>
            <div className="bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-700 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-white">Application Settings</h2>
                    <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </header>

                <div className="p-6 space-y-6 overflow-y-auto">
                    <section>
                        <h3 className="text-lg font-semibold text-emerald-400 mb-4">Default Model Selection</h3>
                        <div className="space-y-4">
                           <ServiceModelSelector label="Image Editing / Variation" services={IMAGE_EDIT_SERVICES} modelsByService={MODELS_BY_SERVICE.imageEdit} selectedModel={localImageEditModel} onModelChange={setLocalImageEditModel} />
                           <ServiceModelSelector label="Image Generation (Text-to-Image)" services={IMAGE_EDIT_SERVICES} modelsByService={MODELS_BY_SERVICE.imageGenerate} selectedModel={localImageGenerateModel} onModelChange={setLocalImageGenerateModel} />
                           <ServiceModelSelector label="Video Generation" services={VIDEO_GENERATE_SERVICES} modelsByService={MODELS_BY_SERVICE.videoGenerate} selectedModel={localVideoGenerateModel} onModelChange={setLocalVideoGenerateModel} />
                        </div>
                    </section>
                
                    <section>
                        <h3 className="text-lg font-semibold text-emerald-400 mb-4">API Keys</h3>
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                                <h4 className="font-semibold text-white mb-2">Google Gemini API</h4>
                                <div className="flex items-center gap-2">
                                    <CheckCircleIcon className="w-5 h-5 text-green-400" />
                                    <p className="text-sm text-slate-300">API Key is configured via environment.</p>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">ImgBB API Key</h4>
                                <input type="password" value={localImgbbKey} onChange={e => setLocalImgbbKey(e.target.value)} placeholder="Enter your ImgBB key" className="w-full bg-slate-700/50 border border-slate-600 rounded-md p-2 text-sm" />
                            </div>
                             <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">AIVideoAuto API</h4>
                                <p className="text-xs text-slate-400 mb-3">
                                    Get your access token from: <a href="https://aivideoauto.com/pages/account/apikeys" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">aivideoauto.com</a>
                                </p>
                                <div className="flex items-center gap-2">
                                    <input type="password" value={localAivideoautoKey} onChange={e => setLocalAivideoautoKey(e.target.value)} placeholder="Enter your AIVideoAuto Access Token" className="flex-grow bg-slate-700/50 border border-slate-600 rounded-md p-2 text-sm" />
                                    <button onClick={handleAivideoautoKeyCheckAndSave} disabled={isTestingAivideoauto || !localAivideoautoKey.trim()} className="bg-emerald-600 text-white font-semibold px-4 py-2 rounded-md text-sm w-40 text-center disabled:bg-slate-600">
                                        {isTestingAivideoauto ? <Spinner /> : aivideoautoSaveSuccess ? 'Saved!' : 'Check & Save Key'}
                                    </button>
                                </div>
                                {aivideoautoError && <p className="text-red-400 text-xs mt-2">{`Error: ${aivideoautoError}`}</p>}
                            </div>
                            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">FAL API Key</h4>
                                <input type="password" value={localFalKey} onChange={e => setLocalFalKey(e.target.value)} placeholder="fal-ai-key..." className="w-full bg-slate-700/50 border border-slate-600 rounded-md p-2 text-sm" />
                            </div>
                            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">NanoBanana API Key</h4>
                                <input type="password" value={localNanoBananaKey} onChange={e => setLocalNanoBananaKey(e.target.value)} placeholder="nanobanana-api-key..." className="w-full bg-slate-700/50 border border-slate-600 rounded-md p-2 text-sm" />
                            </div>
                        </div>
                    </section>
                </div>

                <footer className="flex justify-end p-4 border-t border-slate-700 flex-shrink-0">
                    <div className="flex gap-4">
                        <button onClick={onClose} className="bg-slate-700 text-white font-semibold py-2 px-5 rounded-lg text-sm hover:bg-slate-600 transition-colors">Cancel</button>
                        <button onClick={handleSave} className="bg-emerald-600 text-white font-semibold py-2 px-5 rounded-lg text-sm hover:bg-emerald-500 transition-colors">Save</button>
                    </div>
                </footer>
            </div>
        </div>
    );
};