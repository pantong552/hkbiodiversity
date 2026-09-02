'use client';

import React, { useEffect } from 'react';
import { X, Filter } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { PlantFilterState } from '@/types/plants';
import PlantFilterPanel from './plants/PlantFilterPanel';
import TaxaGroupSwitcher, { TaxaType } from './search/TaxaGroupSwitcher';

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
  activeTaxaType?: TaxaType;
  onTaxaChange?: (type: TaxaType) => void;
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
          <div className="flex items-center justify-between mb-6 gap-3">
            <div className="flex-1 min-w-0">
              {activeTaxaType && onTaxaChange && (
                <TaxaGroupSwitcher activeType={activeTaxaType} onChange={onTaxaChange} variant="header" />
              )}
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
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
