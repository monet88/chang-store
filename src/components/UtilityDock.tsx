import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import GalleryButton from './GalleryButton';
import PromptLibraryFAB from './PromptLibraryFAB';
import { EditorIcon } from './Icons';

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

  return (
    <div className="fixed inset-x-4 bottom-4 z-30 lg:inset-x-auto lg:right-8 lg:bottom-8">
      <div className="workspace-panel mx-auto flex max-w-[22rem] flex-col gap-2 rounded-[1.75rem] p-2.5 lg:max-w-none">
        <div className="hidden px-2 pt-1 lg:block">
          <p className="workspace-label mb-1">{t('workspace.utility.title')}</p>
          <p className="text-xs leading-5 text-zinc-500">{t('workspace.utility.description')}</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
              <span className="workspace-label block mb-1">{t('workspace.utility.settings')}</span>
              <span className="text-sm font-medium text-white">{t('workspace.utility.settings')}</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default UtilityDock;
