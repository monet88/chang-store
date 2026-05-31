import React from 'react';
import { Quality } from '../types';

interface QualitySelectorProps {
  quality: Quality;
  setQuality: (quality: Quality) => void;
}

const QualitySelector: React.FC<QualitySelectorProps> = ({ quality, setQuality }) => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-zinc-300 font-medium">Quality:</span>
      <div className="flex gap-2 bg-zinc-800/50 p-1.5 rounded-lg">
        {(['standard', 'high'] as Quality[]).map(q => (
          <button
            key={q}
            onClick={() => setQuality(q)}
            className={`flex min-h-[44px] items-center justify-center px-4 py-2 text-sm font-semibold rounded-md capitalize transition-colors duration-200 ${quality === q ? 'bg-amber-600 text-white' : 'text-zinc-300 hover:bg-zinc-700/50'
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
