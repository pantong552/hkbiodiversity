import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Search, Filter, X, CheckCircle2, RotateCcw, Shield } from 'lucide-react';
import { Species, TaxonomyLevel } from '../types/species';
import { useLanguage } from '../context/LanguageContext';
import { useTaxonomy } from '../context/TaxonomyContext';
import { supabase } from '@/lib/supabase';
import QuickFilterSearch from './ui/QuickFilterSearch';
import { getIUCNConfig, IUCN_CONFIG } from '../constants/statusStyles';
import MultiSelectDropdown from './ui/MultiSelectDropdown';
import TaxaGroupSwitcher from './search/TaxaGroupSwitcher';


interface SidebarFilterProps {
  isOpen: boolean;
  onClose: () => void;
  onFilterChange: (filters: SelectedFilters) => void;
  onSearchSubmit: (value: string) => void;
  searchQuery?: string;
  selectedFilters?: SelectedFilters;
  activeTaxaType?: 'fauna' | 'flora';
  onTaxaChange?: (type: 'fauna' | 'flora') => void;
}

export interface SelectedFilters {
  taxonomy: Record<TaxonomyLevel, string[]>;
  iucn: string[];
  isCap170?: boolean | null;
  isCap586?: boolean | null;
}

export default function SidebarFilter({
  isOpen,
  onClose,
  onFilterChange,
  onSearchSubmit,
  searchQuery = '',
  selectedFilters,
  activeTaxaType,
  onTaxaChange
}: SidebarFilterProps) {
  const { language, t } = useLanguage();
  const { getTaxonomyChi } = useTaxonomy();

  const TAXONOMY_LABELS: Record<TaxonomyLevel, string> = {
    phylum_eng: language === 'zh' ? '門 (Phylum)' : 'Phylum',
    class_eng: language === 'zh' ? '綱 (Class)' : 'Class',
    order_eng: language === 'zh' ? '目 (Order)' : 'Order',
    family_eng: language === 'zh' ? '科 (Family)' : 'Family',
    genus_eng: language === 'zh' ? '屬 (Genus)' : 'Genus',
    informal_group_eng: language === 'zh' ? '分類群 (Taxa Group)' : 'Taxa Group',
  };

  const IUCN_STATUSES = Object.keys(IUCN_CONFIG);


  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    taxonomy: true,
    protection: true,
    iucn: true,
    taxaGroup: true,
    phylum_eng: false,
    class_eng: false,
    order_eng: false,
    family_eng: false,
    genus_eng: false,
    informal_group_eng: false
  });

  const [selected, setSelected] = useState<SelectedFilters>(selectedFilters || {
    taxonomy: {
      phylum_eng: [],
      class_eng: [],
      order_eng: [],
      family_eng: [],
      genus_eng: [],
      informal_group_eng: [],
    },
    iucn: [],
    isCap170: null,
    isCap586: null,
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
  const fetchIdRef = useRef(0);

  useEffect(() => {
    async function fetchStats() {
      const currentFetchId = ++fetchIdRef.current;
      const levels: TaxonomyLevel[] = ['phylum_eng', 'class_eng', 'order_eng', 'family_eng', 'genus_eng', 'informal_group_eng'];

      try {
        // 為每個層級獨立獲取統計，排除該層級自身的選取值
        const levelPromises = levels.map(async (level) => {
          const rpcParams = {
            p_phylum_eng: level === 'phylum_eng' ? [] : selected.taxonomy.phylum_eng,
            p_class_eng: level === 'class_eng' ? [] : selected.taxonomy.class_eng,
            p_order_eng: level === 'order_eng' ? [] : selected.taxonomy.order_eng,
            p_family_eng: level === 'family_eng' ? [] : selected.taxonomy.family_eng,
            p_genus_eng: level === 'genus_eng' ? [] : selected.taxonomy.genus_eng,
            p_informal_group_eng: level === 'informal_group_eng' ? [] : selected.taxonomy.informal_group_eng,
            p_iucn: selected.iucn,
            p_search: searchQuery,
            p_is_cap170: selected.isCap170 || null,
            p_is_cap586: selected.isCap586 || null,
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
          p_informal_group_eng: selected.taxonomy.informal_group_eng,
          p_iucn: selected.iucn,
          p_search: searchQuery,
          p_is_cap170: selected.isCap170 || null,
          p_is_cap586: selected.isCap586 || null,
        });

        const [levelResults, iucnResult] = await Promise.all([
          Promise.all(levelPromises),
          iucnPromise
        ]);

        // 檢查請求是否過時 (Prevent race condition)
        if (currentFetchId !== fetchIdRef.current) return;

        const newOptions: any = {};

        levelResults.forEach(({ level, data, error }) => {
          if (!error && data) {
            const rawData = data[level] || [];
            const uniqueItems = new Map<string, { name: string; display: string; count: number }>();

            rawData.forEach((item: any) => {
              const name = item.name || 'Unknown';
              const count = parseInt(item.count) || 0;
              
              // 優先從 TaxonomyContext 獲取中文名稱
              let chiName = item.chi || name;
              if (language === 'zh') {
                const rank = level.replace('_eng', '') as any;
                const mappedChi = getTaxonomyChi(rank, 'fauna', name);
                if (mappedChi !== name) {
                  chiName = mappedChi;
                }
              }

              const existing = uniqueItems.get(name);
              if (existing) {
                existing.count += count;
                // 如果目前的顯示名稱有亂碼，或者新名稱權重較高，則更新
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

            // 確保「已選擇」的項目永遠保留在下拉列表中（即使被下級過濾條件關聯排除，數量計為 0）
            const currentSelectedForLevel = selected.taxonomy[level] || [];
            currentSelectedForLevel.forEach(selName => {
              if (!uniqueItems.has(selName)) {
                let chiName = selName;
                if (language === 'zh') {
                  const rank = level.replace('_eng', '') as any;
                  const mappedChi = getTaxonomyChi(rank, 'fauna', selName);
                  if (mappedChi !== selName) chiName = mappedChi;
                }
                uniqueItems.set(selName, {
                  name: selName,
                  display: language === 'zh' ? chiName : selName,
                  count: 0
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
  }, [selected, language, searchQuery, getTaxonomyChi]);

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

  // 計算推導出的父級名稱 (Inferred parent display label)
  const inferredParents = useMemo(() => {
    const inferred: Record<TaxonomyLevel, string | undefined> = {
      phylum_eng: undefined,
      class_eng: undefined,
      order_eng: undefined,
      family_eng: undefined,
      genus_eng: undefined,
      informal_group_eng: undefined,
    };

    const levels: TaxonomyLevel[] = ['phylum_eng', 'class_eng', 'order_eng', 'family_eng', 'genus_eng'];

    // 檢查是否有任何分類階次（門、綱、目、科、屬）被選取
    const hasTaxonomySelection = levels.some(lvl => selected.taxonomy[lvl]?.length > 0);

    // 物種類群 (informal_group_eng) 自動推導
    if (hasTaxonomySelection && (!selected.taxonomy.informal_group_eng || selected.taxonomy.informal_group_eng.length === 0) && taxonomyOptions.informal_group_eng?.length > 0) {
      const opts = taxonomyOptions.informal_group_eng;
      if (opts.length <= 3) {
        inferred.informal_group_eng = opts.map(o => o.display).join(', ');
      } else {
        inferred.informal_group_eng = `${opts.length} ${language === 'zh' ? '項' : 'items'}`;
      }
    }

    levels.forEach((level, idx) => {
      // 只有當「更下級的層次（idx + 1 以後）」有手動選擇時，才向上推導父級標籤
      const hasLowerSelection = levels.slice(idx + 1).some(lowerLevel => selected.taxonomy[lowerLevel]?.length > 0);

      if (hasLowerSelection && (!selected.taxonomy[level] || selected.taxonomy[level].length === 0) && taxonomyOptions[level]?.length > 0) {
        const opts = taxonomyOptions[level];
        if (opts.length <= 3) {
          inferred[level] = opts.map(o => o.display).join(', ');
        } else {
          inferred[level] = `${opts.length} ${language === 'zh' ? '項' : 'items'}`;
        }
      }
    });

    return inferred;
  }, [selected.taxonomy, taxonomyOptions, language]);

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

  const handleCapToggle = (key: 'isCap170' | 'isCap586') => {
    const newSelected = {
      ...selected,
      [key]: selected[key] === true ? null : true
    };
    setSelected(newSelected);
    onFilterChange(newSelected);
  };

  const clearFilters = () => {
    const reset = {
      taxonomy: { phylum_eng: [], class_eng: [], order_eng: [], family_eng: [], genus_eng: [], informal_group_eng: [] },
      iucn: [],
      isCap170: null,
      isCap586: null,
    };
    setSelected(reset);
    onFilterChange(reset);
    onSearchSubmit('');
  };

  const activeCount = Object.values(selected.taxonomy).flat().length 
    + selected.iucn.length 
    + (selected.isCap170 ? 1 : 0) 
    + (selected.isCap586 ? 1 : 0) 
    + (searchQuery.length > 0 ? 1 : 0);

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
        <div className="p-6 min-[1101px]:p-8">
          <div className="flex items-center justify-between mb-6 gap-3">
            <div className="flex-1 min-w-0">
              {activeTaxaType && onTaxaChange && (
                <TaxaGroupSwitcher activeType={activeTaxaType} onChange={onTaxaChange} variant="header" />
              )}
            </div>
            {activeCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 px-3 py-2.5 rounded-xl transition-all cursor-pointer shrink-0"
              >
                {t('filter.reset')}
              </button>
            )}
            <button 
                onClick={onClose} 
                className="min-[1101px]:hidden p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
          </div>

          <QuickFilterSearch
            initialValue={searchQuery}
            onSubmit={onSearchSubmit}
            taxaType="fauna"
            className="mb-6"
          />

          <div className="space-y-6">
            <div className="space-y-4">
              <button
                onClick={() => toggleExpand('taxaGroup')}
                className="w-full flex items-center justify-between text-sm font-black uppercase tracking-widest text-slate-400 hover:text-emerald-700 transition-colors"
              >
                {language === 'zh' ? '生物分類群' : 'Biota Group'}
                {expanded.taxaGroup ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {expanded.taxaGroup && (
                <div className="pt-2">
                  <MultiSelectDropdown
                    label={TAXONOMY_LABELS.informal_group_eng}
                    options={taxonomyOptions.informal_group_eng}
                    selectedValues={selected.taxonomy.informal_group_eng}
                    onChange={(values) => handleTaxonomyChange('informal_group_eng', values)}
                    placeholder={TAXONOMY_LABELS.informal_group_eng}
                    inferredValue={inferredParents.informal_group_eng}
                    getDisplayLabel={(val) => language === 'zh' ? getTaxonomyChi('informal_group' as any, 'fauna', val) : val}
                  />
                </div>
              )}
            </div>

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
                  {(Object.keys(TAXONOMY_LABELS) as TaxonomyLevel[])
                    .filter(level => level !== 'informal_group_eng')
                    .map((level) => {
                      const rank = level.replace('_eng', '') as any;
                      return (
                        <MultiSelectDropdown
                          key={level}
                          label={TAXONOMY_LABELS[level]}
                          options={taxonomyOptions[level]}
                          selectedValues={selected.taxonomy[level]}
                          onChange={(values) => handleTaxonomyChange(level, values)}
                          placeholder={TAXONOMY_LABELS[level]}
                          inferredValue={inferredParents[level]}
                          getDisplayLabel={(val) => language === 'zh' ? getTaxonomyChi(rank, 'fauna', val) : val}
                        />
                      );
                    })}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <button
                onClick={() => toggleExpand('protection')}
                className="w-full flex items-center justify-between text-sm font-black uppercase tracking-widest text-slate-400 hover:text-emerald-700 transition-colors"
              >
                {language === 'zh' ? '法律保護' : 'Protection'}
                {expanded.protection ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {expanded.protection && (
                <div className="pt-2">
                  {/* Desktop Grid with Icons */}
                  <div className="hidden min-[1101px]:grid grid-cols-2 gap-2">
                    {[
                      { id: 'isCap170', label: language === 'zh' ? '第 170 章' : 'Cap. 170', icon: Shield },
                      { id: 'isCap586', label: language === 'zh' ? '第 586 章' : 'Cap. 586', icon: Shield },
                    ].map(item => {
                      const isSelected = selected[item.id as 'isCap170' | 'isCap586'] === true;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleCapToggle(item.id as 'isCap170' | 'isCap586')}
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
                      { id: 'isCap170', label: language === 'zh' ? '第 170 章' : 'Cap. 170' },
                      { id: 'isCap586', label: language === 'zh' ? '第 586 章' : 'Cap. 586' },
                    ].map(item => {
                      const isSelected = selected[item.id as 'isCap170' | 'isCap586'] === true;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleCapToggle(item.id as 'isCap170' | 'isCap586')}
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

            <div className="space-y-4">
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
