

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
}

const Header: React.FC<HeaderProps> = ({ activeFeature, setActiveFeature, onOpenSettings }) => {
  const { t } = useLanguage();
  return (
    <aside className="fixed top-0 left-0 z-30 h-screen w-72 flex flex-col p-4 bg-slate-950/80 backdrop-blur-2xl border-r border-slate-800 shadow-2xl">
      <div className="flex-shrink-0 text-center mb-4">
        <div className="flex items-center justify-center gap-2">
            <GalleryIcon className="w-8 h-8 text-emerald-400" />
            <h1 className="text-2xl font-bold tracking-tight text-emerald-400">
                {t('header.title')}
            </h1>
            <Tooltip content={t('tooltips.headerSettings')} position="bottom">
              <button onClick={onOpenSettings} className="text-slate-400 hover:text-white transition-colors" aria-label="Open settings">
                <EditorIcon className="w-6 h-6" />
              </button>
            </Tooltip>
        </div>
        <p className="text-xs text-slate-400 mt-2 px-4">
            {t('header.description')}
        </p>
      </div>
      
      <nav className="flex-grow overflow-y-auto pr-2 -mr-2 min-h-0">
        <Tabs activeFeature={activeFeature} setActiveFeature={setActiveFeature} />
      </nav>

      <div className="flex-shrink-0 mt-4 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-center">
              <LanguageSwitcher />
          </div>
      </div>
    </aside>
  );
};

export default Header;