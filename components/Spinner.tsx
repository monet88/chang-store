
import React from 'react';
import { CloseIcon, ErrorIcon } from './Icons';

interface SpinnerProps {
  className?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ className }) => {
  // Default classes if not overridden
  const sizeClasses = className?.match(/h-\d+|w-\d+/) ? '' : 'h-8 w-8';
  const colorClasses = className?.includes('border-') ? '' : 'border-amber-400';

  return (
    <div className="flex justify-center items-center">
      <div className={`animate-spin rounded-full border-b-2 ${sizeClasses} ${colorClasses} ${className || ''}`}></div>
    </div>
  );
};

export const ProgressBar: React.FC<{ progress: number; total: number }> = ({ progress, total }) => {
  const percentage = total > 0 ? Math.round((progress / total) * 100) : 0;
  return (
    <div className="w-full max-w-xs mx-auto">
        <div className="text-right text-xs font-semibold text-slate-400 mb-1">{percentage}%</div>
        <div className="w-full bg-slate-700 rounded-full h-2">
            <div 
            className="bg-gradient-to-r from-amber-500 to-green-500 h-2 rounded-full transition-all duration-300 ease-linear" 
            style={{ width: `${percentage}%` }}
            ></div>
        </div>
    </div>
  );
};

export const ErrorDisplay: React.FC<{ title: string; message: string; onClear?: () => void }> = ({ title, message, onClear }) => {
  return (
    <div className="relative bg-red-900/50 border border-red-500/50 text-red-300 p-4 rounded-lg text-center w-full animate-fade-in">
        {onClear && (
            <button onClick={onClear} className="absolute top-2 right-2 text-red-300 hover:text-white">
                <CloseIcon className="w-5 h-5" />
            </button>
        )}
        <h3 className="font-bold mb-2 flex items-center justify-center gap-2 text-red-200">
            <ErrorIcon className="w-6 h-6" /> {title}
        </h3>
        <p className="text-sm">{message}</p>
    </div>
  );
};

export default Spinner;
