
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1">
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition-all duration-200 ${language === 'en'
            ? 'bg-white text-black'
            : 'text-zinc-500 hover:bg-white/6 hover:text-zinc-100'
          }`}
        aria-pressed={language === 'en'}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage('vi')}
        className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition-all duration-200 ${language === 'vi'
            ? 'bg-white text-black'
            : 'text-zinc-500 hover:bg-white/6 hover:text-zinc-100'
          }`}
        aria-pressed={language === 'vi'}
      >
        VI
      </button>
    </div>
  );
};

export default LanguageSwitcher;
