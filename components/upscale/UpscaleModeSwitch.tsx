/**
 * UpscaleModeSwitch — Segmented toggle between Quick Upscale and AI Studio.
 *
 * Thin UI-only component. Does not own state — receives mode and onSwitch from parent.
 * Switching modes preserves in-progress drafts (handled by the hook).
 */

import React from 'react';
import { UpscaleMode } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface UpscaleModeSwitchProps {
  mode: UpscaleMode;
  onSwitch: (mode: UpscaleMode) => void;
  disabled?: boolean;
}

const MODE_OPTIONS: { value: UpscaleMode; labelKey: string; icon: string }[] = [
  { value: 'quick', labelKey: 'upscale.modeQuick', icon: '⚡' },
  { value: 'studio', labelKey: 'upscale.modeStudio', icon: '🎨' },
];

const UpscaleModeSwitch: React.FC<UpscaleModeSwitchProps> = ({ mode, onSwitch, disabled }) => {
  const { t } = useLanguage();

  return (
    <div className="flex bg-zinc-800/60 rounded-xl p-1 gap-1">
      {MODE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onSwitch(opt.value)}
          disabled={disabled}
          aria-pressed={mode === opt.value}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
            mode === opt.value
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <span>{opt.icon}</span>
          <span>{t(opt.labelKey)}</span>
        </button>
      ))}
    </div>
  );
};

export default UpscaleModeSwitch;
