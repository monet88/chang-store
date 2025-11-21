import React, { useState } from 'react';
import { ImageFile } from '../types';
import HoverableImage from './HoverableImage';
import Spinner from './Spinner';
import { useLanguage } from '../contexts/LanguageContext';
import { RedoIcon, UndoIcon } from './Icons';

interface GeneratedImageProps {
    image: ImageFile;
    onRefine: (prompt: string) => void;
    isRefining: boolean;
    onUndo: () => void;
    canUndo: boolean;
    onRedo: () => void;
    canRedo: boolean;
}

const GeneratedImage: React.FC<GeneratedImageProps> = ({
    image,
    onRefine,
    isRefining,
    onUndo,
    canUndo,
    onRedo,
    canRedo,
}) => {
    const { t } = useLanguage();
    const [refinePrompt, setRefinePrompt] = useState('');

    const handleRefineClick = () => {
        if (refinePrompt.trim()) {
            onRefine(refinePrompt);
        }
    };
    
    const predefinedPrompts: string[] = t('generatedImage.predefinedPrompts', { returnObjects: true });

    return (
        <div className="w-full h-full flex flex-col gap-4">
            <div className="flex-grow relative">
                <HoverableImage image={image} altText={t('generatedImage.altText')} />
            </div>
            <div className="flex-shrink-0 bg-slate-900/50 p-4 rounded-lg border border-slate-700 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-emerald-400">{t('generatedImage.refineLabel')}</h3>
                    <div className="flex items-center gap-2">
                        <button onClick={onUndo} disabled={!canUndo} aria-label={t('generatedImage.undoAria')} className="p-2 rounded-full bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            <UndoIcon className="w-5 h-5" />
                        </button>
                        <button onClick={onRedo} disabled={!canRedo} aria-label={t('generatedImage.redoAria')} className="p-2 rounded-full bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            <RedoIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={refinePrompt}
                        onChange={(e) => setRefinePrompt(e.target.value)}
                        placeholder={t('generatedImage.refinePlaceholder')}
                        className="flex-grow bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-slate-200 focus:ring-2 focus:ring-emerald-500 transition-colors"
                    />
                    <button onClick={handleRefineClick} disabled={isRefining || !refinePrompt.trim()} className="bg-emerald-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors">
                        {isRefining ? <Spinner /> : t('generatedImage.refineButton')}
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {predefinedPrompts.map(prompt => (
                        <button key={prompt} onClick={() => onRefine(prompt)} disabled={isRefining} className="text-xs bg-slate-700/80 text-slate-200 font-medium py-1.5 px-3 rounded-full hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            ✨ {prompt}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default GeneratedImage;