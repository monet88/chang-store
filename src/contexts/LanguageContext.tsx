
import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { en, Translation } from '../locales/en';
import { vi } from '../locales/vi';

export type Language = 'en' | 'vi';

const get = (obj: any, path: string): any => {
  try {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  } catch (e) {
    return undefined;
  }
};

const translations = { en, vi };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, options?: { [key: string]: string | number } | { returnObjects: true }) => any;
  translations: Translation;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('vi');

  const t = useCallback((key: string, options?: { [key: string]: string | number } | { returnObjects: true }): any => {
    const langDict = translations[language];
    const translationValue = get(langDict, key);

    if (options && 'returnObjects' in options && options.returnObjects) {
      return translationValue || [];
    }

    let translation = translationValue || key;
    if (typeof translation !== 'string') return translation;

    if (options && !('returnObjects' in options)) {
      Object.keys(options).forEach(optKey => {
        translation = translation.replace(new RegExp(`{{${optKey}}}`, 'g'), String((options as any)[optKey]));
      });
    }
    return translation;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, translations: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
