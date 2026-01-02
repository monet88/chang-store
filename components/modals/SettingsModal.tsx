import React, { useState, useEffect, useRef } from 'react';
import { useApi } from '../../contexts/ApiProviderContext';
import { getLocalStorageUsage, backupData, restoreData, clearAppData } from '../../utils/storage';
import { useImageGallery } from '../../contexts/ImageGalleryContext';
import { listModels } from '../../services/aivideoautoService';
import Spinner from '../Spinner';
import { CloseIcon, CheckCircleIcon } from '../Icons';
import { ImageEditModel, ImageGenerateModel, VideoGenerateModel, TextGenerateModel } from '../../types';

const ServiceModelSelector: React.FC<{
    label: string;
    services: {id: string, name: string}[];
    modelsByService: Record<string, {id: string, name: string}[]>;
    selectedModel: string;
    onModelChange: (modelId: string) => void;
}> = ({ label, services, modelsByService, selectedModel, onModelChange }) => {

    const parseModelId = (modelId: string): { service: string, model: string } => {
        if (modelId.startsWith('aivideoauto--')) return { service: 'aivideoauto', model: modelId };
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
        googleApiKey, setGoogleApiKey,
        aivideoautoAccessToken, setAivideoautoAccessToken,
        aivideoautoImageModels, setAivideoautoImageModels,
        aivideoautoVideoModels, setAivideoautoVideoModels,
        imageEditModel, setImageEditModel,
        imageGenerateModel, setImageGenerateModel,
        videoGenerateModel, setVideoGenerateModel,
        textGenerateModel, setTextGenerateModel,
    } = useApi();
    const { images } = useImageGallery();
    
    // Local state for all settings
    const [localGoogleKey, setLocalGoogleKey] = useState(googleApiKey || '');
    const [localAivideoautoKey, setLocalAivideoautoKey] = useState(aivideoautoAccessToken || '');
    
    const [localImageEditModel, setLocalImageEditModel] = useState(imageEditModel);
    const [localImageGenerateModel, setLocalImageGenerateModel] = useState(imageGenerateModel);
    const [localVideoGenerateModel, setLocalVideoGenerateModel] = useState(videoGenerateModel);
    const [localTextGenerateModel, setLocalTextGenerateModel] = useState(textGenerateModel);
    
    const [isTestingAivideoauto, setIsTestingAivideoauto] = useState(false);
    const [aivideoautoError, setAivideoautoError] = useState<string | null>(null);
    const [aivideoautoSaveSuccess, setAivideoautoSaveSuccess] = useState(false);
    
    const [storageUsage, setStorageUsage] = useState(0);
    const [storageQuota, setStorageQuota] = useState(200 * 1024 * 1024);
    
    const restoreInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleEsc);
        
        getLocalStorageUsage().then(({ usage, quota }) => {
            setStorageUsage(usage);
            if (quota > 0) setStorageQuota(quota);
        });
        
        // Sync local state with context when modal opens
        setLocalGoogleKey(googleApiKey || '');
        setLocalAivideoautoKey(aivideoautoAccessToken || '');
        setLocalImageEditModel(imageEditModel);
        setLocalImageGenerateModel(imageGenerateModel);
        setLocalVideoGenerateModel(videoGenerateModel);
        setLocalTextGenerateModel(textGenerateModel);

        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose, images, googleApiKey, aivideoautoAccessToken, imageEditModel, imageGenerateModel, videoGenerateModel, textGenerateModel]);
    
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
        setGoogleApiKey(localGoogleKey);
        // AIVideoAuto is saved on check

        setImageEditModel(localImageEditModel);
        setImageGenerateModel(localImageGenerateModel);
        setVideoGenerateModel(localVideoGenerateModel);
        setTextGenerateModel(localTextGenerateModel);

        onClose();
    };

    const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            await restoreData(file);
            alert('Data restored successfully! The page will now reload to apply changes.');
            window.location.reload();
        } catch (error) {
            alert(`Restore failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const handleClear = () => {
        if (window.confirm('Are you sure you want to permanently delete all application data, including API keys and your image gallery? This action cannot be undone.')) {
            clearAppData();
            alert('All application data has been cleared. The page will now reload.');
            window.location.reload();
        }
    };
    
    const IMAGE_EDIT_SERVICES = [
        { id: 'google', name: 'Google' }, { id: 'aivideoauto', name: 'AIVideoAuto' },
    ];
    const VIDEO_GENERATE_SERVICES = [
        { id: 'google', name: 'Google' }, { id: 'aivideoauto', name: 'AIVideoAuto' },
    ];
    const TEXT_GENERATE_SERVICES = [
        { id: 'google', name: 'Google' },
    ];

    const MODELS_BY_SERVICE = {
        imageEdit: {
            'google': [
                { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image (Preview)' },
                { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image' },
            ],
            'aivideoauto': aivideoautoImageModels.map(m => ({ id: `aivideoauto--${m.id_base}`, name: m.name })),
        },
        imageGenerate: {
            'google': [
                { id: 'imagen-4.0-ultra-generate-001', name: 'Imagen 4 Ultra' },
                { id: 'imagen-4.0-generate-001', name: 'Imagen 4' },
                { id: 'imagen-4.0-fast-generate-001', name: 'Imagen 4 Fast' },
            ],
            'aivideoauto': aivideoautoImageModels.map(m => ({ id: `aivideoauto--${m.id_base}`, name: m.name })),
        },
        videoGenerate: {
            'google': [
                { id: 'veo-3.1-generate-preview', name: 'Veo 3.1' },
                { id: 'veo-3.1-fast-generate-preview', name: 'Veo 3.1 Fast' },
                { id: 'veo-3.0-generate-001', name: 'Veo 3' },
                { id: 'veo-3.0-fast-generate-001', name: 'Veo 3 Fast' },
            ],
            'aivideoauto': aivideoautoVideoModels.map(m => ({ id: `aivideoauto--${m.id_base}`, name: m.name })),
        },
        textGenerate: {
            'google': [
                { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview)' },
                { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)' },
                { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
                { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
            ],
        },
    };

    console.log('[SettingsModal] MODELS_BY_SERVICE:', {
        aivideoautoImageModelsCount: aivideoautoImageModels.length,
        aivideoautoImageModelsMapped: MODELS_BY_SERVICE.imageEdit.aivideoauto,
        localImageEditModel,
        localImageGenerateModel,
    });

    const storagePercentage = storageQuota > 0 ? (storageUsage / storageQuota) * 100 : 0;
    const usageMB = (storageUsage / 1024 / 1024).toFixed(2);
    const quotaMB = (storageQuota / 1024 / 1024).toFixed(2);
    
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" onClick={onClose}>
            <div className="bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-700 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
                    <h2 className="text-xl md:text-2xl font-bold text-white">Application Settings</h2>
                    <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </header>

                <div className="p-6 space-y-6 overflow-y-auto">
                    <section>
                        <h3 className="text-base md:text-lg font-semibold text-amber-400 mb-4">Default Model Selection</h3>
                        <div className="space-y-4">
                           <ServiceModelSelector label="Text Generation (Analysis/Prompts)" services={TEXT_GENERATE_SERVICES} modelsByService={MODELS_BY_SERVICE.textGenerate} selectedModel={localTextGenerateModel} onModelChange={setLocalTextGenerateModel} />
                           <ServiceModelSelector label="Image Editing / Variation" services={IMAGE_EDIT_SERVICES} modelsByService={MODELS_BY_SERVICE.imageEdit} selectedModel={localImageEditModel} onModelChange={setLocalImageEditModel} />
                           <ServiceModelSelector label="Image Generation (Text-to-Image)" services={IMAGE_EDIT_SERVICES} modelsByService={MODELS_BY_SERVICE.imageGenerate} selectedModel={localImageGenerateModel} onModelChange={setLocalImageGenerateModel} />
                           <ServiceModelSelector label="Video Generation" services={VIDEO_GENERATE_SERVICES} modelsByService={MODELS_BY_SERVICE.videoGenerate} selectedModel={localVideoGenerateModel} onModelChange={setLocalVideoGenerateModel} />
                        </div>
                    </section>
                
                    <section>
                        <h3 className="text-base md:text-lg font-semibold text-amber-400 mb-4">API Keys</h3>
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">Google Gemini API Key</h4>
                                <input 
                                    type="password" 
                                    value={localGoogleKey} 
                                    onChange={e => setLocalGoogleKey(e.target.value)} 
                                    placeholder="Enter your Google Gemini API key..." 
                                    className="w-full bg-slate-700/50 border border-slate-600 rounded-md p-2 text-sm text-slate-200 placeholder-slate-500 mb-1" 
                                />
                                <div className="flex items-center gap-2 mt-1">
                                    {!localGoogleKey && (
                                        <>
                                            <CheckCircleIcon className="w-4 h-4 text-green-400" />
                                            <p className="text-xs text-slate-400">Using default environment key</p>
                                        </>
                                    )}
                                </div>
                            </div>
                             <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">AIVideoAuto API</h4>
                                <p className="text-xs text-slate-400 mb-3">
                                    Get your access token from: <a href="https://aivideoauto.com/pages/account/apikeys" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">aivideoauto.com</a>
                                </p>
                                <div className="flex items-center gap-2">
                                    <input type="password" value={localAivideoautoKey} onChange={e => setLocalAivideoautoKey(e.target.value)} placeholder="Enter your AIVideoAuto Access Token" className="flex-grow bg-slate-700/50 border border-slate-600 rounded-md p-2 text-sm" />
                                    <button onClick={handleAivideoautoKeyCheckAndSave} disabled={isTestingAivideoauto || !localAivideoautoKey.trim()} className="bg-amber-600 text-white font-semibold px-4 py-2 rounded-md text-sm w-40 text-center disabled:bg-slate-600">
                                        {isTestingAivideoauto ? <Spinner /> : aivideoautoSaveSuccess ? 'Saved!' : 'Check & Save Key'}
                                    </button>
                                </div>
                                {aivideoautoError && <p className="text-red-400 text-xs mt-2">{`Error: ${aivideoautoError}`}</p>}
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-base md:text-lg font-semibold text-amber-400 mb-4">Application Data</h3>
                        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                            <p className="text-sm text-slate-300 mb-2">Local browser storage usage:</p>
                            <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
                                <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-4 rounded-full" style={{ width: `${storagePercentage}%` }}></div>
                            </div>
                            <p className="text-xs text-slate-400 mt-1 text-right">{usageMB} MB / {quotaMB} MB ({storagePercentage.toFixed(1)}%)</p>
                             <p className="text-xs text-slate-500 mt-4 mb-4">Backup, restore, or clear all application data, including API keys, model preferences, and the image gallery.</p>
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <button onClick={backupData} className="bg-slate-700 text-white font-semibold py-2 rounded-md text-sm">Backup Data</button>
                                <button onClick={() => restoreInputRef.current?.click()} className="bg-slate-700 text-white font-semibold py-2 rounded-md text-sm">Restore Data</button>
                                <input type="file" ref={restoreInputRef} onChange={handleRestore} className="hidden" accept=".json" />
                                <button onClick={handleClear} className="bg-red-600/80 text-white font-semibold py-2 rounded-md text-sm">Clear All Data</button>
                            </div>
                        </div>
                    </section>
                </div>

                <footer className="flex justify-end p-4 border-t border-slate-700 flex-shrink-0">
                    <div className="flex gap-4">
                        <button onClick={onClose} className="bg-slate-700 text-white font-semibold py-2 px-5 rounded-lg text-sm hover:bg-slate-600 transition-colors">Cancel</button>
                        <button onClick={handleSave} className="bg-amber-600 text-white font-semibold py-2 px-5 rounded-lg text-sm hover:bg-amber-500 transition-colors">Save</button>
                    </div>
                </footer>
            </div>
        </div>
    );
};
