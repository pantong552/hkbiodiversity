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
    'hero.badge': '自然匯誌',
    'hero.title': '香港生物多樣性',
    'hero.subtitle_part1': '探索香港超過 ',
    'hero.subtitle_part2': '10,000',
    'hero.subtitle_part3': ' 種物種的詳盡資料庫，展現本地生態系統的驚人豐富度。',
    'search.placeholder': '快速搜尋俗名、學名...',
    'search.sidebar_placeholder': '快速檢索控制項...',
    'filter.title': '進階篩選',
    'filter.taxonomy': '物種分類層級',
    'filter.rarity': '稀有度與現狀',
    'filter.reset': '重置',
    'filter.clear_all': '清除所有篩選',
    'results.found': '找到',
    'results.unit': '項結果',
    'results.viewing_page': '正在查看第',
    'results.page_of': '頁，共',
    'sort.label': '排序方式',
    'sort.common_name': '俗名 (A-Z)',
    'sort.scientific_name': '學名 (A-Z)',
    'sort.rarity': '稀有度 (高級優先)',
    'pagination.page': '頁',
    'pagination.showing': '顯示',
    'pagination.of': '之中的',
    'pagination.species': '個物種',
    'empty.title': '找不到匹配的物種',
    'empty.subtitle': '請嘗試放寬篩選條件，或使用不同的搜尋字串進行檢索。',
    'view.per_page': '每頁顯示',
    'auth.login': '登入',
    'auth.logout': '登出'
  },
  en: {
    'nav.home': 'Home',
    'nav.about': 'About',
    'nav.blog': 'Blog',
    'nav.contact': 'Contact',
    'hero.badge': 'Nature Collective',
    'hero.title': 'Hong Kong Biodiversity',
    'hero.subtitle_part1': 'Explore our comprehensive database of over ',
    'hero.subtitle_part2': '10,000',
    'hero.subtitle_part3': ' species, showcasing the incredible richness of Hong Kong\'s local ecosystems.',
    'search.placeholder': 'Search common/scientific names...',
    'search.sidebar_placeholder': 'Quick filter search...',
    'filter.title': 'Advanced Filter',
    'filter.taxonomy': 'Taxonomy Levels',
    'filter.rarity': 'Rarity & Status',
    'filter.reset': 'Reset',
    'filter.clear_all': 'Clear All Filters',
    'results.found': 'Found',
    'results.unit': 'Results',
    'results.viewing_page': 'Viewing Page',
    'results.page_of': 'of',
    'sort.label': 'Sort By',
    'sort.common_name': 'Common Name (A-Z)',
    'sort.scientific_name': 'Scientific Name (A-Z)',
    'sort.rarity': 'Rarity (High First)',
    'pagination.page': 'Page',
    'pagination.showing': 'Showing',
    'pagination.of': 'of',
    'pagination.species': 'Species',
    'empty.title': 'No Matching Species Found',
    'empty.subtitle': 'Try relaxing your filters or using different search terms.',
    'view.per_page': 'Per Page',
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
