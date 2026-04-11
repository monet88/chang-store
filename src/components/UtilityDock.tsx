import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import GalleryButton from './GalleryButton';
import PromptLibraryFAB from './PromptLibraryFAB';
import { ChevronDownIcon, ChevronUpIcon, EditorIcon } from './Icons';

interface UtilityDockProps {
  onOpenGallery: () => void;
  onOpenPromptLibrary: () => void;
  onOpenSettings: () => void;
}

const UtilityDock: React.FC<UtilityDockProps> = ({
  onOpenGallery,
  onOpenPromptLibrary,
  onOpenSettings,
}) => {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fixed inset-x-4 bottom-4 z-30 flex justify-end lg:inset-x-auto lg:right-8 lg:bottom-8">
      <div
        className={`workspace-panel flex flex-col gap-2 shadow-[0_18px_60px_rgba(0,0,0,0.32)] transition-all duration-200 ${
          isExpanded
            ? 'w-full max-w-[22rem] rounded-[1.75rem] p-2.5'
            : 'w-auto min-w-[12.5rem] rounded-[1.4rem] p-2'
        }`}
      >
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className={`flex items-center rounded-2xl text-left transition hover:bg-white/[0.04] ${
            isExpanded ? 'justify-between gap-3 px-2 py-2' : 'gap-2.5 px-2 py-1.5'
          }`}
          aria-expanded={isExpanded}
          aria-controls="studio-utilities-panel"
          aria-label={isExpanded ? t('workspace.utility.collapse') : t('workspace.utility.expand')}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-zinc-100">
            <EditorIcon className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="workspace-label block">{t('workspace.utility.title')}</span>
            {isExpanded && (
              <span className="mt-1 block text-xs leading-5 text-zinc-500">{t('workspace.utility.description')}</span>
            )}
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-zinc-100">
            {isExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronUpIcon className="h-4 w-4" />}
          </span>
        </button>

        {isExpanded && (
          <div id="studio-utilities-panel" className="flex flex-col gap-2 border-t border-white/10 pt-2">
            <GalleryButton onClick={onOpenGallery} />
            <PromptLibraryFAB onClick={onOpenPromptLibrary} />
            <button
              type="button"
              onClick={onOpenSettings}
              className="workspace-button min-w-[8.75rem] justify-start gap-3 rounded-2xl px-4 py-3 text-left"
              aria-label={t('tooltips.headerSettings')}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-zinc-100">
                <EditorIcon className="h-5 w-5" />
              </span>
              <span>
                <span className="workspace-label mb-1 block">{t('workspace.utility.settings')}</span>
                <span className="text-sm font-medium text-white">{t('workspace.utility.settings')}</span>
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UtilityDock;
