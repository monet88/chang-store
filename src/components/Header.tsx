import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import Tabs from './Tabs';
import { Feature, StudioMode } from '../types';
import { GalleryIcon } from './Icons';
import StudioModeSwitch from './studios/StudioModeSwitch';

interface HeaderProps {
  activeFeature: Feature;
  setActiveFeature: (feature: Feature) => void;
  isOpen: boolean;
  onClose: () => void;
  studioMode: StudioMode;
  onStudioModeChange: (mode: StudioMode) => void;
}

const Header: React.FC<HeaderProps> = ({
  activeFeature,
  setActiveFeature,
  isOpen,
  onClose,
  studioMode,
  onStudioModeChange,
}) => {
  const { t } = useLanguage();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-sidebar flex w-64 flex-col border-r border-white/10 bg-black/90 px-4 pb-4 pt-4 backdrop-blur-md transition-transform duration-300 ease-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : 'max-lg:-translate-x-full'}`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-zinc-100">
              <GalleryIcon className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                {t('navigation.workspaceEyebrow')}
              </p>
              <h1 className="text-sm font-semibold tracking-[-0.02em] text-zinc-50">
                {t('header.title')}
              </h1>
            </div>
          </div>
          <p className="max-w-xs text-xs leading-4 text-zinc-400">
            {t('header.description')}
          </p>
        </div>

        <button
          onClick={onClose}
          className="lg:hidden rounded-full border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          aria-label={t('navigation.closeMenu')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-6">
        <div className="mb-4">
          <StudioModeSwitch studioMode={studioMode} onChange={onStudioModeChange} />
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto pb-3 pr-1">
          <Tabs activeFeature={activeFeature} setActiveFeature={setActiveFeature} studioMode={studioMode} />
        </nav>
      </div>

      <div className="mt-6 border-t border-white/10 pt-4">
        <LanguageSwitcher />
      </div>
    </aside>
  );
};

export default Header;
