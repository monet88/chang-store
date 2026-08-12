
import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect, useMemo } from 'react';
import { en, Translation } from '../locales/en';
import { vi } from '../locales/vi';

export type Language = 'en' | 'vi';

const get = (obj: any, path: string): any => {
  try {
    // ⚡ Bolt Optimization: Fast path for flat keys, avoids array allocation overhead from split()
    if (path.indexOf('.') === -1) {
      return obj[path];
    }

    // ⚡ Bolt Optimization: Replace .split('.').reduce() with a standard for-loop
    // to avoid allocating a new array and repeatedly iterating it.
    const parts = path.split('.');
    let acc = obj;
    for (let i = 0; i < parts.length; i++) {
      if (!acc) return undefined;
      acc = acc[parts[i]];
    }
    return acc;
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

  // Mirror the active locale onto <html lang> so screen readers pronounce
  // Vietnamese strings with Vietnamese phonemes. Without this, the index.html
  // fixed `lang="en"` bakes English pronunciation onto the default VI surface.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

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
        // ⚡ Bolt Optimization: Replaced dynamically instantiating new RegExp() inside the loop
        // with native replaceAll() to eliminate memory overhead during string interpolation.
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
  }), [language, t]);
  // setLanguage is from useState and has stable identity, so we don't need to add it to dependency array
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
