import React, { useState, useEffect, useRef } from 'react';
import { useApi } from '../../contexts/ApiProviderContext';
import { getLocalStorageUsage, backupData, restoreData, clearAppData } from '../../utils/storage';
import { useImageGallery } from '../../contexts/ImageGalleryContext';
import { isDebugEnabled, setDebugEnabled } from '../../services/debugService';
import Spinner from '../Spinner';
import { CloseIcon } from '../Icons';
import { GoogleDriveSettings } from '../GoogleDriveSettings';

const GOOGLE_IMAGE_EDIT_MODELS = [
    { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image (Preview)' },
    { id: 'gemini-3.1-flash-image-preview', name: 'Gemini 3.1 Flash Image (Preview)' },
    { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image' },
];

const GOOGLE_IMAGE_GENERATE_MODELS = [
    { id: 'imagen-4.0-ultra-generate-001', name: 'Imagen 4 Ultra' },
    { id: 'imagen-4.0-generate-001', name: 'Imagen 4' },
    { id: 'imagen-4.0-fast-generate-001', name: 'Imagen 4 Fast' },
];

const GOOGLE_TEXT_GENERATE_MODELS = [
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Preview)' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
];

const ModelSelector: React.FC<{
    label: string;
    models: { id: string; name: string }[];
    selectedModel: string;
    onModelChange: (modelId: string) => void;
}> = ({ label, models, selectedModel, onModelChange }) => (
    <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
        <select
            value={selectedModel}
            onChange={e => onModelChange(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-slate-200 text-sm h-[38px]"
        >
            {models.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
        </select>
    </div>
);


export const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const {
        imageEditModel, setImageEditModel,
        imageGenerateModel, setImageGenerateModel,
        textGenerateModel, setTextGenerateModel,
    } = useApi();
    const { images } = useImageGallery();

    const [localImageEditModel, setLocalImageEditModel] = useState(imageEditModel);
    const [localImageGenerateModel, setLocalImageGenerateModel] = useState(imageGenerateModel);
    const [localTextGenerateModel, setLocalTextGenerateModel] = useState(textGenerateModel);

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
        setLocalImageEditModel(imageEditModel);
        setLocalImageGenerateModel(imageGenerateModel);
        setLocalTextGenerateModel(textGenerateModel);

        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose, images, imageEditModel, imageGenerateModel, textGenerateModel]);
    
    if (!isOpen) return null;

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
                           <ModelSelector label="Text Generation (Analysis/Prompts)" models={GOOGLE_TEXT_GENERATE_MODELS} selectedModel={localTextGenerateModel} onModelChange={setLocalTextGenerateModel} />
                           <ModelSelector label="Image Editing / Variation" models={GOOGLE_IMAGE_EDIT_MODELS} selectedModel={localImageEditModel} onModelChange={setLocalImageEditModel} />
                           <ModelSelector label="Image Generation (Text-to-Image)" models={GOOGLE_IMAGE_GENERATE_MODELS} selectedModel={localImageGenerateModel} onModelChange={setLocalImageGenerateModel} />
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
