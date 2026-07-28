'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronRight, ChevronDown, Sparkles, Loader2, Leaf, Bug, ArrowRight, CornerDownLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { SuggestionItem } from '@/app/api/species/suggest/route';
import { useInaturalistPhoto } from '@/hooks/useInaturalistPhoto';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';

// 關鍵字高亮渲染組件
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) => (
        regex.test(part) ? (
          <span key={i} className="text-emerald-600 font-extrabold bg-emerald-500/10 px-0.5 rounded">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      ))}
    </>
  );
}

// 建議物種頭像/縮圖組件 (動態獲取 iNaturalist 圖片)
function SuggestionItemAvatar({ item, isSelected }: { item: SuggestionItem; isSelected: boolean }) {
  const { imageUrl, isLoading } = useInaturalistPhoto(item.inat_id || undefined);
  const [imgError, setImgError] = useState(false);

  if (imageUrl && !imgError) {
    return (
      <div className={`w-10 h-10 md:w-11 md:h-11 rounded-2xl overflow-hidden shrink-0 border relative bg-slate-100 ${
        isSelected ? 'border-white/40 shadow-sm' : 'border-slate-100 shadow-sm'
      }`}>
        <img 
          src={imageUrl} 
          alt={item.common_name_chi || item.scientific_name}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
        />
      </div>
    );
  }

  return (
    <div className={`w-10 h-10 md:w-11 md:h-11 rounded-2xl flex items-center justify-center shrink-0 font-bold transition-colors ${
      isSelected 
        ? 'bg-white/20 text-white' 
        : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
    }`}>
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
      ) : item.taxa_group === 'FLORA' ? (
        <Leaf className="w-5 h-5" />
      ) : (
        <Bug className="w-5 h-5" />
      )}
    </div>
  );
}

