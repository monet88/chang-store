import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { PredefinedBackground } from './predefinedContent';

interface PredefinedBackgroundSelectorProps {
  backgrounds: PredefinedBackground[];
  selectedPrompt: string;
  onSelect: (prompt: string) => void;
}

const PredefinedBackgroundSelector: React.FC<PredefinedBackgroundSelectorProps> = ({ backgrounds, selectedPrompt, onSelect }) => {
    const { t } = useLanguage();

    return (
        <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-300 text-center">{t('predefinedBackgrounds.title')}</h4>
            <div className="relative">
                <div className="flex space-x-4 overflow-x-auto pb-3 -mb-3">
                    {backgrounds.map((bg) => {
                        const isSelected = selectedPrompt === bg.prompt;
                        return (
                            <button
                                key={bg.id}
                                onClick={() => onSelect(bg.prompt)}
                                className={`flex-shrink-0 w-28 h-36 rounded-lg overflow-hidden border-2 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 ${
                                    isSelected ? 'border-indigo-500 scale-105' : 'border-transparent hover:border-gray-500'
                                }`}
                                aria-pressed={isSelected}
                            >
                                <div className="relative w-full h-full">
                                    <img src={bg.thumbnailUrl} alt={bg.name} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-2">
                                        <p className={`text-xs font-semibold text-white transition-transform duration-200 ${isSelected ? 'translate-y-0' : 'translate-y-1 group-hover:translate-y-0'}`}>{bg.name}</p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default PredefinedBackgroundSelector;
