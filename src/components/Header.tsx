import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import Tabs from './Tabs';
import { Feature } from '../types';
import { GalleryIcon } from './Icons';

interface HeaderProps {
  activeFeature: Feature;
  setActiveFeature: (feature: Feature) => void;
  isOpen: boolean;
  onClose: () => void;
}

const Header: React.FC<HeaderProps> = ({ activeFeature, setActiveFeature, isOpen, onClose }) => {
  const { t } = useLanguage();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-[22rem] flex-col border-r border-white/10 bg-black/90 px-6 pb-6 pt-7 backdrop-blur-2xl transition-transform duration-300 ease-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : 'max-lg:-translate-x-full'}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-100">
              <GalleryIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {t('navigation.workspaceEyebrow')}
              </p>
              <h1 className="text-xl font-medium tracking-[-0.03em] text-zinc-50">
                {t('header.title')}
              </h1>
            </div>
          </div>
          <p className="max-w-xs text-base leading-7 text-zinc-300">
            {t('header.description')}
          </p>
        </div>

        <button
          onClick={onClose}
          className="lg:hidden rounded-full border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition-colors hover:text-white"
          aria-label={t('navigation.closeMenu')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-hidden pt-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            {t('navigation.toolsEyebrow')}
          </p>
          <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-zinc-400">
            {t('navigation.mediaFirstLabel')}
          </span>
        </div>
        <nav className="h-full overflow-y-auto pr-1">
          <Tabs activeFeature={activeFeature} setActiveFeature={setActiveFeature} />
        </nav>
      </div>

      <div className="mt-6 border-t border-white/10 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
            {t('navigation.language')}
          </p>
        </div>
        <LanguageSwitcher />
      </div>
    </aside>
  );
};

export default Header;
