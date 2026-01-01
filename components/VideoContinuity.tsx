
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const VideoContinuity: React.FC = () => {
    const { t } = useLanguage();

    return (
        <div className="flex flex-col items-center">
            <h2 className="text-xl md:text-2xl font-bold text-center mb-1">{t('videoContinuity.title')}</h2>
            <p className="text-zinc-400 text-center mb-8 max-w-lg">{t('videoContinuity.description')}</p>
            <div className="w-full max-w-md p-8 bg-slate-800/50 rounded-lg text-center">
                <p className="text-slate-400">This feature's UI is not yet implemented.</p>
            </div>
        </div>
    );
};

export default VideoContinuity;
