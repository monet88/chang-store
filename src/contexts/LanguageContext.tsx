
import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect, useMemo } from 'react';
import { en, Translation } from '../locales/en';
import { vi } from '../locales/vi';

export type Language = 'en' | 'vi';

export const LANGUAGE_STORAGE_KEY = 'cs_language';

const getInitialLanguage = (): Language => {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'en' || saved === 'vi') return saved;
  } catch {
    // Ignore storage errors (e.g. sandboxed iframe or disabled cookies)
  }
  return 'en';
};

const get = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;

  // ⚡ Bolt: Fast path for flat keys to avoid allocating arrays with split()
  if (path.indexOf('.') === -1) {
    return obj[path];
  }

  // ⚡ Bolt: Use a standard for loop instead of reduce() to prevent unnecessary
  // function allocations and allow early returns on undefined paths.
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length; i++) {
    if (current === undefined || current === null) return undefined;
    current = current[parts[i]];
  }
  return current;
};

const translations = { en, vi };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, options?: { [key: string]: string | number } | { returnObjects: true }) => any;
  translations: Translation;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // Ignore storage errors
    }
  }, []);

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
        // ⚡ Bolt: Prefer native replaceAll() over dynamically instantiating
        // new RegExp() inside the loop to prevent memory overhead.
        translation = translation.replaceAll(`{{${optKey}}}`, String((options as any)[optKey]));
      });
    }
    return translation;
  }, [language]);

  // ⚡ Bolt: Wrap Context Provider value in useMemo to preserve object identity
  // and prevent massive cascading re-renders across all consumer components.
  const contextValue = useMemo(() => ({
    language,
    setLanguage,
    t,
    translations: translations[language]
  }), [language, setLanguage, t]);
  // translations is defined outside the component, so we only need to depend on `language`

  return (
    <LanguageContext.Provider value={contextValue}>
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
