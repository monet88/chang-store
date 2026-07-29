import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface MobileMenuButtonProps {
  onClick: () => void;
}

const MobileMenuButton: React.FC<MobileMenuButtonProps> = ({ onClick }) => {
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed left-4 top-4 z-sticky rounded-full border border-white/10 bg-black/70 p-3 text-zinc-200 backdrop-blur-xl transition-colors hover:border-white/20 hover:bg-black/85 hover:text-white lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
      aria-label={t('navigation.openMenu')}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="h-5 w-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
        />
      </svg>
    </button>
  );
};

export default MobileMenuButton;
