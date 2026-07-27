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

const GeneratedImage: React.FC<GeneratedImageProps> = React.memo(({
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
                <HoverableImage image={image} altText={t('generatedImage.altText')} downloadPrefix="generated-image" />
            </div>
            <div className="flex-shrink-0 bg-zinc-900/50 p-4 rounded-lg border border-zinc-700 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 id="generated-image-refine-label" className="text-base md:text-lg font-semibold text-amber-400">{t('generatedImage.refineLabel')}</h3>
                    <div className="flex items-center gap-2">
                        <button onClick={onUndo} disabled={!canUndo} aria-label={t('generatedImage.undoAria')} className="p-2 rounded-full bg-zinc-700 text-white hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
                            <UndoIcon className="w-5 h-5" />
                        </button>
                        <button onClick={onRedo} disabled={!canRedo} aria-label={t('generatedImage.redoAria')} className="p-2 rounded-full bg-zinc-700 text-white hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
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
                        aria-labelledby="generated-image-refine-label"
                        className="flex-grow bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors"
                    />
                    <button onClick={handleRefineClick} disabled={isRefining || !refinePrompt.trim()} className="bg-amber-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-amber-500 disabled:bg-zinc-600 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900">
                        {isRefining ? <Spinner /> : t('generatedImage.refineButton')}
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {predefinedPrompts.map(prompt => (
                        <button key={prompt} onClick={() => onRefine(prompt)} disabled={isRefining} className="text-xs bg-zinc-700/80 text-zinc-200 font-medium py-1.5 px-3 rounded-full hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900">
                            ✨ {prompt}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
});

GeneratedImage.displayName = 'GeneratedImage';

export default GeneratedImage;
