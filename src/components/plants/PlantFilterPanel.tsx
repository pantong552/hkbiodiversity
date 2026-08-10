'use client';

import React, { useState } from 'react';
import { Calendar, Shield, RotateCcw, Star, BookOpen, Filter, Search, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { PlantFilterState } from '@/types/plants';
import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown';
import QuickFilterSearch from '@/components/ui/QuickFilterSearch';
import TaxaGroupSwitcher, { TaxaType } from '../search/TaxaGroupSwitcher';

interface Option {
  name: string;
  display: string;
  count?: number;
}

interface PlantFilterPanelProps {
  filters: PlantFilterState;
  setFilters: React.Dispatch<React.SetStateAction<PlantFilterState>>;
  availableCategories: Option[];
  availableFamilies: Option[];
  availableGenuses: Option[];
  onReset: () => void;
  onSearchSubmit?: (val: string) => void;
  hideTitle?: boolean;
  activeTaxaType?: TaxaType;
  onTaxaChange?: (type: TaxaType) => void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function PlantFilterPanel({
  filters,
  setFilters,
  availableCategories,
  availableFamilies,
  availableGenuses,
  onReset,
  onSearchSubmit,
  hideTitle = false,
  activeTaxaType,
  onTaxaChange
}: PlantFilterPanelProps) {
  const { language } = useLanguage();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    category: true,
    classification: true,
    origin: true,
    protection: true,
    flowering: false,
    fruiting: false,
  });

  const toggleExpand = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSearchSubmit = (val: string) => {
    setFilters(prev => ({ ...prev, searchQuery: val }));
    if (onSearchSubmit) onSearchSubmit(val);
  };

  const toggleMonth = (month: number, type: 'flowering' | 'fruiting') => {
    const key = type === 'flowering' ? 'floweringMonths' : 'fruitingMonths';
    setFilters(prev => {
      const current = prev[key];
      const next = current.includes(month)
        ? current.filter(m => m !== month)
        : [...current, month];
      return { ...prev, [key]: next };
    });
  };

  const t = {
    category: language === 'zh' ? '植物類別' : 'Category',
    classification: language === 'zh' ? '分類階次' : 'Taxonomy',
    family: language === 'zh' ? '科 (Family)' : 'Family',
    genus: language === 'zh' ? '屬 (Genus)' : 'Genus',
    origin: language === 'zh' ? '產地來源' : 'Origin',
    protection: language === 'zh' ? '保育與保護狀態' : 'Protection Status',
    rarity: language === 'zh' ? '稀有度' : 'Rarity',
    flowering: language === 'zh' ? '開花期' : 'Flowering Period',
    fruiting: language === 'zh' ? '結果期' : 'Fruiting Period',
    cap96: language === 'zh' ? '第96章' : 'Cap. 96',
    cap586: language === 'zh' ? '第586章' : 'Cap. 586',
    isRare: language === 'zh' ? '稀有植物' : 'Rare',
    redBook: language === 'zh' ? '紅皮書' : 'Red Book',
    reset: language === 'zh' ? '重置' : 'Reset',
    advanced: language === 'zh' ? '植物進階過濾' : 'Plant Filter',
  };

  const activeCount = filters.categories.length + 
                    filters.families.length + 
                    filters.genuses.length + 
                    filters.origins.length + 
                    filters.floweringMonths.length + 
                    filters.fruitingMonths.length + 
                    (filters.isCap96 ? 1 : 0) + 
                    (filters.isCap586 ? 1 : 0) + 
                    (filters.isRare ? 1 : 0) + 
                    (filters.isInChinaRedBook ? 1 : 0) +
                    (filters.searchQuery.length > 0 ? 1 : 0);

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
      
      {/* Title */}
      {!hideTitle && (
        <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
                <Filter className="w-5 h-5 min-[1101px]:w-6 min-[1101px]:h-6 text-emerald-500 shrink-0" />
                <h2 className="text-xl min-[1101px]:text-2xl font-black text-emerald-900 truncate">
                    {language === 'zh' ? '植物篩選' : 'Plant Filter'}
                </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {activeTaxaType && onTaxaChange && (
                <TaxaGroupSwitcher activeType={activeTaxaType} onChange={onTaxaChange} variant="header" />
              )}
              {activeCount > 0 && (
                <button
                  onClick={onReset}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
                >
                  {t.reset}
                </button>
              )}
            </div>
        </div>
      )}

      {/* Quick Search */}
      <QuickFilterSearch 
        initialValue={filters.searchQuery}
        onSubmit={handleSearchSubmit}
        taxaType="flora"
      />

      {/* Category */}
      <div className="space-y-4">
        <button
          onClick={() => toggleExpand('category')}
          className="w-full flex items-center justify-between text-sm font-black uppercase tracking-widest text-slate-400 hover:text-emerald-700 transition-colors"
        >
          {t.category}
          {expanded.category ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {expanded.category && (
          <MultiSelectDropdown 
            label={t.category}
            options={availableCategories.map(cat => ({ name: cat.name, display: cat.display, count: cat.count }))}
            selectedValues={filters.categories}
            onChange={(values) => setFilters(prev => ({ ...prev, categories: values }))}
            placeholder={t.category}
          />
        )}
      </div>

      {/* Family & Genus (Custom Dropdown) */}
      <div className="space-y-4">
        <button
          onClick={() => toggleExpand('classification')}
          className="w-full flex items-center justify-between text-sm font-black uppercase tracking-widest text-slate-400 hover:text-emerald-700 transition-colors"
        >
          {language === 'zh' ? '物種分類層級' : 'Classification'}
          {expanded.classification ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {expanded.classification && (
          <div className="space-y-3">
              <MultiSelectDropdown 
                  label={t.family}
                  options={availableFamilies}
                  selectedValues={filters.families}
                  onChange={(values) => setFilters(prev => ({ ...prev, families: values }))}
                  placeholder={t.family}
              />
              <MultiSelectDropdown 
                  label={t.genus}
                  options={availableGenuses}
                  selectedValues={filters.genuses}
                  onChange={(values) => setFilters(prev => ({ ...prev, genuses: values }))}
                  placeholder={t.genus}
              />
          </div>
        )}
      </div>

      {/* Origin Filter */}
      <div className="space-y-4">
        <button
          onClick={() => toggleExpand('origin')}
          className="w-full flex items-center justify-between text-sm font-black uppercase tracking-widest text-slate-400 hover:text-emerald-700 transition-colors"
        >
          {t.origin}
          {expanded.origin ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {expanded.origin && (
          <div className="flex gap-3">
            {[
              { id: 'Native', zh: '原生', color: 'emerald' },
              { id: 'Exotic', zh: '外來', color: 'indigo' }
            ].map(orig => {
              const isSelected = filters.origins.includes(orig.id);
              const bgColorCls = orig.color === 'emerald' ? 'bg-emerald-600 border-emerald-600' : 'bg-indigo-600 border-indigo-600';
              const hoverCls = orig.color === 'emerald' ? 'hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-emerald-800' : 'hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-indigo-800';
              
              return (
                <button
                  key={orig.id}
                  onClick={() => setFilters(prev => ({
                    ...prev,
                    origins: isSelected ? prev.origins.filter(o => o !== orig.id) : [...prev.origins, orig.id]
                  }))}
                  className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-2 ${
                    isSelected ? `${bgColorCls} text-white shadow-lg` : `bg-white border-slate-100 ${hoverCls}`
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white animate-pulse' : (orig.color === 'emerald' ? 'bg-emerald-400' : 'bg-indigo-400')}`} />
                  {language === 'zh' ? orig.zh : orig.id}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Protection & Rarity Status */}
      <div className="space-y-4">
        <button
          onClick={() => toggleExpand('protection')}
          className="w-full flex items-center justify-between text-sm font-black uppercase tracking-widest text-slate-400 hover:text-emerald-700 transition-colors"
        >
          {t.protection} & {t.rarity}
          {expanded.protection ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {expanded.protection && (
          <div className="pt-2">
            {/* Desktop Grid with Icons */}
            <div className="hidden min-[1101px]:grid grid-cols-2 gap-2">
              {[
                { id: 'isCap96', label: t.cap96, icon: Shield },
                { id: 'isCap586', label: t.cap586, icon: Shield },
                { id: 'isRare', label: t.isRare, icon: Star },
                { id: 'isInChinaRedBook', label: t.redBook, icon: BookOpen },
              ].map(item => {
                const isSelected = (filters as any)[item.id] === true;
                return (
                  <button
                    key={item.id}
                    onClick={() => setFilters(prev => ({ ...prev, [item.id as any]: (prev as any)[item.id] === true ? null : true }))}
                    className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl text-[11px] font-black transition-all border ${
                      isSelected
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                        : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Mobile Compact Pills */}
            <div className="min-[1101px]:hidden flex flex-wrap gap-2">
              {[
                { id: 'isCap96', label: t.cap96 },
                { id: 'isCap586', label: t.cap586 },
                { id: 'isRare', label: t.isRare },
                { id: 'isInChinaRedBook', label: t.redBook },
              ].map(item => {
                const isSelected = (filters as any)[item.id] === true;
                return (
                  <button
                    key={item.id}
                    onClick={() => setFilters(prev => ({ ...prev, [item.id as any]: (prev as any)[item.id] === true ? null : true }))}
                    className={`
                      px-3 py-1.5 rounded-xl text-[11px] font-black transition-all border shadow-sm flex items-center gap-1.5 uppercase tracking-wider
                      ${isSelected
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-md scale-105 ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-200 hover:bg-slate-50'}
                    `}
                  >
                    {isSelected && <CheckCircle2 className="w-3 h-3" />}
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Months Area */}
      <div className="space-y-6">
          {/* Flowering Months */}
          <div className="space-y-4">
            <button
              onClick={() => toggleExpand('flowering')}
              className="w-full flex items-center justify-between text-sm font-black uppercase tracking-widest text-slate-400 hover:text-emerald-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-pink-500" />
                {t.flowering}
              </div>
              {expanded.flowering ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {expanded.flowering && (
              <div className="grid grid-cols-4 gap-1.5">
                  {MONTHS.map(m => (
                      <button
                          key={`flow-${m}`}
                          onClick={() => toggleMonth(m, 'flowering')}
                          className={`h-9 flex items-center justify-center rounded-lg text-xs font-black transition-all border ${
                              filters.floweringMonths.includes(m)
                              ? 'bg-pink-500 border-pink-500 text-white shadow-md'
                              : 'bg-white border-slate-100 text-slate-400 hover:bg-pink-50'
                          }`}
                      >
                          {m}
                      </button>
                  ))}
              </div>
            )}
          </div>

          {/* Fruiting Months */}
          <div className="space-y-4">
            <button
              onClick={() => toggleExpand('fruiting')}
              className="w-full flex items-center justify-between text-sm font-black uppercase tracking-widest text-slate-400 hover:text-emerald-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-500" />
                {t.fruiting}
              </div>
              {expanded.fruiting ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {expanded.fruiting && (
              <div className="grid grid-cols-4 gap-1.5">
                  {MONTHS.map(m => (
                      <button
                          key={`fruit-${m}`}
                          onClick={() => toggleMonth(m, 'fruiting')}
                          className={`h-9 flex items-center justify-center rounded-lg text-xs font-black transition-all border ${
                              filters.fruitingMonths.includes(m)
                              ? 'bg-purple-500 border-purple-500 text-white shadow-md'
                              : 'bg-white border-slate-100 text-slate-400 hover:bg-purple-50'
                          }`}
                      >
                          {m}
                      </button>
                  ))}
              </div>
            )}
          </div>
      </div>

    </div>
  );
}
