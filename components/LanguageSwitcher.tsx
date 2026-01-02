
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-full border border-slate-700/50">
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all duration-200 ${language === 'en'
            ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
          }`}
        aria-pressed={language === 'en'}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage('vi')}
        className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all duration-200 ${language === 'vi'
            ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
          }`}
        aria-pressed={language === 'vi'}
      >
        VI
      </button>
    </div>
  );
};

export default LanguageSwitcher;
