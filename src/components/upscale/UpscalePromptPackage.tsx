/**
 * UpscalePromptPackage — Displays the generated upscale prompt with copy functionality.
 *
 * Shows the master prompt in a styled, readable container with a one-click
 * copy button that provides visual feedback.
 *
 * Receives data only — no state ownership.
 */

import React, { useState, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

interface UpscalePromptPackageProps {
  /** The generated master prompt string (null if not yet generated) */
  prompt: string | null;
}

const UpscalePromptPackage: React.FC<UpscalePromptPackageProps> = ({ prompt }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for clipboard failures
      console.warn('[UpscalePromptPackage] Clipboard write failed');
    }
  }, [prompt]);

  if (!prompt) {
    return (
      <div className="bg-zinc-800/30 rounded-xl border border-zinc-800 p-4 text-center">
        <p className="text-zinc-500 text-sm">{t('upscale.promptPackageEmpty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
          <span>📝</span>
          {t('upscale.promptPackageTitle')}
        </h4>
        <button
          onClick={handleCopy}
          className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 ${
            copied
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-zinc-700/60 text-zinc-300 hover:bg-zinc-700 border border-zinc-600/50'
          }`}
        >
          {copied ? t('upscale.promptPackageCopied') : t('upscale.promptPackageCopy')}
        </button>
      </div>

      <div className="bg-zinc-900/60 rounded-xl border border-zinc-700/50 p-4 max-h-[200px] overflow-y-auto">
        <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
          {prompt}
        </pre>
      </div>
    </div>
  );
};

export default UpscalePromptPackage;
