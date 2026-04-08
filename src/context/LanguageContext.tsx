'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'zh' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  zh: {
    'nav.home': '首頁',
    'nav.about': '關於我們',
    'nav.blog': '生態誌',
    'nav.contact': '聯絡我們',
    'hero.title': '香港生物多樣性彙編',
    'hero.subtitle': '探索、記錄並保護這座城市中驚人的生物多樣性真相。',
    'search.placeholder': '快速檢索物種...',
    'filter.title': '進階篩選',
    'filter.taxonomy': '物種分類層級',
    'filter.rarity': '稀有度與現狀',
    'sort.label': '排序方式',
    'sort.common_name': '俗名 (A-Z)',
    'sort.scientific_name': '學名 (A-Z)',
    'sort.rarity': '稀有度 (高級優先)',
    'view.page': '目前頁數',
    'view.results': '項結果',
    'auth.login': '登入',
    'auth.logout': '登出'
  },
  en: {
    'nav.home': 'Home',
    'nav.about': 'About',
    'nav.blog': 'Blog',
    'nav.contact': 'Contact',
    'hero.title': 'HK Biodiversity Collective',
    'hero.subtitle': 'Discover, document, and protect the incredible richness of Hong Kong\'s local ecosystems.',
    'search.placeholder': 'Quick search...',
    'filter.title': 'Advanced Filter',
    'filter.taxonomy': 'Taxonomy Levels',
    'filter.rarity': 'Rarity & Status',
    'sort.label': 'Sort By',
    'sort.common_name': 'Common Name (A-Z)',
    'sort.scientific_name': 'Scientific Name (A-Z)',
    'sort.rarity': 'Rarity (High First)',
    'view.page': 'Page',
    'view.results': 'results found',
    'auth.login': 'Login',
    'auth.logout': 'Logout'
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('zh');

  useEffect(() => {
    const savedLang = localStorage.getItem('hkbc-lang') as Language;
    if (savedLang && (savedLang === 'zh' || savedLang === 'en')) {
      setLanguageState(savedLang);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('hkbc-lang', lang);
  };

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
