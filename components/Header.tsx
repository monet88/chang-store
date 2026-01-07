

import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import Tabs from './Tabs';
import { Feature } from '../types';
import { EditorIcon, GalleryIcon } from './Icons';
import Tooltip from './Tooltip';

interface HeaderProps {
  activeFeature: Feature;
  setActiveFeature: (feature: Feature) => void;
  onOpenSettings: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const Header: React.FC<HeaderProps> = ({ activeFeature, setActiveFeature, onOpenSettings, isOpen, onClose }) => {
  const { t } = useLanguage();
  return (
    <aside
      style={{ zoom: 1.3333 }}
      className={`
      fixed top-0 left-0 z-30 h-[75vh] w-72 flex flex-col p-4
      bg-slate-950/80 backdrop-blur-2xl border-r border-slate-800 shadow-2xl
      transition-transform duration-300 ease-in-out
      lg:translate-x-0 ${isOpen ? 'translate-x-0' : 'max-lg:-translate-x-full'}
    `}>
      {/* Close button for mobile */}
      <button
        onClick={onClose}
        className="lg:hidden absolute top-4 right-4 p-1 text-slate-400 hover:text-white transition-colors"
        aria-label="Close menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex-shrink-0 text-center mb-4">
        <div className="flex items-center justify-center gap-2">
          <GalleryIcon className="w-8 h-8 text-amber-400" />
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-amber-400">
            {t('header.title')}
          </h1>
        </div>
        <p className="text-xs text-slate-400 mt-2 px-4">
          {t('header.description')}
        </p>
      </div>

      <nav className="flex-grow overflow-y-auto pr-2 -mr-2 min-h-0">
        <Tabs activeFeature={activeFeature} setActiveFeature={setActiveFeature} />
      </nav>

      <div className="flex-shrink-0 mt-4 pt-3 border-t border-slate-800">
        <div className="flex items-center justify-between px-2">
          <LanguageSwitcher />
          <Tooltip content={t('tooltips.headerSettings')} position="top">
            <button onClick={onOpenSettings} className="p-2 text-slate-400 hover:text-white transition-colors bg-slate-900/50 rounded-lg border border-slate-800" aria-label="Open settings">
              <EditorIcon className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
};

export default Header;
