import React, { useState, useRef, KeyboardEvent, ChangeEvent } from 'react';
import { RefinementHistoryItem } from '../../services/imageEditingService';
import Spinner from '../Spinner';
import Tooltip from '../Tooltip';
import { ChevronDownIcon, ChevronUpIcon, HistoryIcon, RefreshIcon, MagicWandIcon } from '../Icons';
import { useLanguage } from '../../contexts/LanguageContext';

interface RefinementInputProps {
  onRefine: (prompt: string) => void;
  onReset: () => void;
  history: RefinementHistoryItem[];
  isRefining: boolean;
  disabled: boolean;
}

const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const RefinementInput: React.FC<RefinementInputProps> = ({
  onRefine,
  onReset,
  history,
  isRefining,
  disabled,
}) => {
  const { t } = useLanguage();
  const [prompt, setPrompt] = useState('');
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  };

  const handleSubmit = () => {
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt && !isRefining && !disabled) {
      onRefine(trimmedPrompt);
      setPrompt('');
    }
  };

  const handleReset = () => {
    if (!isRefining && !disabled) {
      onReset();
      setPrompt('');
    }
  };

  const toggleHistory = () => {
    setIsHistoryExpanded(!isHistoryExpanded);
  };

  return (
    <div className="w-full space-y-3 mt-4">
      {/* Input Area */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={t('generatedImage.refinePlaceholder')}
              disabled={disabled || isRefining}
              rows={1}
              className="w-full pl-10 pr-4 py-3 bg-zinc-900/80 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed resize-none transition-all shadow-sm min-h-[48px]"
            />
            <div className="absolute left-3 top-3.5 text-zinc-500">
              <MagicWandIcon className="w-5 h-5" />
            </div>
          </div>

          <Tooltip content={t('tooltips.lookbookRefinement')} position="bottom">
            <button
              onClick={handleSubmit}
              disabled={disabled || isRefining || !prompt.trim()}
              className="px-6 py-3 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg hover:shadow-amber-900/20 min-w-[100px] h-[48px] flex items-center justify-center"
            >
              {isRefining ? <Spinner className="h-5 w-5 border-white" /> : t('generatedImage.refineButton')}
            </button>
          </Tooltip>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
             {history.length > 0 && (
              <button
                onClick={toggleHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-800/50 text-zinc-400 rounded-lg hover:bg-zinc-800 hover:text-zinc-200 transition-colors border border-transparent hover:border-zinc-700"
              >
                <HistoryIcon className="w-3.5 h-3.5" />
                {t('generatedImage.refineHistory')} ({history.length})
                {isHistoryExpanded ? (
                  <ChevronUpIcon className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDownIcon className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
          
          {history.length > 0 && (
            <button
              onClick={handleReset}
              disabled={disabled || isRefining}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              <RefreshIcon className="w-3.5 h-3.5" />
              {t('generatedImage.refineReset')}
            </button>
          )}
        </div>
      </div>

      {/* Refinement History */}
      {history.length > 0 && isHistoryExpanded && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-1 space-y-1 max-h-[200px] overflow-y-auto animate-fade-in custom-scrollbar">
          {history.map((item, index) => (
            <div
              key={index}
              className="flex items-start justify-between gap-3 p-3 hover:bg-zinc-800/50 rounded-lg transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-300 break-words group-hover:text-white transition-colors">{item.prompt}</p>
              </div>
              <span className="flex-shrink-0 text-xs text-zinc-600 group-hover:text-zinc-500">
                {formatTimeAgo(item.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RefinementInput;
