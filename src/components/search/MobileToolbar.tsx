'use client';

import { useState, useEffect } from 'react';
import { List, LayoutGrid, Table as TableIcon, ArrowUpDown, Layers } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';

interface MobileToolbarProps {
  sortBy: string;
  onSortChange: (val: string) => void;
  itemsPerPage: number;
  onItemsPerPageChange: (val: number) => void;
  displayMode: 'detail' | 'photo' | 'table';
  onDisplayModeChange: (val: 'detail' | 'photo' | 'table') => void;
  pageSizeOptions: number[];
  totalCount: number;
  onFilterOpen: () => void;
}

export default function MobileToolbar({
  sortBy,
  onSortChange,
  itemsPerPage,
  onItemsPerPageChange,
  displayMode,
  onDisplayModeChange,
  pageSizeOptions,
  totalCount,
  onFilterOpen
}: MobileToolbarProps) {
  const { t } = useLanguage();
  const { openSpeciesIds, isExpanded } = useSpeciesPanel();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const hasActiveTabs = openSpeciesIds.length > 0;
  const shouldHideDueToPanel = hasActiveTabs && isExpanded;

  useEffect(() => {
    const controlNavbar = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener('scroll', controlNavbar);
    return () => window.removeEventListener('scroll', controlNavbar);
  }, [lastScrollY]);

  const sortOptions = [
    { value: 'common_name', label: t('sort.common_name').split('(')[0].trim() },
    { value: 'scientific_name', label: t('sort.scientific_name').split('(')[0].trim() },
    { value: 'rarity', label: t('sort.rarity').split('(')[0].trim() }
  ];

  return (
    <div className={`
      fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-in-out md:hidden
      w-[94%] max-w-[400px]
      ${hasActiveTabs ? 'bottom-[80px]' : 'bottom-6'}
      ${isVisible && !shouldHideDueToPanel ? 'translate-y-0 opacity-100' : 'translate-y-32 opacity-0 pointer-events-none'}
    `}>
      <div className="bg-white/90 backdrop-blur-3xl border border-white/50 shadow-[0_20px_50px_rgba(0,0,0,0.2)] rounded-[1.75rem] p-3 flex flex-col gap-3">
        
        {/* Row 0: Prominent Filter Button for Mobile */}
        <button 
          onClick={onFilterOpen}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-3 flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-200 active:scale-95 transition-all"
        >
          <Layers className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-[0.2em]">{t?.('filter.title') || 'Filter & Search'}</span>
        </button>
        
        {/* Row 1: Sort (Left) & Mode (Right) */}
        <div className="flex items-center justify-between gap-2 overflow-hidden">
          {/* Sorting Control */}
          <div className="flex flex-1 items-center bg-slate-100/80 rounded-2xl p-1 gap-1 overflow-hidden h-[38px]">
            <div className="pl-2 pr-1 text-slate-400 shrink-0">
              <ArrowUpDown className="w-3 h-3" />
            </div>
            <div className="flex gap-1 overflow-x-auto no-scrollbar scroll-smooth items-center py-0.5 px-0.5 min-h-full">
              {sortOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onSortChange(opt.value)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all whitespace-nowrap ${
                    sortBy === opt.value 
                      ? 'bg-white text-emerald-600 shadow-sm' 
                      : 'text-slate-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* View Mode Toggle - Right Aligned */}
          <div className="flex items-center bg-slate-100/80 rounded-2xl p-1 shrink-0 min-w-[110px] justify-between h-[38px]">
            {[
              { id: 'detail', icon: TableIcon },
              { id: 'photo', icon: LayoutGrid },
              { id: 'table', icon: List }
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => onDisplayModeChange(mode.id as any)}
                className={`p-2 rounded-xl flex-1 flex justify-center transition-all ${
                  displayMode === mode.id 
                    ? 'bg-white text-emerald-600 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <mode.icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Page Size (Left) & Total Results (Right) */}
        <div className="flex items-center justify-between gap-2 overflow-hidden">
          {/* Page Size Chips */}
          <div className="flex flex-1 items-center bg-emerald-50/50 rounded-2xl p-1 gap-1 overflow-hidden h-[38px]">
            <div className="pl-2 pr-1 text-emerald-600/40 shrink-0">
              <Layers className="w-3 h-3" />
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar scroll-smooth items-center py-0.5 px-0.5 min-h-full">
              {pageSizeOptions.map((size) => (
                <button
                  key={size}
                  onClick={() => onItemsPerPageChange(size)}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-all whitespace-nowrap ${
                    itemsPerPage === size 
                      ? 'bg-emerald-600 text-white shadow-md' 
                      : 'text-emerald-700/60'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Results Badge - Right Aligned & Weighted */}
          <div className="bg-slate-900 text-white pl-4 pr-3 py-2 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-slate-200 min-w-[110px] shrink-0 h-[38px]">
            <span className="text-[11px] font-black tracking-tighter whitespace-nowrap">
              {totalCount} <span className="opacity-60 text-[9px] ml-0.5">{t('results.unit')}</span>
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
