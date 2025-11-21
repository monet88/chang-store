
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-full">
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
          language === 'en' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'
        }`}
        aria-pressed={language === 'en'}
      >
        EN
      </button>
    </div>
  );
};

export default LanguageSwitcher;