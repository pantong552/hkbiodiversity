'use client';

import React, { useEffect } from 'react';
import { X, Filter } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { PlantFilterState } from '@/types/plants';
import PlantFilterPanel from './plants/PlantFilterPanel';
import TaxaGroupSwitcher from './search/TaxaGroupSwitcher';

interface MobilePlantFilterProps {
  isOpen: boolean;
  onClose: () => void;
  filters: PlantFilterState;
  setFilters: React.Dispatch<React.SetStateAction<PlantFilterState>>;
  availableCategories: any[];
  availableFamilies: any[];
  availableGenuses: any[];
  onReset: () => void;
  onSearchSubmit?: (val: string) => void;
  activeTaxaType?: 'fauna' | 'flora';
  onTaxaChange?: (type: 'fauna' | 'flora') => void;
}

export default function MobilePlantFilter({
  isOpen,
  onClose,
  filters,
  setFilters,
  availableCategories,
  availableFamilies,
  availableGenuses,
  onReset,
  onSearchSubmit,
  activeTaxaType,
  onTaxaChange
}: MobilePlantFilterProps) {
  const { language } = useLanguage();

  // Prevent background scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed top-0 left-0 right-0 h-[100dvh] bg-slate-900/40 backdrop-blur-sm z-[100] min-[1101px]:hidden"
          onClick={onClose}
        />
      )}

      {/* Side Panel */}
      <aside className={`
        fixed top-0 left-0 h-[100dvh] w-[320px] bg-white z-[101] min-[1101px]:hidden
        shadow-2xl flex flex-col transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)
        ${isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}
        overflow-y-auto scrollbar-thin scrollbar-thumb-slate-100 scrollbar-track-transparent
      `}>
        <div className="p-6 min-[1101px]:p-8">
          <div className="flex items-center justify-between mb-6 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Filter className="w-5 h-5 text-emerald-600 shrink-0" />
              <h2 className="text-xl font-black text-emerald-900 truncate">
                {language === 'zh' ? '植物篩選' : 'Plant Filter'}
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {activeTaxaType && onTaxaChange && (
                <TaxaGroupSwitcher activeType={activeTaxaType} onChange={onTaxaChange} variant="header" />
              )}
              <button 
                onClick={onClose}
                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <PlantFilterPanel 
            filters={filters}
            setFilters={setFilters}
            availableCategories={availableCategories}
            availableFamilies={availableFamilies}
            availableGenuses={availableGenuses}
            onReset={onReset}
            onSearchSubmit={onSearchSubmit}
            hideTitle={true}
          />
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-50 bg-slate-50/50">
          <button
            onClick={onClose}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-100 transition-all active:scale-95"
          >
            {language === 'zh' ? '套用篩選' : 'Apply Filters'}
          </button>
        </div>
      </aside>
    </>
  );
}
