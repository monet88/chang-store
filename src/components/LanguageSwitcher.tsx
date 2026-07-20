
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      className="flex items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1"
      role="group"
      aria-label={t('navigation.language')}
    >
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${language === 'en'
          ? 'bg-white text-black'
          : 'text-zinc-500 hover:bg-white/6 hover:text-zinc-100'
          }`}
        aria-pressed={language === 'en'}
        aria-label="English"
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage('vi')}
        className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${language === 'vi'
          ? 'bg-white text-black'
          : 'text-zinc-500 hover:bg-white/6 hover:text-zinc-100'
          }`}
        aria-pressed={language === 'vi'}
        aria-label="Tiếng Việt"
      >
        VI
      </button>
    </div>
  );
};

export default LanguageSwitcher;
