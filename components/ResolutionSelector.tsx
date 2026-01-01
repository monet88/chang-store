import React from 'react';
import { IMAGE_RESOLUTIONS, ImageResolution } from '../types';

interface ResolutionSelectorProps {
  resolution: ImageResolution;
  setResolution: (resolution: ImageResolution) => void;
}

const ResolutionSelector: React.FC<ResolutionSelectorProps> = ({ resolution, setResolution }) => {
  return (
    <div className="flex items-center gap-2 flex-wrap justify-center">
      <span className="text-slate-300 font-medium">Quality:</span>
      <div className="flex gap-2 bg-slate-800/50 p-1.5 rounded-lg flex-wrap justify-center">
          {IMAGE_RESOLUTIONS.map(res => (
              <button
                  key={res}
                  onClick={() => setResolution(res)}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${
                      resolution === res ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'
                  }`}
              >
                  {res}
              </button>
          ))}
      </div>
    </div>
  );
};

export default ResolutionSelector;
