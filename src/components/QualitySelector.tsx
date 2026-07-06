import React from 'react';
import { Quality } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface QualitySelectorProps {
  quality: Quality;
  setQuality: (quality: Quality) => void;
}

const QualitySelector: React.FC<QualitySelectorProps> = ({ quality, setQuality }) => {
  const { t } = useLanguage();

  return (
    <div className="flex items-center gap-2">
      <span id="quality-label" className="text-zinc-300 font-medium">{t('studio.workflows.qualityLabel')}</span>
      <div
        role="group"
        aria-labelledby="quality-label"
        className="flex gap-2 bg-zinc-800/50 p-1.5 rounded-lg"
      >
        {(['standard', 'high'] as Quality[]).map(q => (
          <button
            key={q}
            type="button"
            aria-pressed={quality === q}
            onClick={() => setQuality(q)}
            className={`flex min-h-[44px] items-center justify-center px-4 py-2 text-sm font-semibold rounded-md capitalize transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${quality === q ? 'bg-amber-600 text-white' : 'text-zinc-300 hover:bg-zinc-700/50'
              }`}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QualitySelector;
