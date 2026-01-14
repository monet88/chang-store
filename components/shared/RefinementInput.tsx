import React, { useState, useRef, KeyboardEvent, ChangeEvent } from 'react';
import { RefinementHistoryItem } from '../../services/imageEditingService';
import Spinner from '../Spinner';
import Tooltip from '../Tooltip';
import { ChevronDownIcon, ChevronUpIcon, HistoryIcon, RefreshIcon } from '../Icons';
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
    <div className="w-full space-y-3">
      {/* Input Area */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={t('generatedImage.refinePlaceholder')}
            disabled={disabled || isRefining}
            rows={2}
            className="flex-1 px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
          />

          <Tooltip content="Iteratively refine the generated image with natural language prompts" position="bottom">
            <button
              onClick={handleSubmit}
              disabled={disabled || isRefining || !prompt.trim()}
              className="px-4 py-2 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 disabled:bg-zinc-600 disabled:cursor-not-allowed transition-colors min-w-[100px] h-[72px] flex items-center justify-center"
            >
              {isRefining ? <Spinner /> : t('generatedImage.refineButton')}
            </button>
          </Tooltip>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              onClick={handleReset}
              disabled={disabled || isRefining}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshIcon className="w-4 h-4" />
              Reset
            </button>
          )}

          {history.length > 0 && (
            <button
              onClick={toggleHistory}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 hover:text-white transition-colors"
            >
              <HistoryIcon className="w-4 h-4" />
              History ({history.length})
              {isHistoryExpanded ? (
                <ChevronUpIcon className="w-4 h-4" />
              ) : (
                <ChevronDownIcon className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Refinement History */}
      {history.length > 0 && isHistoryExpanded && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 space-y-2 max-h-[200px] overflow-y-auto animate-fade-in">
          <h4 className="text-sm font-semibold text-zinc-400 mb-2">Refinement History</h4>
          {history.map((item, index) => (
            <div
              key={index}
              className="flex items-start justify-between gap-3 p-2 bg-zinc-800/50 rounded border border-zinc-700/50"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200 break-words">{item.prompt}</p>
              </div>
              <span className="flex-shrink-0 text-xs text-zinc-500">
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
