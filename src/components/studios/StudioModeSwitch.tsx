import React, { useMemo } from 'react';
import type { StudioMode } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { getDesktopGatewayApi } from '../../platform/desktopGateway';

interface StudioModeSwitchProps {
  studioMode: StudioMode;
  onChange: (mode: StudioMode) => void;
}

const ALL_STUDIO_SEGMENTS: Array<{ mode: StudioMode; labelKey: string; desktopOnly?: boolean }> = [
  { mode: 'gemini', labelKey: 'studio.switch.gemini' },
  { mode: 'gptImage', labelKey: 'studio.switch.gptImage' },
  { mode: 'localQwen', labelKey: 'studio.switch.localQwen', desktopOnly: true },
];

/**
 * Studio switcher. Lets the user move between Gemini, GPT Image,
 * and Local Qwen (desktop only).
 */
const StudioModeSwitch: React.FC<StudioModeSwitchProps> = ({ studioMode, onChange }) => {
  const { t } = useLanguage();
  const isDesktop = typeof window !== 'undefined' && Boolean(window.desktopGateway || getDesktopGatewayApi());

  const segments = useMemo(() => {
    return ALL_STUDIO_SEGMENTS.filter((seg) => !seg.desktopOnly || isDesktop);
  }, [isDesktop]);

  return (
    <div
      role="radiogroup"
      aria-label={t('studio.switch.label')}
      className="flex w-full items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1"
    >
      {segments.map(({ mode, labelKey }) => {
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
