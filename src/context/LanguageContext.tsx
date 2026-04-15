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
    'search.sidebar_placeholder': '快速搜尋...',
    'filter.title': '物種篩選',
    'filter.taxonomy': '物種分類層級',
    'filter.rarity': '瀕危等級與現狀',
    'filter.reset': '重置',
    'filter.clear_all': '清除所有篩選',
    'results.found': '找到',
    'results.unit': '項結果',
    'results.viewing_page': '正在查看第',
    'results.page_of': '頁，共',
    'sort.label': '排序方式',
    'sort.common_name': '俗名 (A-Z)',
    'sort.scientific_name': '學名 (A-Z)',
    'sort.rarity': '瀕危等級 (高級優先)',
    'pagination.page': '頁',
    'pagination.showing': '顯示',
    'pagination.of': '之中的',
    'pagination.species': '個物種',
    'empty.title': '找不到匹配的物種',
    'empty.subtitle': '請嘗試放寬篩選條件，或使用不同的搜尋字串進行檢索。',
    'view.per_page': '每頁顯示',
    'auth.login': '登入',
    'auth.logout': '登出',
    'view.display_mode': '顯示模式',
    'view.mode_detail': '詳情模式',
    'view.mode_photo': '照片模式',
    'view.mode_table': '表格模式',
    'table.order': '目',
    'table.family': '科',
    'table.genus': '屬',
    'table.scientific_name': '科學名',
    'table.common_name': '俗名',
    'table.native_status': '原生狀態',
    'table.iucn_status': 'IUCN 狀態',
    // 會員面板
    'account.title': '帳號設定',
    'account.tab_profile': '個人資料',
    'account.tab_bookmarks': '我的收藏',
    'account.member_since': '加入日期',
    'account.last_online': '最後上線時間',
    'account.email': '電子信箱',
    'account.username': '使用者名稱',
    'account.username_placeholder': '輸入英文、數字、空格、_ 或 -',
    'account.username_hint': '支援英文字母、數字、半形空格、_ 及 -',
    'account.username_available': '此名稱可使用',
    'account.username_taken': '此名稱已被使用',
    'account.username_invalid': '僅支援英文字母、數字、空格、_ 及 -',
    'account.username_too_short': '至少需要 3 個字元',
    'account.username_checking': '檢查中...',
    'account.save': '儲存變更',
    'account.saving': '儲存中...',
    'account.save_success': '已成功更新！',
    'account.save_error': '儲存失敗，請稍後再試',
    'account.back': '返回首頁',
    'account.not_logged_in': '請先登入以查看帳號設定',
    'account.bookmarks_empty': '您尚未收藏任何物種',
    'account.bookmarks_empty_hint': '在物種卡片上點擊心形圖示即可收藏',
    'account.remove_bookmark': '移除收藏',
    'account.header_link': '帳號設定',
    'account.profile_info': '帳號資訊',
    'nav.privacy': '隱私權政策',
    'nav.terms': '服務條款',
    'loading.message': '正在從雲端載入物種資料...',
    'loading.searching': '正在檢索自然數據庫，請稍候...',
    'dropdown.reset': '重設',
    'dropdown.apply': '套用',
    'dropdown.apply_selection': '確定選取',
    'dropdown.no_results': '找不到符合的分類',
    'dropdown.clear_search': '清除搜尋'
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
    'filter.title': 'Species Filter',
    'filter.taxonomy': 'Taxonomy Levels',
    'filter.rarity': 'IUCN Status & Status',
    'filter.reset': 'Reset',
    'filter.clear_all': 'Clear All Filters',
    'results.found': 'Found',
    'results.unit': 'Results',
    'results.viewing_page': 'Viewing Page',
    'results.page_of': 'of',
    'sort.label': 'Sort By',
    'sort.common_name': 'Common Name (A-Z)',
    'sort.scientific_name': 'Scientific Name (A-Z)',
    'sort.rarity': 'IUCN Status (High First)',
    'pagination.page': 'Page',
    'pagination.showing': 'Showing',
    'pagination.of': 'of',
    'pagination.species': 'Species',
    'empty.title': 'No Matching Species Found',
    'empty.subtitle': 'Try relaxing your filters or using different search terms.',
    'view.per_page': 'Per Page',
    'auth.login': 'Login',
    'auth.logout': 'Logout',
    'view.display_mode': 'Display Mode',
    'view.mode_detail': 'Detail Mode',
    'view.mode_photo': 'Photo Mode',
    'view.mode_table': 'Table Mode',
    'table.order': 'Order',
    'table.family': 'Family',
    'table.genus': 'Genus',
    'table.scientific_name': 'Scientific Name',
    'table.common_name': 'Common Name',
    'table.native_status': 'Native Status',
    'table.iucn_status': 'IUCN Status',
    // Account Panel
    'account.title': 'Account Settings',
    'account.tab_profile': 'Profile',
    'account.tab_bookmarks': 'My Bookmarks',
    'account.member_since': 'Member Since',
    'account.last_online': 'Last Online',
    'account.email': 'Email',
    'account.username': 'Username',
    'account.username_placeholder': 'Letters, numbers, spaces, _ or -',
    'account.username_hint': 'Letters, numbers, spaces, _ and - only',
    'account.username_available': 'Username is available',
    'account.username_taken': 'Username is already taken',
    'account.username_invalid': 'Letters, numbers, spaces, _ and - only',
    'account.username_too_short': 'At least 3 characters required',
    'account.username_checking': 'Checking...',
    'account.save': 'Save Changes',
    'account.saving': 'Saving...',
    'account.save_success': 'Updated successfully!',
    'account.save_error': 'Save failed, please try again',
    'account.back': 'Back to Home',
    'account.not_logged_in': 'Please log in to view account settings',
    'account.bookmarks_empty': 'No bookmarked species yet',
    'account.bookmarks_empty_hint': 'Tap the heart icon on a species card to bookmark it',
    'account.remove_bookmark': 'Remove Bookmark',
    'account.header_link': 'Account',
    'account.profile_info': 'Account Info',
    'nav.privacy': 'Privacy Policy',
    'nav.terms': 'Terms of Service',
    'loading.message': 'Loading species from the database...',
    'loading.searching': 'Exploring natural databases, please wait...',
    'dropdown.reset': 'Reset',
    'dropdown.apply': 'Apply',
    'dropdown.apply_selection': 'Apply Selection',
    'dropdown.no_results': 'No matching categories found',
    'dropdown.clear_search': 'Clear Search'
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
