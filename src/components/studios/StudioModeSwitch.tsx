import React from 'react';
import { StudioMode } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface StudioModeSwitchProps {
  studioMode: StudioMode;
  onChange: (mode: StudioMode) => void;
}

const STUDIO_SEGMENTS: Array<{ mode: StudioMode; labelKey: string }> = [
  { mode: 'gemini', labelKey: 'studio.switch.gemini' },
  { mode: 'gptImage', labelKey: 'studio.switch.gptImage' },
];

/**
 * Studio switcher. Lets the user move between the Gemini studio
 * (default) and the GPT Image studio.
 */
const StudioModeSwitch: React.FC<StudioModeSwitchProps> = ({ studioMode, onChange }) => {
  const { t } = useLanguage();

  return (
    <div
      role="radiogroup"
      aria-label={t('studio.switch.label')}
      className="flex w-full items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1"
    >
      {STUDIO_SEGMENTS.map(({ mode, labelKey }) => {
        const isActive = studioMode === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(mode)}
            className={`flex min-h-[44px] flex-1 items-center justify-center rounded-xl px-3 py-2.5 text-sm font-medium tracking-[-0.01em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${isActive
                ? 'bg-white/[0.14] text-zinc-50'
                : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100'
              }`}
          >
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
};

export default StudioModeSwitch;
