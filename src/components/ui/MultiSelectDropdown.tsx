'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Check, X, Filter, RotateCcw } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { formatScientificName } from '../../utils/formatters';

interface Option {
  name: string;
  display: string;
  count?: number;
}

interface MultiSelectDropdownProps {
  label: string;
  options: Option[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  align?: 'left' | 'right';
  minWidth?: string;
  variant?: 'default' | 'minimal';
  inferredValue?: string;
  getDisplayLabel?: (val: string) => string;
}

export default function MultiSelectDropdown({
  label,
  options,
  selectedValues,
  onChange,
  placeholder,
  align = 'left',
  minWidth = '240px',
  variant = 'default',
  inferredValue,
  getDisplayLabel,
}: MultiSelectDropdownProps) {
  const { language, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileView, setIsMobileView] = useState(false);
  const [localSelected, setLocalSelected] = useState<string[]>(selectedValues);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 當外部 selectedValues 改變時同步（例如重設篩選）
  useEffect(() => {
    setLocalSelected(selectedValues);
  }, [selectedValues]);

  // 開啟選單時確保本地狀態與外部同步
  useEffect(() => {
    if (isOpen) {
      setLocalSelected(selectedValues);
    }
  }, [isOpen, selectedValues]);

  // 偵測是否為行動端
  useEffect(() => {
    const checkMobile = () => setIsMobileView(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 更新位置邏輯
  const updatePosition = () => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  // 點擊外部關閉與位置更新
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        // 也要檢查是否點擊在 Portal 內容上 (透過 z-index 和 fixed 定位通常沒問題，但保險起見)
        const portalElements = document.querySelectorAll('.dropdown-portal-content');
        let clickedInsidePortal = false;
        portalElements.forEach(el => {
          if (el.contains(event.target as Node)) clickedInsidePortal = true;
        });
        
        if (!clickedInsidePortal) {
          setIsOpen(false);
        }
      }
    };

    if (isOpen && !isMobileView) {
      updatePosition();
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, isMobileView]);

  // 自動聚焦 (僅限桌面端)
  useEffect(() => {
    if (isOpen && inputRef.current && !isMobileView) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMobileView]);

  const filteredOptions = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return options.filter(opt => {
      const display = (opt.display || '').toLowerCase();
      const name = (opt.name || '').toLowerCase();
      return display.includes(search) || name.includes(search);
    });
  }, [options, searchTerm]);

  const handleApply = () => {
    onChange(localSelected);
    setIsOpen(false);
  };

  const toggleOption = (name: string) => {
    setLocalSelected(prev => 
      prev.includes(name) ? prev.filter(v => v !== name) : [...prev, name]
    );
  };

  const toggleAll = () => {
    if (localSelected.length === options.length) {
      setLocalSelected([]);
    } else {
      setLocalSelected(options.map(o => o.name));
    }
  };

  const handleReset = () => {
    setLocalSelected([]);
    onChange([]);
    setIsOpen(false);
  };

  const selectedCount = selectedValues.length;
  const localCount = localSelected.length;
  const isAllSelected = localSelected.length === options.length && options.length > 0;
  const isSomeSelected = localSelected.length > 0 && localSelected.length < options.length;
  const displayPlaceholder = placeholder !== undefined ? placeholder : t('search.sidebar_placeholder');

  const hasInferred = selectedCount === 0 && !!inferredValue;
  const hasActiveSelection = selectedCount > 0 || hasInferred;

  const triggerLabel = useMemo(() => {
    if (selectedCount === 0) {
      if (inferredValue) return inferredValue;
      return displayPlaceholder;
    }
    
    // 如果選取數量 <= 3（或列表選項數量 <= 5），直接列出選取的名稱（如「鞘翅目, 鱗翅目」），而非顯示「全部」
    if (selectedCount <= 3 || options.length <= 5) {
      const matchedMap = new Map(options.map(o => [o.name, o.display]));
      const displayNames = selectedValues.map(val => {
        const found = matchedMap.get(val);
        if (found) return found;
        if (getDisplayLabel) return getDisplayLabel(val);
        return val;
      });
      if (displayNames.length > 0) {
        return displayNames.join(', ');
      }
    }

    if (options.length > 0 && selectedValues.length >= options.length) {
      return language === 'zh' ? "全部" : "All";
    }
    
    return `${selectedCount} ${language === 'zh' ? (t('filter.selected') || '項') : 'items'}`;
  }, [selectedCount, options, selectedValues, displayPlaceholder, inferredValue, getDisplayLabel, t, language]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* 觸發按鈕 */}
      <button
        onClick={() => {
          if (!isOpen) updatePosition();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center justify-between transition-all group tracking-wide ${
          variant === 'minimal'
            ? `px-1 py-0.5 rounded-md hover:bg-slate-100/50 ${hasActiveSelection ? 'text-emerald-600' : 'text-slate-300'}`
            : `w-full px-3 py-1.5 rounded-xl text-[11px] font-black border ${
                isOpen || hasActiveSelection
                  ? 'bg-white border-emerald-200 shadow-xl shadow-emerald-50/50 ring-4 ring-emerald-50/30' 
                  : 'bg-slate-50/50 border-slate-100 text-slate-400 hover:bg-white hover:border-emerald-100'
              }`
        }`}
      >
        <div className="flex items-center gap-1.5 overflow-hidden">
          <Filter className={`${variant === 'minimal' ? 'w-3 h-3' : 'w-3 h-3'} shrink-0 ${hasActiveSelection ? 'text-emerald-500' : 'text-slate-300'}`} />
          {variant !== 'minimal' && (
            <span className={`truncate text-[11px] font-black ${hasActiveSelection ? 'text-emerald-800' : ''}`}>{triggerLabel}</span>
          )}
          {variant === 'minimal' && selectedCount > 0 && (
            <span className="text-[10px] font-black">{selectedCount}</span>
          )}
        </div>
        <ChevronDown className={`w-2.5 h-2.5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-emerald-600' : 'group-hover:text-slate-600'}`} />
      </button>

      {/* 桌面端下拉內容 - 使用 Portal + Framer Motion */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && !isMobileView && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={`fixed bg-white border border-slate-100 rounded-2xl shadow-2xl z-[9999] overflow-hidden outline-none dropdown-portal-content ${align === 'right' ? 'origin-top-right' : 'origin-top-left'}`}
              style={{ 
                top: coords.top - window.scrollY + 8,
                left: align === 'right' ? (coords.left + coords.width) : coords.left,
                x: align === 'right' ? '-100%' : '0%',
                minWidth,
                pointerEvents: 'auto'
              }}
            >
              {/* 搜尋欄 */}
              <div className="p-3 border-b border-slate-50 flex items-center bg-slate-50/30">
                <Search className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={displayPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-0 text-[11px] font-bold placeholder:text-slate-400 text-emerald-900 ml-2 py-1 outline-none"
                />
              </div>

              {/* 全選欄 */}
              <div className="px-3 py-2 border-b border-slate-50 flex items-center justify-between">
                <button 
                  onClick={toggleAll}
                  className="flex items-center gap-2 group/all"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${isAllSelected ? 'bg-emerald-600 border-emerald-600 text-white' : isSomeSelected ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white border-slate-200 group-hover/all:border-emerald-300'}`}>
                    {isAllSelected ? <Check className="w-3 h-3 stroke-[3px]" /> : isSomeSelected ? <div className="w-2 h-0.5 bg-emerald-600 rounded-full" /> : null}
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover/all:text-emerald-700">{language === 'zh' ? '全選' : 'All'}</span>
                </button>
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{filteredOptions.length} {language === 'zh' ? '個項目' : 'items'}</span>
              </div>
              
              <div className="max-h-[260px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 p-1.5 space-y-0.5">
                {filteredOptions.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    {t('dropdown.no_results')}
                  </div>
                ) : (
                  <>
                    {filteredOptions.slice(0, 500).map((opt) => {
                      const isSelected = localSelected.includes(opt.name);
                      const isScientific = label.toLowerCase().includes('scientific name') || label.includes('學名');
                      const displayLabel = isScientific ? formatScientificName(opt.display) : opt.display;
                      return (
                        <button
                          key={opt.name}
                          onClick={() => toggleOption(opt.name)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-left group/item ${
                            isSelected 
                              ? 'bg-emerald-50/50 text-emerald-700' 
                              : 'text-slate-600 hover:bg-slate-50 hover:text-emerald-900'
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-transparent group-hover/item:border-emerald-300'}`}>
                              <Check className="w-3 h-3 stroke-[3px]" />
                            </div>
                            <span className={`text-xs font-bold truncate ${isSelected ? 'text-emerald-700' : 'text-slate-700'}`}>
                              {displayLabel}
                            </span>
                          </div>
                          <span className={`text-[9px] font-bold shrink-0 ${isSelected ? 'text-emerald-600/70' : 'text-slate-300'}`}>
                            {opt.count}
                          </span>
                        </button>
                      );
                    })}
                    {filteredOptions.length > 500 && (
                      <div className="text-center py-2 bg-slate-50/50 rounded-lg mt-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic px-2">
                          {language === 'zh' 
                            ? '僅顯示前 500 個項目，請透過搜尋縮細範圍' 
                            : 'Showing top 500 items only. Use search to refine.'}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {/* 操作按鈕 */}
              <div className="p-3 border-t border-slate-50 bg-slate-50/30 flex items-center gap-2">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-2 text-[10px] font-black text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest"
                >
                  {language === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button 
                  onClick={handleReset}
                  className="p-2 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all group/reset"
                  title={language === 'zh' ? '重設' : 'Reset'}
                >
                  <RotateCcw className="w-4 h-4 group-active/reset:rotate-[-180deg] transition-transform duration-500" />
                </button>
                <button 
                  onClick={handleApply}
                  className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 uppercase tracking-widest active:scale-95"
                >
                  {language === 'zh' ? '確定' : 'OK'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}


      {/* 行動端選取器 */}
      {isOpen && isMobileView && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[1000] bg-white animate-in slide-in-from-bottom duration-300 flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white text-slate-900">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 -ml-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
              <h3 className="font-black text-sm uppercase tracking-[0.2em]">{label}</h3>
            </div>
            <button 
              onClick={toggleAll}
              className="px-3 py-2 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-100"
            >
              {isAllSelected 
                ? (language === 'zh' ? '取消全選' : 'Deselect All') 
                : (language === 'zh' ? '全選' : 'Select All')}
            </button>
            <button 
              onClick={handleReset}
              className="px-3 py-2 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-600 border border-emerald-100 ml-2"
            >
              {language === 'zh' ? '重設' : 'Reset'}
            </button>
          </div>
          
          <div className="p-4 bg-slate-50/50">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
              <input
                ref={inputRef}
                type="text"
                placeholder={language === 'zh' ? "搜尋項目..." : "Search items..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:border-emerald-500 outline-none shadow-sm text-sm font-bold placeholder:text-slate-300"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-32">
            {filteredOptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                <Search className="w-12 h-12 mb-4 opacity-10" />
                <p className="font-black text-xs uppercase tracking-widest">
                  {language === 'zh' ? '找不到結果' : 'No results found'}
                </p>
              </div>
            ) : (
              <>
                {filteredOptions.slice(0, 500).map((opt) => {
                  const isSelected = localSelected.includes(opt.name);
                  const isScientific = label.toLowerCase().includes('scientific name') || label.includes('學名');
                  const displayValue = isScientific ? formatScientificName(opt.display) : opt.display;
                  return (
                    <button
                      key={opt.name}
                      onClick={() => toggleOption(opt.name)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border-2 ${
                        isSelected 
                          ? 'bg-emerald-50 border-emerald-600' 
                          : 'bg-white border-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-transparent'}`}>
                          <Check className="w-4 h-4 stroke-[3px]" />
                        </div>
                        <span className={`font-black text-sm ${isSelected ? 'text-emerald-900' : 'text-slate-700'}`}>{displayValue}</span>
                      </div>
                      <span className={`text-[10px] font-bold ${isSelected ? 'text-emerald-600/70' : 'text-slate-300'}`}>
                        {opt.count} {language === 'zh' ? '個結果' : 'results'}
                      </span>
                    </button>
                  );
                })}
                {filteredOptions.length > 500 && (
                  <div className="text-center py-4 bg-slate-50 rounded-2xl mt-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic px-4">
                      {language === 'zh' 
                        ? '僅顯示前 500 個項目，請利用搜尋縮小範圍' 
                        : 'Showing top 500 items only. Use search to refine.'}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 pb-10 bg-white border-t border-slate-100 flex items-center gap-3 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
            <button 
              onClick={() => setIsOpen(false)}
              className="flex-1 py-4 text-xs font-black text-slate-400 uppercase tracking-widest"
            >
              {language === 'zh' ? '取消' : 'Cancel'}
            </button>
            <button 
              onClick={handleApply}
              className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-emerald-600/20 active:scale-[0.98] transition-all"
            >
              {language === 'zh' ? `套用所選 (${localCount})` : `Apply Selection (${localCount})`}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
