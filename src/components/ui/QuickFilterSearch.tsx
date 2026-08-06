'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, RotateCcw, Sparkles, Loader2, Leaf, Bug, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { SuggestionItem } from '@/app/api/species/suggest/route';
import { useInaturalistPhoto } from '@/hooks/useInaturalistPhoto';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';

interface QuickFilterSearchProps {
  initialValue?: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onClear?: () => void;
  className?: string;
  taxaType?: 'fauna' | 'flora' | 'all';
}

import { HighlightText } from '@/utils/formatters';

// 建議物種頭像/縮圖組件
function SuggestionItemAvatar({ item, isSelected }: { item: SuggestionItem; isSelected: boolean }) {
  const { imageUrl, isLoading } = useInaturalistPhoto(item.inat_id || undefined);
  const [imgError, setImgError] = useState(false);

  if (imageUrl && !imgError) {
    return (
      <div className={`w-9 h-9 rounded-xl overflow-hidden shrink-0 border relative bg-slate-100 ${
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
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold transition-colors ${
      isSelected 
        ? 'bg-white/20 text-white' 
        : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
    }`}>
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
      ) : item.taxa_group === 'FLORA' ? (
        <Leaf className="w-4 h-4" />
      ) : (
        <Bug className="w-4 h-4" />
      )}
    </div>
  );
}

export default function QuickFilterSearch({
  initialValue = '',
  placeholder,
  onSubmit,
  onClear,
  className = '',
  taxaType = 'all'
}: QuickFilterSearchProps) {
  const { language, t } = useLanguage();
  const { isAuthorized, requireAuth } = useAuth();
  const { addSpecies, setIsFilterOpen, skipNextAutoCollapse } = useSpeciesPanel();
  const [localValue, setLocalValue] = useState(initialValue);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync with initialValue (e.g. when filters are reset globally)
  useEffect(() => {
    setLocalValue(initialValue);
  }, [initialValue]);

  // Debounced Suggestion Fetching (限制：必須已登入且帳號 status 為 active 才會抓取建議)
  useEffect(() => {
    const trimmed = localValue.trim();
    if (!trimmed || !isAuthorized) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSuggestLoading(false);
      return;
    }

    setIsSuggestLoading(true);
    setShowSuggestions(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/species/suggest?q=${encodeURIComponent(trimmed)}&type=${taxaType}&limit=6`);
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
  }, [localValue, taxaType, isAuthorized]);

  // Click outside to dismiss dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSpecies = (item: SuggestionItem) => {
    if (!requireAuth(undefined, 'Quick Search 快速搜尋')) {
      setShowSuggestions(false);
      return;
    }

    setShowSuggestions(false);
    const selectedName = (language === 'zh' 
      ? (item.common_name_chi || item.scientific_name)
      : (item.common_name_eng || item.scientific_name)) || localValue;

    setLocalValue(selectedName);
    onSubmit(selectedName);
    skipNextAutoCollapse();
    addSpecies(item.taxa_id);

    // 在行動版模式 (<= 1100px)，點選建議物種後自動收合側邊欄
    if (typeof window !== 'undefined' && window.innerWidth <= 1100) {
      setIsFilterOpen(false);
    }
  };

  const handleSubmit = () => {
    if (!requireAuth(undefined, 'Quick Search 快速搜尋')) {
      setShowSuggestions(false);
      return;
    }

    setShowSuggestions(false);
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      handleSelectSpecies(suggestions[selectedIndex]);
      return;
    }
    onSubmit(localValue.trim());
  };

  const handleReset = () => {
    setLocalValue('');
    setShowSuggestions(false);
    if (onClear) {
      onClear();
    } else {
      onSubmit('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) {
      if (e.key === 'Enter') handleSubmit();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > -1 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div ref={containerRef} className={`relative group flex items-center ${className}`}>
      <button 
        type="button"
        onClick={handleSubmit}
        className="absolute left-2 p-2.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all active:scale-95 z-10"
        title={language === 'zh' ? '搜尋' : 'Search'}
      >
        <Search className="w-5 h-5 group-focus-within:text-emerald-500" />
      </button>
      
      <input 
        type="text" 
        placeholder={placeholder || (language === 'zh' ? '快速搜尋...' : 'Quick search...')} 
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={() => {
          if (!requireAuth(undefined, 'Quick Search 快速搜尋')) return;
          if (localValue.trim()) setShowSuggestions(true);
        }}
        onKeyDown={handleKeyDown}
        suppressHydrationWarning={true}
        className="w-full pl-12 pr-12 py-4 bg-emerald-50/30 border-2 border-transparent rounded-2xl text-emerald-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50/50 transition-all outline-none text-sm"
      />

      {isSuggestLoading && (
        <Loader2 className="absolute right-10 w-4 h-4 text-emerald-500 animate-spin z-10" />
      )}

      {localValue && (
        <button
          type="button"
          onClick={handleReset}
          className="absolute right-2 p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-95 z-10"
          title={language === 'zh' ? '重設搜尋' : 'Reset Search'}
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      )}

      {/* Suggestion Dropdown Overlay */}
      <AnimatePresence>
        {showSuggestions && localValue.trim().length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 text-left p-2"
          >
            {/* Header info */}
            <div className="flex items-center justify-between px-2.5 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-500" />
                {t('search.suggestions_title')}
              </span>
              <span>
                {taxaType === 'flora' ? t('home.flora') : taxaType === 'fauna' ? t('home.fauna') : ''}
              </span>
            </div>

            {/* Loading Shimmer */}
            {isSuggestLoading && suggestions.length === 0 && (
              <div className="p-3 space-y-2.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2.5 animate-pulse">
                    <div className="w-9 h-9 bg-slate-100 rounded-xl" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-slate-100 rounded w-1/3" />
                      <div className="h-2.5 bg-slate-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* No Suggestions Found */}
            {!isSuggestLoading && suggestions.length === 0 && (
              <div className="py-6 px-3 text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Search className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-700">{t('search.no_suggestions')}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{t('search.press_enter')}</p>
              </div>
            )}

            {/* Suggestions List */}
            {suggestions.length > 0 && (
              <div ref={listRef} className="max-h-[280px] overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
                {suggestions.map((item, index) => {
                  const isSelected = index === selectedIndex;
                  const mainName = item.scientific_name;
                  const subName = language === 'zh' 
                    ? [item.common_name_chi, item.common_name_eng].filter(Boolean).join(' · ')
                    : [item.common_name_eng, item.common_name_chi].filter(Boolean).join(' · ');

                  return (
                    <div
                      key={item.taxa_id || index}
                      onClick={() => handleSelectSpecies(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all duration-200 group ${
                        isSelected 
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 translate-x-0.5' 
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Avatar */}
                        <SuggestionItemAvatar item={item} isSelected={isSelected} />

                        {/* Names */}
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className={`font-black text-xs md:text-sm truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                            <HighlightText text={mainName} query={localValue} isSelected={isSelected} isScientific={true} />
                          </span>

                          {subName && (
                            <span className={`text-[11px] truncate ${isSelected ? 'text-emerald-100/90' : 'text-slate-400'}`}>
                              <HighlightText text={subName} query={localValue} isSelected={isSelected} />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
