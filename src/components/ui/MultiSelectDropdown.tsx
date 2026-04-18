'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Check, X, Filter, RotateCcw } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../context/LanguageContext';

interface Option {
  name: string;
  display: string;
  count: number;
}

interface MultiSelectDropdownProps {
  label: string;
  options: Option[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export default function MultiSelectDropdown({
  label,
  options,
  selectedValues,
  onChange,
  placeholder,
}: MultiSelectDropdownProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileView, setIsMobileView] = useState(false);
  const [localSelected, setLocalSelected] = useState<string[]>(selectedValues);
  
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

  // 偵測是否為行動端 (調整閾值至 768px 以優化 Tablet 體驗)
  useEffect(() => {
    const checkMobile = () => setIsMobileView(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 點擊外部關閉
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen && !isMobileView) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isMobileView]);

  // 自動聚焦 (僅限桌面端)
  useEffect(() => {
    if (isOpen && inputRef.current && !isMobileView) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMobileView]);

  const filteredOptions = useMemo(() => {
    return options.filter(opt => 
      opt.display.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opt.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  const handleApply = () => {
    onChange(localSelected);
    setIsOpen(false);
  };

  const handleReset = () => {
    setLocalSelected([]);
    setSearchTerm('');
    onChange([]); // 立即觸發父組件同步，以便更新 options 統計
  };

  const toggleOption = (name: string) => {
    setLocalSelected(prev => 
      prev.includes(name) ? prev.filter(v => v !== name) : [...prev, name]
    );
  };

  const selectedCount = selectedValues.length;
  const localCount = localSelected.length;
  const displayPlaceholder = placeholder || t('search.sidebar_placeholder');

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* 觸發按鈕 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-3 rounded-2xl text-sm font-bold transition-all border group ${
          isOpen || selectedCount > 0 
            ? 'bg-white border-emerald-200 shadow-xl shadow-emerald-50/50 ring-4 ring-emerald-50/30' 
            : 'bg-slate-50/50 border-slate-100 text-slate-600 hover:bg-white hover:border-emerald-100'
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
          <span className="truncate">{label}</span>
          {selectedCount > 0 && (
            <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[10px] rounded-md shrink-0">
              {selectedCount}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-emerald-600' : 'group-hover:text-slate-600'}`} />
      </button>

      {/* 桌面端下拉內容 */}
      {isOpen && !isMobileView && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-[240px] bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-200 overflow-hidden outline-none">
          <div className="p-3 border-b border-slate-50 flex items-center bg-emerald-50/30">
            <Search className="w-4 h-4 text-slate-400 ml-1 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder={displayPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium placeholder:text-slate-400 text-emerald-900 ml-2 py-1 outline-none"
            />
          </div>
          
          <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 p-1.5 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs font-medium">
                {t('dropdown.no_results')}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = localSelected.includes(opt.name);
                return (
                  <button
                    key={opt.name}
                    onClick={() => toggleOption(opt.name)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-left group/item ${
                      isSelected 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-emerald-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-transparent group-hover/item:border-emerald-300'}`}>
                        <Check className="w-3 h-3" />
                      </div>
                      <span className={`text-xs font-bold truncate ${isSelected ? 'text-emerald-700' : 'text-slate-700'}`}>
                        {opt.display}
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold shrink-0 ${isSelected ? 'text-emerald-600/70' : 'text-slate-400'}`}>
                      ({opt.count})
                    </span>
                  </button>
                );
              })
            )}
          </div>
          
          {/* 桌面端操作欄 */}
          <div className="p-2 border-t border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <button 
              onClick={handleReset}
              className="flex-1 py-2 px-3 flex items-center justify-center gap-1.5 rounded-xl text-[10px] font-bold text-slate-400 hover:text-emerald-600 hover:bg-white transition-all border border-transparent hover:border-emerald-100"
            >
              <RotateCcw className="w-3 h-3" />
              {t('dropdown.reset')}
            </button>
            <button 
              onClick={handleApply}
              className="flex-[2] py-2 px-3 bg-emerald-900 text-white rounded-xl text-[10px] font-black hover:bg-emerald-800 transition-colors shadow-lg shadow-emerald-900/10 active:scale-95"
            >
              {t('dropdown.apply')} {localCount > 0 ? `(${localCount})` : ''}
            </button>
          </div>
        </div>
      )}

      {/* 行動端選取器 - 使用 Portal 直接渲染 */}
      {isOpen && isMobileView && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] bg-white animate-in slide-in-from-bottom duration-300 flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-emerald-900 text-white shadow-xl shadow-emerald-900/10">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <h3 className="font-black text-lg flex items-center gap-2">
                <Filter className="w-5 h-5 text-emerald-400" />
                {label}
              </h3>
            </div>
            <button 
              onClick={handleReset}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border border-white/10"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('dropdown.reset')}
            </button>
          </div>
          
          <div className="p-4 bg-emerald-50/50">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
              <input
                ref={inputRef}
                type="text"
                placeholder={displayPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-emerald-100 rounded-2xl focus:border-emerald-500 outline-none shadow-sm text-emerald-900 placeholder:text-slate-400 transition-all font-medium"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-32">
            {filteredOptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                <Search className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-bold">{t('dropdown.no_results')}</p>
                <button onClick={() => setSearchTerm('')} className="mt-2 text-emerald-600 text-sm font-bold underline decoration-2 underline-offset-4">
                  {t('dropdown.clear_search')}
                </button>
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = localSelected.includes(opt.name);
                return (
                  <button
                    key={opt.name}
                    onClick={() => toggleOption(opt.name)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border ${
                      isSelected 
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg scale-[1.02]' 
                        : 'bg-white border-slate-100 text-slate-700 active:bg-emerald-50 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-white border-white text-emerald-600' : 'bg-slate-100 border-slate-200 text-transparent'}`}>
                        <Check className="w-4 h-4 stroke-[3px]" />
                      </div>
                      <span className="font-black tracking-tight">{opt.display}</span>
                    </div>
                    <span className={`text-sm font-bold ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
                      ({opt.count})
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* 行動端底部固定操作欄 */}
          <div className="fixed bottom-0 left-0 right-0 p-4 pb-8 bg-white/80 backdrop-blur-xl border-t border-slate-100 flex flex-col gap-3 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
            <button 
              onClick={handleApply}
              className="w-full py-4 bg-emerald-900 text-white rounded-2xl font-black text-lg shadow-2xl shadow-emerald-900/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {t('dropdown.apply_selection')} {localCount > 0 ? `(${localCount})` : ''}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
