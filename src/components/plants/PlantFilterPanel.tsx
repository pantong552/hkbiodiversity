'use client';

import React from 'react';
import { Calendar, Shield, RotateCcw, Star, BookOpen, Filter, Search } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { PlantFilterState } from '@/types/plants';
import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown';

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
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function PlantFilterPanel({
  filters,
  setFilters,
  availableCategories,
  availableFamilies,
  availableGenuses,
  onReset
}: PlantFilterPanelProps) {
  const { language } = useLanguage();

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
    category: language === 'zh' ? '類別' : 'Category',
    family: language === 'zh' ? '科' : 'Family',
    genus: language === 'zh' ? '屬' : 'Genus',
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
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
      
      {/* Title */}
      <div className="flex items-center justify-between pb-2 border-b border-emerald-50">
          <h2 className="text-xl font-black text-emerald-900 flex items-center gap-3">
              <Filter className="w-5 h-5 text-emerald-500" />
              {t.advanced}
          </h2>
      </div>

      {/* Quick Search */}
      <div className="relative group flex items-center pt-2">
        <Search className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none group-focus-within:text-emerald-500 transition-colors" />
        <input 
          type="text" 
          placeholder={language === 'zh' ? '快速搜尋植物...' : 'Quick search...'} 
          value={filters.searchQuery}
          onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
          className="w-full pl-12 pr-4 py-3 bg-emerald-50/50 border-2 border-transparent rounded-xl text-sm text-emerald-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50/50 transition-all outline-none"
        />
      </div>

      {/* Category */}
      <div className="space-y-4 pt-4 border-t border-emerald-50">
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
                  ? 'bg-slate-100 border-slate-300 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700' // explicitly unselected
                  : filters.categories.includes(cat.zh)
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-100' // selected
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200' // none selected
              }`}
            >
              {cat.display}
            </button>
          ))}
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
                placeholder={`${t.family}...`}
            />
            <MultiSelectDropdown 
                label={t.genus}
                options={availableGenuses}
                selectedValues={filters.genuses}
                onChange={(values) => setFilters(prev => ({ ...prev, genuses: values }))}
                placeholder={`${t.genus}...`}
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
