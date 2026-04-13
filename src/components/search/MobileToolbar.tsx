'use client';

import { useState, useEffect } from 'react';
import { List, LayoutGrid, Table as TableIcon, ArrowUpDown, Layers, Filter } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface MobileToolbarProps {
  sortBy: string;
  onSortChange: (val: string) => void;
  itemsPerPage: number;
  onItemsPerPageChange: (val: number) => void;
  displayMode: 'detail' | 'photo' | 'table';
  onDisplayModeChange: (val: 'detail' | 'photo' | 'table') => void;
  pageSizeOptions: number[];
  totalCount: number;
}

export default function MobileToolbar({
  sortBy,
  onSortChange,
  itemsPerPage,
  onItemsPerPageChange,
  displayMode,
  onDisplayModeChange,
  pageSizeOptions,
  totalCount
}: MobileToolbarProps) {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const controlNavbar = () => {
      const currentScrollY = window.scrollY;
      
      // 向下捲動超過 50px 才隱藏，且目前位置必須大於去年位置
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', controlNavbar);
    return () => {
      window.removeEventListener('scroll', controlNavbar);
    };
  }, [lastScrollY]);

  return (
    <div className={`
      fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-in-out md:hidden
      w-[92%] max-w-[400px]
      ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'}
    `}>
      <div className="bg-white/80 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-[2rem] p-2 flex flex-col gap-2">
        
        {/* Row 1: Sort & View Mode */}
        <div className="flex items-center gap-2">
          {/* Sorting Area */}
          <div className="flex-1 flex items-center bg-slate-900/5 rounded-2xl p-0.5 min-w-0">
            <div className="pl-3 pr-1 text-slate-400">
              <ArrowUpDown className="w-3 h-3" />
            </div>
            <div className="flex overflow-x-auto no-scrollbar py-0.5">
              {[
                { value: 'common_name', label: t('sort.common_name') },
                { value: 'scientific_name', label: t('sort.scientific_name') },
                { value: 'rarity', label: t('sort.rarity') }
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onSortChange(opt.value)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all ${
                    sortBy === opt.value 
                      ? 'bg-white text-emerald-600 shadow-sm border border-slate-100' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode Switching Area */}
          <div className="flex items-center bg-slate-900/5 rounded-2xl p-0.5 shrink-0">
            {[
              { id: 'detail', icon: List },
              { id: 'photo', icon: LayoutGrid },
              { id: 'table', icon: TableIcon }
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => onDisplayModeChange(mode.id as any)}
                className={`p-2 rounded-xl transition-all ${
                  displayMode === mode.id 
                    ? 'bg-white text-emerald-600 shadow-sm border border-slate-100' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <mode.icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Page Size & Results Count */}
        <div className="flex items-center gap-2">
          {/* Page Size Chips */}
          <div className="flex-1 flex items-center bg-emerald-600/5 rounded-2xl p-0.5 min-w-0">
            <div className="pl-3 pr-1 text-emerald-600/50">
              <Layers className="w-3 h-3" />
            </div>
            <div className="flex overflow-x-auto no-scrollbar py-0.5">
              {pageSizeOptions.map((size) => (
                <button
                  key={size}
                  onClick={() => onItemsPerPageChange(size)}
                  className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black transition-all ${
                    itemsPerPage === size 
                      ? 'bg-emerald-600 text-white shadow-sm' 
                      : 'text-emerald-700/60 hover:text-emerald-700'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Result Count - Distinctive badge */}
          <div className="bg-slate-900 group active:scale-95 transition-all text-white px-4 py-2 rounded-2xl flex items-center gap-2 shadow-lg shadow-slate-200">
            <span className="text-[10px] font-black tracking-widest uppercase">
              {totalCount} {t('results.unit')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
