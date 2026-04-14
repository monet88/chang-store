import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { BookmarkIcon } from './Icons';

interface PromptLibraryFABProps {
  onClick: () => void;
  label?: string;
}

const PromptLibraryFAB: React.FC<PromptLibraryFABProps> = ({ onClick, label }) => {
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={onClick}
      className="workspace-button min-w-[8.75rem] justify-start gap-3 rounded-2xl px-4 py-3 text-left"
      aria-label={t('promptLibrary.title')}
      title={t('promptLibrary.title')}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/30">
        <BookmarkIcon className="h-5 w-5" />
      </span>
      <span className="flex flex-col">
        <span className="workspace-label mb-1 block">
          {label || t('workspace.utility.prompts')}
        </span>
        <span className="text-sm font-medium tracking-[-0.01em]">
          {t('promptLibrary.title')}
        </span>
      </span>
    </button>
  );
};

export default PromptLibraryFAB;
