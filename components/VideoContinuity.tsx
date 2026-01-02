
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const VideoContinuity: React.FC = () => {
    const { t } = useLanguage();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden">
            <div className="flex flex-col items-center">
                <h2 className="text-xl md:text-2xl font-bold text-center mb-1">{t('videoContinuity.title')}</h2>
                <p className="text-zinc-400 text-center mb-8 max-w-lg">{t('videoContinuity.description')}</p>
                <div className="w-full max-w-md p-8 bg-zinc-900/50 rounded-lg border border-zinc-800 text-center">
                    <p className="text-zinc-400">This feature's UI is not yet implemented.</p>
                </div>
            </div>
        </div>
    );
};

export default VideoContinuity;
