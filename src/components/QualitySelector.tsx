import React, { useId } from 'react';
import { Quality } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface QualitySelectorProps {
  quality: Quality;
  setQuality: (quality: Quality) => void;
}

const QualitySelector: React.FC<QualitySelectorProps> = ({ quality, setQuality }) => {
  const { t } = useLanguage();
  const labelId = useId();
  const groupName = useId();

  return (
    <div className="flex items-center gap-2">
      <span id={labelId} className="text-zinc-300 font-medium">{t('studio.workflows.qualityLabel')}:</span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex gap-2 bg-zinc-800/50 p-1.5 rounded-lg"
      >
        {(['standard', 'high'] as Quality[]).map(q => {
          const isSelected = quality === q;

          return (
            <label
              key={q}
              className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-md px-4 py-2 text-sm font-semibold capitalize transition-colors duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-amber-500 ${isSelected ? 'bg-amber-600 text-white' : 'text-zinc-300 hover:bg-zinc-700/50'
                }`}
            >
              <input
                type="radio"
                name={groupName}
                value={q}
                checked={isSelected}
                onChange={() => setQuality(q)}
                className="sr-only"
              />
              {q}
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default QualitySelector;
