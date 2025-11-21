
import React, { useState, useEffect } from 'react';
import { ImageFile } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { CloseIcon, CopyIcon } from '../Icons';

export interface UploadResult {
    url: string;
    originalImage: ImageFile;
}
export interface UploadFailure {
    error: string;
    originalImage: ImageFile;
}

const UploadResultsModal: React.FC<{
    results: { success: UploadResult[]; failures: UploadFailure[] };
    onClose: () => void;
}> = ({ results, onClose }) => {
    const { t } = useLanguage();
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

    const handleCopy = (url: string) => {
        navigator.clipboard.writeText(url);
        setCopiedUrl(url);
        setTimeout(() => setCopiedUrl(null), 2000);
    };
    
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = 'auto';
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in" onClick={onClose} role="dialog" aria-modal="true">
            <div className="bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-700 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-white">Upload Results</h2>
                    <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </header>
                <div className="p-6 space-y-6 overflow-y-auto">
                    {results.success.length > 0 && (
                        <section>
                            <h3 className="text-lg font-semibold text-green-400 mb-4">Successful Uploads ({results.success.length})</h3>
                            <div className="space-y-4">
                                {results.success.map(({ url, originalImage }) => (
                                    <div key={url} className="flex items-center gap-4 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                        <img src={`data:${originalImage.mimeType};base64,${originalImage.base64}`} alt="Uploaded thumbnail" className="w-16 h-16 object-cover rounded-md"/>
                                        <div className="flex-grow overflow-hidden">
                                            <input type="text" readOnly value={url} className="w-full bg-slate-700/50 border border-slate-600 rounded-md p-2 text-sm text-slate-300 truncate" />
                                        </div>
                                        <button onClick={() => handleCopy(url)} className="flex items-center gap-2 text-sm bg-emerald-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-emerald-500 transition-colors">
                                            <CopyIcon className="w-4 h-4" />
                                            <span>{copiedUrl === url ? 'Copied!' : 'Copy'}</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                     {results.failures.length > 0 && (
                        <section>
                            <h3 className="text-lg font-semibold text-red-400 mb-4">Failed Uploads ({results.failures.length})</h3>
                            <div className="space-y-4">
                                {results.failures.map(({ error, originalImage }, index) => (
                                    <div key={index} className="flex items-start gap-4 bg-red-900/20 p-3 rounded-lg border border-red-500/30">
                                        <img src={`data:${originalImage.mimeType};base64,${originalImage.base64}`} alt="Failed thumbnail" className="w-16 h-16 object-cover rounded-md"/>
                                        <div className="flex-grow overflow-hidden">
                                            <p className="text-sm text-red-300 font-semibold">Upload Failed</p>
                                            <p className="text-xs text-red-400 mt-1 whitespace-pre-wrap">{error}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UploadResultsModal;
