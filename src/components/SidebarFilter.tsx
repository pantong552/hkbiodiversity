'use client';

import { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, Search, Filter, X, CheckCircle2 } from 'lucide-react';
import { Species, TaxonomyLevel } from '../types/species';
import { useLanguage } from '../context/LanguageContext';

interface SidebarFilterProps {
  isOpen: boolean;
  onClose: () => void;
  species: Species[];
  onFilterChange: (filters: SelectedFilters) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export interface SelectedFilters {
  taxonomy: Record<TaxonomyLevel, string[]>;
  iucn: string[];
}

export default function SidebarFilter({ 
  isOpen, 
  onClose,
  species,
  onFilterChange,
  searchQuery,
  onSearchChange
}: SidebarFilterProps) {
  const { language, t } = useLanguage();

  const TAXONOMY_LABELS: Record<TaxonomyLevel, string> = {
    phylum: language === 'zh' ? '門 (Phylum)' : 'Phylum',
    class: language === 'zh' ? '綱 (Class)' : 'Class',
    order: language === 'zh' ? '目 (Order)' : 'Order',
    family: language === 'zh' ? '科 (Family)' : 'Family',
    genus: language === 'zh' ? '屬 (Genus)' : 'Genus',
  };

  const IUCN_STATUSES = [
    'Least Concern', 'Near Threatened', 'Vulnerable', 
    'Endangered', 'Critically Endangered', 'Data Deficient', 'Not Evaluated'
  ];
  const IUCN_MAP: Record<string, string> = {
    'Least Concern': '無危 (LC)',
    'Near Threatened': '近危 (NT)',
    'Vulnerable': '易危 (VU)',
    'Endangered': '瀕危 (EN)',
    'Critically Endangered': '極危 (CR)',
    'Data Deficient': '數據缺乏 (DD)',
    'Not Evaluated': '未評估 (NE)'
  };

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    taxonomy: true,
    iucn: true,
    phylum: false,
    class: false,
    order: false,
    family: false,
    genus: false
  });

  const [selected, setSelected] = useState<SelectedFilters>({
    taxonomy: {
      phylum: [],
      class: [],
      order: [],
      family: [],
      genus: [],
    },
    iucn: [],
  });

  const filterOptions = useMemo(() => {
    const levels: TaxonomyLevel[] = ['phylum', 'class', 'order', 'family', 'genus'];
    const options: Record<TaxonomyLevel, { name: string; display: string; count: number }[]> = {
      phylum: [], class: [], order: [], family: [], genus: []
    };

    levels.forEach(currentLevel => {
      const filteredForThisLevel = species.filter(s => {
        const matchesSearch = searchQuery === '' || 
          [s.common_name, s.common_name_en, s.scientific_name, s.phylum, s.phylum_chi, s.class, s.class_chi, s.order, s.order_chi, s.family, s.family_chi, s.genus, s.genus_chi]
            .some(attr => attr && attr.toLowerCase().includes(searchQuery.toLowerCase()));
        if (!matchesSearch) return false;

        const matchesOtherTaxonomy = Object.entries(selected.taxonomy).every(([lvl, values]) => {
          if (lvl === currentLevel || values.length === 0) return true;
          return values.includes(s[lvl as TaxonomyLevel] as string);
        });
        if (!matchesOtherTaxonomy) return false;

        const matchesIUCN = selected.iucn.length === 0 || selected.iucn.includes(s.iucn);
        return matchesIUCN;
      });

      const countsMap = new Map<string, { display: string, count: number }>();
      filteredForThisLevel.forEach(s => {
        // We use the English taxonomy key for internal identification
        const val = s[currentLevel] as string;
        // Construct visual text based on language preference
        const displayVal = language === 'zh' ? (s[`${currentLevel}_chi` as keyof Species] as string || val) : val;
        
        if (!countsMap.has(val)) {
          countsMap.set(val, { display: displayVal, count: 0 });
        }
        countsMap.get(val)!.count += 1;
      });
      
      options[currentLevel] = Array.from(countsMap.entries())
        .map(([name, data]) => ({ name, display: data.display, count: data.count }))
        .sort((a, b) => b.count - a.count);
    });

    return options;
  }, [species, selected, searchQuery, language]);

  useEffect(() => {
    const isMobile = window.innerWidth <= 1100;
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const toggleExpand = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTaxonomyToggle = (level: TaxonomyLevel, value: string) => {
    const newSelected = { ...selected };
    const current = newSelected.taxonomy[level];
    if (current.includes(value)) {
      newSelected.taxonomy[level] = current.filter(v => v !== value);
    } else {
      newSelected.taxonomy[level] = [...current, value];
    }
    setSelected(newSelected);
    onFilterChange(newSelected);
  };

  const handleIUCNToggle = (value: string) => {
    const newSelected = { ...selected };
    if (newSelected.iucn.includes(value)) {
      newSelected.iucn = newSelected.iucn.filter(v => v !== value);
    } else {
      newSelected.iucn = [...newSelected.iucn, value];
    }
    setSelected(newSelected);
    onFilterChange(newSelected);
  };

  const clearFilters = () => {
    const reset = {
      taxonomy: { phylum: [], class: [], order: [], family: [], genus: [] },
      iucn: [],
    };
    setSelected(reset);
    onFilterChange(reset);
  };

  const activeCount = Object.values(selected.taxonomy).flat().length + selected.iucn.length;

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-emerald-900/30 backdrop-blur-md z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed min-[1101px]:sticky top-0 min-[1101px]:top-8 left-0 h-full min-[1101px]:h-[calc(100vh-4rem)]
        w-[320px] bg-white border-r border-slate-100 min-[1101px]:border min-[1101px]:rounded-3xl
        shadow-2xl min-[1101px]:shadow-xl overflow-y-auto z-50 min-[1101px]:z-0
        transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)
        ${isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full min-[1101px]:translate-x-0'}
        scrollbar-thin scrollbar-thumb-slate-100 scrollbar-track-transparent
      `}>
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black text-emerald-900 flex items-center gap-3">
              <Filter className="w-6 h-6 text-emerald-500" />
              {t('filter.title')}
            </h2>
            {activeCount > 0 && (
              <button 
                onClick={clearFilters}
                className="text-xs font-bold text-emerald-500 hover:text-emerald-700 bg-cyan-50 px-2 py-1 rounded-lg transition-colors"
              >
                {t('filter.reset')}
              </button>
            )}
            <button onClick={onClose} className="min-[1101px]:hidden p-2 text-cyan-400 hover:bg-cyan-50 rounded-xl">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="relative mb-10 group">
            <input 
              type="text" 
              placeholder={t('search.sidebar_placeholder')} 
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              suppressHydrationWarning={true}
              className="w-full pl-12 pr-4 py-4 bg-cyan-50/50 border-2 border-transparent rounded-2xl text-emerald-900 placeholder:text-cyan-400 focus:bg-white focus:border-emerald-200 focus:ring-4 focus:ring-cyan-50 transition-all outline-none"
            />
            <Search className="w-6 h-6 text-emerald-300 absolute left-4 top-4 group-focus-within:text-emerald-500 transition-colors" />
          </div>

          <div className="space-y-8">
            <div className="space-y-4">
              <button 
                onClick={() => toggleExpand('taxonomy')}
                className="w-full flex items-center justify-between text-sm font-black uppercase tracking-widest text-cyan-400 hover:text-emerald-600 transition-colors"
              >
                {t('filter.taxonomy')}
                {expanded.taxonomy ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              
              {expanded.taxonomy && (
                <div className="space-y-6 pt-2">
                  {(Object.keys(TAXONOMY_LABELS) as TaxonomyLevel[]).map((level) => (
                    <div key={level} className="space-y-3">
                      <button 
                        onClick={() => toggleExpand(level)}
                        className="w-full flex items-center justify-between text-xs font-bold text-cyan-800 hover:text-emerald-500 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${selected.taxonomy[level].length > 0 ? 'bg-emerald-500' : 'bg-emerald-200'}`} />
                          {TAXONOMY_LABELS[level]}
                          {selected.taxonomy[level].length > 0 && (
                            <span className="ml-1 text-[10px] bg-slate-100 text-emerald-600 px-1.5 py-0.5 rounded-md">
                              {selected.taxonomy[level].length}
                            </span>
                          )}
                        </div>
                        {expanded[level] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>

                      {expanded[level] && (
                        <div className="flex flex-wrap gap-2 pl-3 pb-2 transition-all duration-300 ease-in-out">
                          {filterOptions[level].map((opt, idx) => {
                            const isSelected = selected.taxonomy[level].includes(opt.name);
                            if (opt.count === 0 && !isSelected) return null;
                            
                            return (
                              <button
                                key={opt.name}
                                onClick={() => handleTaxonomyToggle(level, opt.name)}
                                style={{ animationDelay: `${idx * 40}ms` }}
                                className={`
                                  px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 border shadow-sm flex items-center gap-1.5 opacity-0 animate-filter-in
                                  ${isSelected
                                    ? 'bg-emerald-600 border-emerald-600 text-white ring-4 ring-slate-100'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50'}
                                `}
                              >
                                {isSelected && <CheckCircle2 className="w-3 h-3" />}
                                {opt.display}
                                <span className={`transition-colors duration-300 opacity-60 font-medium ${isSelected ? 'text-slate-100' : 'text-cyan-400'}`}>
                                  ({opt.count})
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t border-cyan-50">
              <button 
                onClick={() => toggleExpand('iucn')}
                className="w-full flex items-center justify-between text-sm font-black uppercase tracking-widest text-cyan-400 hover:text-emerald-600 transition-colors"
              >
                {language === 'zh' ? 'IUCN 狀態' : 'IUCN Status'}
                {expanded.iucn ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              
              {expanded.iucn && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {IUCN_STATUSES.map((status) => {
                    const count = species.filter(s => s.iucn === status).length;
                    const isSelected = selected.iucn.includes(status);
                    if (count === 0 && !isSelected) return null; // Only show active statuses
                    
                    return (
                      <button
                        key={status}
                        onClick={() => handleIUCNToggle(status)}
                        className={`
                          px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm flex items-center gap-1
                          ${isSelected
                            ? 'bg-amber-600 border-amber-600 text-white shadow-md'
                            : 'bg-amber-50 border-amber-100 text-amber-900 hover:bg-amber-100'}
                        `}
                      >
                        {isSelected && <CheckCircle2 className="w-3 h-3" />}
                        {language === 'zh' ? IUCN_MAP[status] : status}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