export default function HomeHero() {
  const { language, t } = useLanguage();
  const router = useRouter();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'fauna' | 'flora'>('fauna');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  
  // Suggestions state
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLFormElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounced Suggestion Fetching
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSuggestLoading(false);
      return;
    }

    setIsSuggestLoading(true);
    setShowSuggestions(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/species/suggest?q=${encodeURIComponent(trimmed)}&type=${searchType}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions || []);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        console.error('Failed to fetch suggestions:', err);
        setSuggestions([]);
      } finally {
        setIsSuggestLoading(false);
        setSelectedIndex(-1);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, searchType]);

  // Click outside to dismiss dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTypeDropdown(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { addSpecies } = useSpeciesPanel();

  // Open species in Floating Panel AND navigate background to /database with keyword search
  const navigateToSpecies = useCallback((taxaId: string) => {
    setShowSuggestions(false);

    // 1. 儲存關鍵字搜尋條件於 sessionStorage
    const trimmed = searchQuery.trim();
    if (trimmed) {
      const payload = {
        q: trimmed,
        type: searchType
      };
      try {
        sessionStorage.setItem('hkbc_quick_search', JSON.stringify(payload));
      } catch (err) {
        console.error('Failed to save search payload', err);
      }
    }

    // 2. 切換背景頁面至 /database
    router.push('/database');

    // 3. 同時開啟浮動面板顯示選中的物種詳情
    addSpecies(taxaId);
  }, [searchQuery, searchType, router, addSpecies]);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // 如果有使用鍵盤選擇建議項目
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      navigateToSpecies(suggestions[selectedIndex].taxa_id);
      return;
    }

    if (!searchQuery.trim()) return;

    // 儲存於 sessionStorage 並前往資料庫
    const payload = {
      q: searchQuery.trim(),
      type: searchType
    };
    
    try {
      sessionStorage.setItem('hkbc_quick_search', JSON.stringify(payload));
    } catch (err) {
      console.error('Failed to save search payload', err);
    }
    
    setShowSuggestions(false);
    router.push('/database');
  };

  // 鍵盤導航處理 (ArrowUp, ArrowDown, Escape, Enter)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > -1 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  // 自動滾動選中的選項至可視區域
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  return (
    <section className="relative min-h-[85vh] flex items-center justify-center pt-20 z-30">
      {/* Background with Overlay */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-white z-10" />
        <img 
          src="https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?q=80&w=2574&auto=format&fit=crop" 
          alt="Nature Background"
          className="w-full h-full object-cover scale-105 animate-slow-zoom"
        />
      </div>

      <div className="container mx-auto px-6 relative z-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto"
        >
          <h1 className="flex flex-col gap-6 md:gap-10 drop-shadow-2xl">
            {language === 'zh' ? (
              <div className="flex flex-col items-center gap-2 md:gap-4">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.8 }}
                  className="flex flex-col md:flex-row items-center gap-x-6 gap-y-1"
                >
                  <span className="text-xl md:text-3xl font-light tracking-[0.4em] text-emerald-100/60 uppercase">探尋</span>
                  <span className="text-6xl md:text-8xl lg:text-[7.5rem] font-black tracking-tighter text-white leading-none">
                    山林<span className="text-emerald-400">海影</span>
                  </span>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                  className="flex flex-col md:flex-row items-center gap-x-6 gap-y-1"
                >
                  <span className="text-xl md:text-3xl font-light tracking-[0.4em] text-emerald-100/60 uppercase">共譜</span>
                  <span className="text-6xl md:text-8xl lg:text-[7.5rem] font-black tracking-tighter text-white leading-none">
                    自然<span className="text-emerald-400">誌銘</span>
                  </span>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.8 }}
                >
                  <div className="h-1 w-20 md:w-32 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent mt-8 md:mt-12" />
                </motion.div>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center px-4">
                <motion.span 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.8 }}
                  className="text-5xl md:text-8xl lg:text-[8.5rem] font-black tracking-tighter text-white leading-[0.85] mb-2"
                >
                  Tracing the <span className="text-emerald-400">wilds</span>
                </motion.span>
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                  className="flex flex-col items-center"
                >
                  <span className="text-2xl md:text-5xl lg:text-[3.8rem] font-medium tracking-tight text-emerald-100/90 leading-tight">
                    scripting the <span className="italic font-light text-white">life</span> of our lands.
                  </span>
                  <div className="h-1 w-20 md:w-32 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent mt-8 md:mt-12" />
                </motion.div>
              </div>
            )}
          </h1>

          {/* Search Bar Container */}
          <form 
            ref={searchContainerRef}
            onSubmit={handleSearch}
            className="relative max-w-3xl mx-auto group mt-16 md:mt-24 px-4"
          >
            <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full group-focus-within:bg-emerald-500/40 transition-all duration-700 pointer-events-none" />
            <div className="relative flex items-center bg-white/95 backdrop-blur-2xl rounded-[2.5rem] p-1 md:p-1.5 shadow-2xl shadow-slate-900/20 border border-white">
              
              {/* Type Dropdown */}
              <div className="relative shrink-0" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                  className="flex items-center gap-1.5 md:gap-2 px-3 md:px-6 py-3 md:py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-[2rem] transition-all font-black text-[10px] md:text-xs uppercase tracking-widest border border-slate-100"
                >
                  <span className="truncate max-w-[50px] md:max-w-none">
                    {searchType === 'fauna' ? t('home.fauna') : t('home.flora')}
                  </span>
                  <ChevronDown className={`w-3 h-3 md:w-4 md:h-4 transition-transform duration-300 ${showTypeDropdown ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showTypeDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full left-0 mt-2 w-40 md:w-48 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-50 p-2"
                    >
                      <button
                        type="button"
                        onClick={() => { setSearchType('fauna'); setShowTypeDropdown(false); }}
                        className={`w-full flex items-center gap-2 md:gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-2xl text-left transition-all ${searchType === 'fauna' ? 'bg-emerald-600 text-white font-black' : 'hover:bg-slate-50 text-slate-600 font-bold'}`}
                      >
                        <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${searchType === 'fauna' ? 'bg-white' : 'bg-emerald-50'}`} />
                        <span className="text-[11px] md:text-sm">{t('home.fauna')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSearchType('flora'); setShowTypeDropdown(false); }}
                        className={`w-full flex items-center gap-2 md:gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-2xl text-left transition-all ${searchType === 'flora' ? 'bg-emerald-600 text-white font-black' : 'hover:bg-slate-50 text-slate-600 font-bold'}`}
                      >
                        <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${searchType === 'flora' ? 'bg-white' : 'bg-emerald-50'}`} />
                        <span className="text-[11px] md:text-sm">{t('home.flora')}</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Minimal Divider */}
              <div className="w-px h-6 md:h-8 bg-slate-200 mx-1 md:mx-2" />

              {/* Input Area */}
              <div className="flex-1 flex items-center px-2 md:px-4 min-w-0">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => { if (searchQuery.trim()) setShowSuggestions(true); }}
                  onKeyDown={handleKeyDown}
                  placeholder={t('search.placeholder')}
                  className="w-full bg-transparent border-none outline-none text-slate-800 font-bold placeholder:text-slate-400 py-3 md:py-4 text-sm md:text-lg truncate"
                  suppressHydrationWarning
                />
                {isSuggestLoading && (
                  <Loader2 className="w-5 h-5 text-emerald-500 animate-spin shrink-0 ml-2" />
                )}
              </div>

              {/* Search Trigger*/}
              <button 
                type="submit"
                className="w-10 h-10 md:w-14 md:h-14 shrink-0 flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-200/40 hover:scale-105 active:scale-95 transition-all duration-300 mr-0.5 md:mr-1"
              >
                <Search className="w-4 h-4 md:w-6 h-6" />
              </button>
            </div>

            {/* Instant Search Suggestions Dropdown */}
            <AnimatePresence>
              {showSuggestions && searchQuery.trim().length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-4 right-4 mt-3 bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-50 text-left p-2 md:p-3"
                >
                  {/* Header info */}
                  <div className="flex items-center justify-between px-3 py-2 text-[11px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                      {t('search.suggestions_title')}
                    </span>
                    <span>
                      {searchType === 'fauna' ? t('home.fauna') : t('home.flora')}
                    </span>
                  </div>

                  {/* Loading Shimmer */}
                  {isSuggestLoading && suggestions.length === 0 && (
                    <div className="p-4 space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3 animate-pulse">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-4 bg-slate-100 rounded w-1/3" />
                            <div className="h-3 bg-slate-100 rounded w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* No Suggestions Found */}
                  {!isSuggestLoading && suggestions.length === 0 && (
                    <div className="py-8 px-4 text-center">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Search className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-700">{t('search.no_suggestions')}</p>
                      <p className="text-xs text-slate-400 mt-1">{t('search.press_enter')}</p>
                    </div>
                  )}

                  {/* Suggestions List */}
                  {suggestions.length > 0 && (
                    <div ref={listRef} className="max-h-[340px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                      {suggestions.map((item, index) => {
                        const isSelected = index === selectedIndex;
                        const mainName = language === 'zh' 
                          ? (item.common_name_chi || item.scientific_name)
                          : (item.common_name_eng || item.scientific_name);
                        
                        const subName = language === 'zh'
                          ? (item.common_name_eng ? `${item.common_name_eng} · ` : '') + item.scientific_name
                          : item.common_name_chi ? `${item.common_name_chi} · ${item.scientific_name}` : item.scientific_name;

                        return (
                          <div
                            key={item.taxa_id || index}
                            onClick={() => navigateToSpecies(item.taxa_id)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={`flex items-center justify-between p-2.5 md:p-3 rounded-2xl cursor-pointer transition-all duration-200 group ${
                              isSelected 
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 translate-x-1' 
                                : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {/* Avatar / iNaturalist Photo */}
                              <SuggestionItemAvatar item={item} isSelected={isSelected} />

                              {/* Names & Category */}
                              <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={`font-black text-sm md:text-base truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                                    <HighlightText text={mainName} query={searchQuery} />
                                  </span>
                                  
                                  {/* Badge */}
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                    isSelected 
                                      ? 'bg-white/20 text-emerald-100' 
                                      : 'bg-slate-100 text-slate-500'
                                  }`}>
                                    {item.category || item.taxa_group}
                                  </span>
                                </div>

                                <span className={`text-xs truncate italic ${isSelected ? 'text-emerald-100/90' : 'text-slate-400'}`}>
                                  <HighlightText text={subName} query={searchQuery} />
                                </span>
                              </div>
                            </div>

                            {/* Arrow Indicator */}
                            <div className={`shrink-0 ml-2 p-1.5 rounded-xl transition-all ${
                              isSelected ? 'text-white bg-white/10' : 'text-slate-300 group-hover:text-emerald-600 group-hover:bg-emerald-50'
                            }`}>
                              <ArrowRight className="w-4 h-4" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* View All / Enter Footer */}
                  <div 
                    onClick={() => handleSearch()}
                    className="mt-2 pt-2 border-t border-slate-100 px-3 py-2.5 flex items-center justify-between rounded-xl hover:bg-slate-100/70 text-slate-600 cursor-pointer transition-colors"
                  >
                    <span className="text-xs font-bold flex items-center gap-1.5 text-emerald-600">
                      <Search className="w-3.5 h-3.5" />
                      {t('search.view_all')} &quot;<span className="font-extrabold underline">{searchQuery.trim()}</span>&quot;
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md">
                      <CornerDownLeft className="w-3 h-3" /> Enter
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </motion.div>
      </div>

      <style jsx global>{`
        @keyframes slow-zoom {
          from { transform: scale(1); }
          to { transform: scale(1.1); }
        }
        .animate-slow-zoom {
          animation: slow-zoom 20s ease-in-out infinite alternate;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(16, 185, 129, 0.5);
        }
      `}</style>
    </section>
  );
}
