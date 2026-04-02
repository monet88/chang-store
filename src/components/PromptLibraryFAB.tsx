import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { BookmarkIcon } from './Icons';

interface PromptLibraryFABProps {
    onClick: () => void;
}

const PromptLibraryFAB: React.FC<PromptLibraryFABProps> = ({ onClick }) => {
    const { t } = useLanguage();

    return (
        <button
            onClick={onClick}
            // Positioned above the Gallery button (bottom-24 vs bottom-6)
            className="fixed bottom-24 right-6 z-40 bg-[#818CF8] text-white rounded-full p-3.5 shadow-lg shadow-[#818CF8]/30 hover:bg-[#6366F1] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-[#818CF8] flex items-center justify-center transform hover:scale-105 group"
            aria-label={t('promptLibrary.title')}
            title={t('promptLibrary.title')}
        >
            <BookmarkIcon className="w-6 h-6" />
        </button>
    );
};

export default PromptLibraryFAB;
