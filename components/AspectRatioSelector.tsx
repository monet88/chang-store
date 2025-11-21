import React from 'react';
import { AspectRatio } from '../types';

interface AspectRatioSelectorProps {
  aspectRatio: AspectRatio;
  setAspectRatio: (ratio: AspectRatio) => void;
}

const RATIOS: AspectRatio[] = ['Default', '1:1', '9:16', '16:9', '4:3', '3:4'];

const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({ aspectRatio, setAspectRatio }) => {
  return (
    <div className="flex items-center gap-2 flex-wrap justify-center">
      <span className="text-slate-300 font-medium">Aspect Ratio:</span>
      <div className="flex gap-2 bg-slate-800/50 p-1.5 rounded-lg flex-wrap justify-center">
          {RATIOS.map(ratio => (
              <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${
                      aspectRatio === ratio ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'
                  }`}
              >
                  {ratio}
              </button>
          ))}
      </div>
    </div>
  );
};

export default AspectRatioSelector;