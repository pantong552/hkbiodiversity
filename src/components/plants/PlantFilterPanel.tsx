'use client';

import React from 'react';
import { Calendar, Shield, RotateCcw, Star, BookOpen, Filter, Search } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { PlantFilterState } from '@/types/plants';
import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown';
import QuickFilterSearch from '@/components/ui/QuickFilterSearch';

interface Option {
  name: string;
  display: string;
  count: number;
}

interface PlantFilterPanelProps {
  filters: PlantFilterState;
  setFilters: React.Dispatch<React.SetStateAction<PlantFilterState>>;
  availableCategories: { zh: string; en: string; display: string }[];
  availableFamilies: Option[];
  availableGenuses: Option[];
  onReset: () => void;
  hideTitle?: boolean;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function PlantFilterPanel({
  filters,
  setFilters,
  availableCategories,
  availableFamilies,
  availableGenuses,
  onReset,
  hideTitle = false
}: PlantFilterPanelProps) {
  const { language } = useLanguage();

  const handleSearchSubmit = (val: string) => {
    setFilters(prev => ({ ...prev, searchQuery: val }));
  };

  const toggleMonth = (month: number, type: 'flowering' | 'fruiting') => {
    const key = type === 'flowering' ? 'floweringMonths' : 'fruitingMonths';
    setFilters(prev => ({
      ...prev,
      [key]: prev[key].includes(month)
        ? prev[key].filter(m => m !== month)
        : [...prev[key], month]
    }));
  };

  const t = {
    category: language === 'zh' ? '植物類別' : 'Plant Category',
    family: language === 'zh' ? '科 (Family)' : 'Family',
    genus: language === 'zh' ? '屬 (Genus)' : 'Genus',
    origin: language === 'zh' ? '來源' : 'Origin',
    flowering: language === 'zh' ? '花期' : 'Flowering',
    fruiting: language === 'zh' ? '果期' : 'Fruiting',
    protection: language === 'zh' ? '法律保護' : 'Protection',
    rarity: language === 'zh' ? '保育狀態' : 'Rarity',
    cap96: language === 'zh' ? '第 96 章' : 'Cap. 96',
    cap586: language === 'zh' ? '第 586 章' : 'Cap. 586',
    isRare: language === 'zh' ? '稀有植物' : 'Rare',
    redBook: language === 'zh' ? '紅皮書' : 'Red Book',
    reset: language === 'zh' ? '重設過濾' : 'Reset Filters',
    advanced: language === 'zh' ? '植物進階過濾' : 'Plant Filter',
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
      
      {/* Title */}
      {!hideTitle && (
        <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-emerald-900 flex items-center gap-3">
                <Filter className="w-6 h-6 text-emerald-500" />
                {language === 'zh' ? '植物篩選' : 'Plant Filter'}
            </h2>
        </div>
      )}

      {/* Quick Search */}
      <QuickFilterSearch 
        initialValue={filters.searchQuery}
        onSubmit={handleSearchSubmit}
      />

      {/* Category */}
      <div className="space-y-4">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          {t.category}
        </h3>
        <div className="flex flex-wrap gap-2">
          {availableCategories.map(cat => (
            <button
              key={cat.zh}
              onClick={() => setFilters(prev => ({
                ...prev, 
                categories: prev.categories.includes(cat.zh) ? prev.categories.filter(c => c !== cat.zh) : [...prev.categories, cat.zh]
              }))}
              className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-all border ${
                filters.categories.length > 0 && !filters.categories.includes(cat.zh)
                  ? 'bg-slate-100 border-slate-300 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
                  : filters.categories.includes(cat.zh)
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-100'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
              }`}
            >
              {cat.display}
            </button>
          ))}
        </div>
      </div>

      {/* Origin Filter */}
      <div className="space-y-4 pt-4 border-t border-emerald-50">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          {t.origin}
        </h3>
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
      </div>

      {/* Family & Genus (Custom Dropdown) */}
      <div className="space-y-4 pt-4 border-t border-emerald-50">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
            {language === 'zh' ? '物種分類層級' : 'Classification'}
        </h3>
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
      </div>

      {/* Protection & Rarity Status */}
      <div className="space-y-4 pt-4 border-t border-emerald-50">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
          {t.protection} & {t.rarity}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'isCap96', label: t.cap96, icon: Shield },
            { id: 'isCap586', label: t.cap586, icon: Shield },
            { id: 'isRare', label: t.isRare, icon: Star },
            { id: 'isInChinaRedBook', label: t.redBook, icon: BookOpen },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setFilters(prev => ({ ...prev, [item.id as any]: (prev as any)[item.id] === true ? null : true }))}
              className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl text-[10px] font-black transition-all border ${
                (filters as any)[item.id] === true
                  ? `bg-emerald-600 border-emerald-600 text-white shadow-md`
                  : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'
              }`}
            >
              <item.icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Months Area */}
      <div className="grid grid-cols-1 gap-6 pt-4 border-t border-emerald-50">
          {/* Flowering Months */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-4 h-4 text-pink-500" />
              {t.flowering}
            </h3>
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
          </div>

          {/* Fruiting Months */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-500" />
              {t.fruiting}
            </h3>
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
          </div>
      </div>

      {/* Reset */}
      <button
        onClick={onReset}
        className="w-full py-3.5 bg-emerald-50 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        {t.reset}
      </button>

    </div>
  );
}
