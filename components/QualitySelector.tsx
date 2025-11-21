import React from 'react';
import { Quality } from '../types';

interface QualitySelectorProps {
  quality: Quality;
  setQuality: (quality: Quality) => void;
}

const QualitySelector: React.FC<QualitySelectorProps> = ({ quality, setQuality }) => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-300 font-medium">Quality:</span>
      <div className="flex gap-2 bg-slate-800/50 p-1.5 rounded-lg">
          {(['standard', 'high'] as Quality[]).map(q => (
              <button
                  key={q}
                  onClick={() => setQuality(q)}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-md capitalize transition-colors duration-200 ${
                      quality === q ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'
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