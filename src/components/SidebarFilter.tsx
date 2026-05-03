import { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, Search, Filter, X, CheckCircle2, RotateCcw } from 'lucide-react';
import { Species, TaxonomyLevel } from '../types/species';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '@/lib/supabase';
import QuickFilterSearch from './ui/QuickFilterSearch';
import { getIUCNConfig, IUCN_CONFIG } from '../constants/statusStyles';
import MultiSelectDropdown from './ui/MultiSelectDropdown';


interface SidebarFilterProps {
  isOpen: boolean;
  onClose: () => void;
  onFilterChange: (filters: SelectedFilters) => void;
  onSearchSubmit: (value: string) => void;
  searchQuery?: string;
  selectedFilters?: SelectedFilters;
}

export interface SelectedFilters {
  taxonomy: Record<TaxonomyLevel, string[]>;
  iucn: string[];
}

export default function SidebarFilter({ 
  isOpen, 
  onClose,
  onFilterChange,
  onSearchSubmit,
  searchQuery = '',
  selectedFilters
}: SidebarFilterProps) {
  const { language, t } = useLanguage();

  const TAXONOMY_LABELS: Record<TaxonomyLevel, string> = {
    phylum_eng: language === 'zh' ? '門 (Phylum)' : 'Phylum',
    class_eng: language === 'zh' ? '綱 (Class)' : 'Class',
    order_eng: language === 'zh' ? '目 (Order)' : 'Order',
    family_eng: language === 'zh' ? '科 (Family)' : 'Family',
    genus_eng: language === 'zh' ? '屬 (Genus)' : 'Genus',
    informal_group_eng: language === 'zh' ? '非正式類群' : 'Informal Group',
  };

  const IUCN_STATUSES = Object.keys(IUCN_CONFIG);


  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    taxonomy: true,
    iucn: true,
    phylum_eng: false,
    class_eng: false,
    order_eng: false,
    family_eng: false,
    genus_eng: false,
    informal_group_eng: false
  });

  const [selected, setSelected] = useState<SelectedFilters>(selectedFilters || {
    taxonomy: {
      family_eng: [],
      genus_eng: [],
      informal_group_eng: [],
    },
    iucn: [],
  });

  // 1. Sync local selected state with external selectedFilters prop
  useEffect(() => {
    if (selectedFilters) {
      setSelected(selectedFilters);
      
      // Auto-expand levels that have selected items
      const newExpanded = { ...expanded };
      let hasChange = false;
      Object.entries(selectedFilters.taxonomy).forEach(([level, values]) => {
        if (values.length > 0 && !expanded[level]) {
          newExpanded[level] = true;
          hasChange = true;
        }
      });
      if (hasChange) setExpanded(newExpanded);
    }
  }, [selectedFilters]);

  const [taxonomyOptions, setTaxonomyOptions] = useState<Record<TaxonomyLevel, { name: string; display: string; count: number }[]>>({
    phylum_eng: [], class_eng: [], order_eng: [], family_eng: [], genus_eng: [], informal_group_eng: []
  });
  const [iucnCounts, setIucnCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchStats() {
      const levels: TaxonomyLevel[] = ['phylum_eng', 'class_eng', 'order_eng', 'family_eng', 'genus_eng'];
      
      try {
        // 為每個層級獨立獲取統計，排除該層級自身的選取值
        const levelPromises = levels.map(async (level) => {
          const rpcParams = {
            p_phylum_eng: level === 'phylum_eng' ? [] : selected.taxonomy.phylum_eng,
            p_class_eng: level === 'class_eng' ? [] : selected.taxonomy.class_eng,
            p_order_eng: level === 'order_eng' ? [] : selected.taxonomy.order_eng,
            p_family_eng: level === 'family_eng' ? [] : selected.taxonomy.family_eng,
            p_genus_eng: level === 'genus_eng' ? [] : selected.taxonomy.genus_eng,
            p_iucn: selected.iucn,
            p_search: searchQuery
          };
          const { data, error } = await supabase.rpc('get_species_stats', rpcParams);
          return { level, data, error };
        });

        // IUCN 仍然使用全過濾統計
        const iucnPromise = supabase.rpc('get_species_stats', {
          p_phylum_eng: selected.taxonomy.phylum_eng,
          p_class_eng: selected.taxonomy.class_eng,
          p_order_eng: selected.taxonomy.order_eng,
          p_family_eng: selected.taxonomy.family_eng,
          p_genus_eng: selected.taxonomy.genus_eng,
          p_iucn: selected.iucn,
          p_search: searchQuery
        });

        const [levelResults, iucnResult] = await Promise.all([
          Promise.all(levelPromises),
          iucnPromise
        ]);

        const newOptions = { ...taxonomyOptions };
        
        levelResults.forEach(({ level, data, error }) => {
          if (!error && data) {
            const rawData = data[level] || [];
            const uniqueItems = new Map<string, { name: string; display: string; count: number }>();
            
            rawData.forEach((item: any) => {
              const name = item.name || 'Unknown';
              const count = parseInt(item.count) || 0;
              const chiName = item.chi || name;
              
              const existing = uniqueItems.get(name);
              if (existing) {
                existing.count += count;
                const isCurrentGlitchy = existing.display.includes('\ufffd');
                const isNewGlitchy = chiName.includes('\ufffd');
                if ((isCurrentGlitchy && !isNewGlitchy) || (count > (existing.count - count) && !isNewGlitchy)) {
                  existing.display = language === 'zh' ? chiName : name;
                }
              } else {
                uniqueItems.set(name, {
                  name: name,
                  display: language === 'zh' ? chiName : name,
                  count: count
                });
              }
            });

            newOptions[level] = Array.from(uniqueItems.values())
              .filter(opt => opt.name !== 'Unknown' && opt.display.trim() !== '')
              .sort((a, b) => b.count - a.count);
          } else if (error) {
            console.error(`RPC Error fetching stats for ${level}:`, error);
          }
        });

        setTaxonomyOptions(newOptions);
        
        if (!iucnResult.error && iucnResult.data) {
          setIucnCounts(iucnResult.data.iucn || {});
        }
      } catch (err) {
        console.error('Error fetching species stats:', err);
      }
    }

    fetchStats();
  }, [selected, language, searchQuery]); // 重新加入 searchQuery，確保側邊欄統計與搜尋結果同步

  const filterOptions = taxonomyOptions;

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

  const handleTaxonomyChange = (level: TaxonomyLevel, values: string[]) => {
    const newSelected = { ...selected };
    newSelected.taxonomy[level] = values;
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
      taxonomy: { phylum_eng: [], class_eng: [], order_eng: [], family_eng: [], genus_eng: [], informal_group_eng: [] },
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
          className="fixed top-0 left-0 right-0 h-[100dvh] bg-slate-900/40 backdrop-blur-md z-[100] min-[1101px]:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed min-[1101px]:sticky top-0 min-[1101px]:top-8 left-0 h-[100dvh] min-[1101px]:h-[calc(100vh-4rem)]
        w-[320px] bg-white border-r border-slate-100 min-[1101px]:border min-[1101px]:rounded-3xl
        shadow-2xl min-[1101px]:shadow-xl overflow-y-auto z-[101] min-[1101px]:z-0
        transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)
        ${isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full min-[1101px]:translate-x-0'}
        scrollbar-thin scrollbar-thumb-slate-100 scrollbar-track-transparent
      `}>
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-emerald-900 flex items-center gap-3">
              <Filter className="w-6 h-6 text-emerald-500" />
              {t('filter.title')}
            </h2>
            {activeCount > 0 && (
              <button 
                onClick={clearFilters}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
              >
                {t('filter.reset')}
              </button>
            )}
            <button onClick={onClose} className="min-[1101px]:hidden p-2 text-slate-400 hover:bg-emerald-50 rounded-xl">
              <X className="w-6 h-6" />
            </button>
          </div>

          <QuickFilterSearch 
            initialValue={searchQuery}
            onSubmit={onSearchSubmit}
            className="mb-6"
          />

          <div className="space-y-6">
            <div className="space-y-4">
              <button 
                onClick={() => toggleExpand('taxonomy')}
                className="w-full flex items-center justify-between text-sm font-black uppercase tracking-widest text-slate-400 hover:text-emerald-700 transition-colors"
              >
                {t('filter.taxonomy')}
                {expanded.taxonomy ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              
              {expanded.taxonomy && (
                <div className="space-y-3 pt-2">
                  {(Object.keys(TAXONOMY_LABELS) as TaxonomyLevel[]).map((level) => (
                    <MultiSelectDropdown
                      key={level}
                      label={TAXONOMY_LABELS[level]}
                      options={taxonomyOptions[level]}
                      selectedValues={selected.taxonomy[level]}
                      onChange={(values) => handleTaxonomyChange(level, values)}
                      placeholder={TAXONOMY_LABELS[level]}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t border-emerald-50">
              <button 
                onClick={() => toggleExpand('iucn')}
                className="w-full flex items-center justify-between text-sm font-black uppercase tracking-widest text-slate-400 hover:text-emerald-700 transition-colors"
              >
                {language === 'zh' ? 'IUCN 狀態' : 'IUCN Status'}
                {expanded.iucn ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              
              {expanded.iucn && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {IUCN_STATUSES.map((status) => {
                    const count = iucnCounts[status] || 0;
                    const isSelected = selected.iucn.includes(status);
                    const config = getIUCNConfig(status);
                    const label = language === 'zh' ? config.label.zh : config.label.en;
                    
                    // Always show for complete filter list, but dim if count is 0 and not selected
                    const isEmpty = count === 0 && !isSelected;

                    return (
                      <button
                        key={status}
                        onClick={() => handleIUCNToggle(status)}
                        className={`
                          px-3 py-1.5 rounded-xl text-[11px] font-black transition-all border shadow-sm flex items-center gap-1.5 uppercase tracking-wider
                          ${isSelected
                            ? `${config.styles} shadow-md scale-105 ring-2 ring-emerald-500/20`
                            : isEmpty 
                              ? 'bg-slate-50 border-slate-100 text-slate-300 opacity-50 grayscale hover:grayscale-0 hover:opacity-100'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-200 hover:bg-slate-50'}
                        `}
                      >
                        {isSelected && <CheckCircle2 className="w-3 h-3" />}
                        {label}
                        <span className={`text-[10px] font-bold ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
                          ({count})
                        </span>
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
