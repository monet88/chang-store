import React, { useState, useEffect, useRef } from 'react';
import { useApi } from '../../contexts/ApiProviderContext';
import { getLocalStorageUsage, backupData, restoreData, clearAppData } from '../../utils/storage';
import { useImageGallery } from '../../contexts/ImageGalleryContext';
import { isDebugEnabled, setDebugEnabled } from '../../services/debugService';
import Spinner from '../Spinner';
import { CloseIcon } from '../Icons';
import { GoogleDriveSettings } from '../GoogleDriveSettings';
import { LOCAL_TEXT_MODELS_WITH_PREFIX, LOCAL_IMAGE_MODELS_WITH_PREFIX } from '../../utils/localModels';
import { ANTI_TEXT_MODELS, ANTI_TEXT_MODELS_WITH_PREFIX, ANTI_IMAGE_MODELS_WITH_PREFIX } from '../../utils/antiModels';
import { generateTextAnti } from '../../services/antiProviderService';

const ServiceModelSelector: React.FC<{
    label: string;
    services: {id: string, name: string}[];
    modelsByService: Record<string, {id: string, name: string}[]>;
    selectedModel: string;
    onModelChange: (modelId: string) => void;
}> = ({ label, services, modelsByService, selectedModel, onModelChange }) => {

    const parseModelId = (modelId: string): { service: string, model: string } => {
        if (modelId.startsWith('local--')) return { service: 'local', model: modelId };
        if (modelId.startsWith('anti--')) return { service: 'anti', model: modelId };
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
        antiApiBaseUrl, setAntiApiBaseUrl,
        antiApiKey, setAntiApiKey,
        imageEditModel, setImageEditModel,
        imageGenerateModel, setImageGenerateModel,
        textGenerateModel, setTextGenerateModel,
    } = useApi();
    const { images } = useImageGallery();

    // Local state for all settings
    const [antiProviderBaseUrl, setAntiProviderBaseUrl] = useState(antiApiBaseUrl || '');
    const [antiProviderApiKey, setAntiProviderApiKey] = useState(antiApiKey || '');

    const [localImageEditModel, setLocalImageEditModel] = useState(imageEditModel);
    const [localImageGenerateModel, setLocalImageGenerateModel] = useState(imageGenerateModel);
    const [localTextGenerateModel, setLocalTextGenerateModel] = useState(textGenerateModel);

    const [isTestingAntiProvider, setIsTestingAntiProvider] = useState(false);
    const [antiProviderError, setAntiProviderError] = useState<string | null>(null);
    const [antiProviderSaveSuccess, setAntiProviderSaveSuccess] = useState(false);

    const [debugMode, setDebugMode] = useState(() => isDebugEnabled());

    const handleDebugToggle = () => {
        const newValue = !debugMode;
        setDebugMode(newValue);
        setDebugEnabled(newValue);
    };

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
        setAntiProviderBaseUrl(antiApiBaseUrl || '');
        setAntiProviderApiKey(antiApiKey || '');
        setLocalImageEditModel(imageEditModel);
        setLocalImageGenerateModel(imageGenerateModel);
        setLocalTextGenerateModel(textGenerateModel);

        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose, images, antiApiBaseUrl, antiApiKey, imageEditModel, imageGenerateModel, textGenerateModel]);
    
    if (!isOpen) return null;

    const handleAntiProviderTestAndSave = async () => {
        setIsTestingAntiProvider(true);
        setAntiProviderError(null);
        setAntiProviderSaveSuccess(false);
        try {
            const trimmedBaseUrl = antiProviderBaseUrl.trim();
            if (!trimmedBaseUrl) {
                throw new Error('Base URL is required.');
            }
            const selectedAntiModel = localTextGenerateModel.startsWith('anti--')
                ? localTextGenerateModel.replace('anti--', '')
                : (ANTI_TEXT_MODELS[0]?.id || 'gemini-3-pro-preview');

            await generateTextAnti(
                'Ping',
                selectedAntiModel,
                { baseUrl: trimmedBaseUrl, apiKey: antiProviderApiKey.trim() || null }
            );

            setAntiApiBaseUrl(trimmedBaseUrl);
            setAntiApiKey(antiProviderApiKey.trim() || null);
            setAntiProviderSaveSuccess(true);
            setTimeout(() => setAntiProviderSaveSuccess(false), 2000);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'An unknown error occurred.';
            setAntiProviderError(message);
        } finally {
            setIsTestingAntiProvider(false);
        }
    };

    const handleSave = () => {
        setImageEditModel(localImageEditModel);
        setImageGenerateModel(localImageGenerateModel);
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
        { id: 'google', name: 'Google' },
        { id: 'local', name: 'Proxypal Provider' },
        { id: 'anti', name: 'Anti Provider' },
    ];
    const TEXT_GENERATE_SERVICES = [
        { id: 'google', name: 'Google' },
        { id: 'local', name: 'Proxypal Provider' },
        { id: 'anti', name: 'Anti Provider' },
    ];

    const MODELS_BY_SERVICE = {
        imageEdit: {
            'google': [
                { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image (Preview)' },
                { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image' },
            ],
            'local': LOCAL_IMAGE_MODELS_WITH_PREFIX,
            'anti': ANTI_IMAGE_MODELS_WITH_PREFIX,
        },
        imageGenerate: {
            'google': [
                { id: 'imagen-4.0-ultra-generate-001', name: 'Imagen 4 Ultra' },
                { id: 'imagen-4.0-generate-001', name: 'Imagen 4' },
                { id: 'imagen-4.0-fast-generate-001', name: 'Imagen 4 Fast' },
            ],
            'local': LOCAL_IMAGE_MODELS_WITH_PREFIX,
            'anti': ANTI_IMAGE_MODELS_WITH_PREFIX,
        },
        textGenerate: {
            'google': [
                { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview)' },
                { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)' },
                { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
                { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
            ],
            'local': LOCAL_TEXT_MODELS_WITH_PREFIX,
            'anti': ANTI_TEXT_MODELS_WITH_PREFIX,
        },
    };

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
                        </div>
                    </section>
                
                    <section>
                        <h3 className="text-base md:text-lg font-semibold text-amber-400 mb-4">API Keys</h3>
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">Anti Provider</h4>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-xs text-slate-400">
                                        Default: http://127.0.0.1:8045, API key: sk-monet4292
                                    </p>
                                    {(!antiProviderBaseUrl && !antiProviderApiKey) && (
                                        <button
                                            onClick={() => {
                                                setAntiProviderBaseUrl('http://127.0.0.1:8045');
                                                setAntiProviderApiKey('sk-monet4292');
                                            }}
                                            className="text-xs text-amber-400 hover:text-amber-300 underline"
                                        >
                                            Fill Defaults
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={antiProviderBaseUrl}
                                        onChange={e => setAntiProviderBaseUrl(e.target.value)}
                                        placeholder="http://127.0.0.1:8045"
                                        className="w-full bg-slate-700/50 border border-slate-600 rounded-md p-2 text-sm text-slate-200 placeholder-slate-500"
                                    />
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="password"
                                            value={antiProviderApiKey}
                                            onChange={e => setAntiProviderApiKey(e.target.value)}
                                            placeholder="sk-monet4292 (required)"
                                            className="flex-grow bg-slate-700/50 border border-slate-600 rounded-md p-2 text-sm"
                                        />
                                        <button
                                            onClick={handleAntiProviderTestAndSave}
                                            disabled={isTestingAntiProvider || !antiProviderBaseUrl.trim() || !antiProviderApiKey.trim()}
                                            className="bg-amber-600 text-white font-semibold px-4 py-2 rounded-md text-sm w-40 text-center disabled:bg-slate-600"
                                        >
                                            {isTestingAntiProvider ? <Spinner /> : antiProviderSaveSuccess ? 'Saved!' : 'Test & Save'}
                                        </button>
                                    </div>
                                </div>
                                {antiProviderError && <p className="text-red-400 text-xs mt-2">{`Error: ${antiProviderError}`}</p>}
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-base md:text-lg font-semibold text-amber-400 mb-4">Cloud Sync</h3>
                        <GoogleDriveSettings />
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

                    <section>
                        <h3 className="text-base md:text-lg font-semibold text-amber-400 mb-4">Developer</h3>
                        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-semibold text-slate-200">Debug Mode</h4>
                                    <p className="text-xs text-slate-400 mt-1">Log API calls to browser console (F12)</p>
                                </div>
                                <button
                                    onClick={handleDebugToggle}
                                    className={`relative w-12 h-6 rounded-full transition-colors ${
                                        debugMode ? 'bg-amber-500' : 'bg-slate-600'
                                    }`}
                                >
                                    <span
                                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                                            debugMode ? 'translate-x-6' : ''
                                        }`}
                                    />
                                </button>
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
