'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Search, Filter, X, CheckCircle2 } from 'lucide-react';
import { Species, TaxonomyLevel } from '../types/species';

interface SidebarFilterProps {
  isOpen: boolean;
  onClose: () => void;
  species: Species[];
  onFilterChange: (filters: SelectedFilters) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export interface SelectedFilters {
  taxonomy: {
    kingdom: string[];
    phylum: string[];
    class: string[];
    order: string[];
    family: string[];
    genus: string[];
  };
  rarity: string[];
}

const TAXONOMY_LABELS: Record<TaxonomyLevel, string> = {
  kingdom: '界 (Kingdom)',
  phylum: '門 (Phylum)',
  class: '綱 (Class)',
  order: '目 (Order)',
  family: '科 (Family)',
  genus: '屬 (Genus)',
};

const RARITIES = ['極危', '瀕危', '易危', '近危', '常見'];

export default function SidebarFilter({ 
  isOpen, 
  onClose,
  species,
  onFilterChange,
  searchQuery,
  onSearchChange
}: SidebarFilterProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    taxonomy: true,
    rarity: true,
    // Individual level toggles, all false (collapsed) by default
    kingdom: false,
    phylum: false,
    class: false,
    order: false,
    family: false,
    genus: false
  });

  const [selected, setSelected] = useState<SelectedFilters>({
    taxonomy: {
      kingdom: [],
      phylum: [],
      class: [],
      order: [],
      family: [],
      genus: [],
    },
    rarity: [],
  });

  // Calculate counts and hierarchy options from species list (Cross-filtering)
  const filterOptions = useMemo(() => {
    // Fixed order for consistency between server and client
    const levels: TaxonomyLevel[] = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus'];
    const options: Record<TaxonomyLevel, { name: string; count: number }[]> = {
      kingdom: [], phylum: [], class: [], order: [], family: [], genus: []
    };

    levels.forEach(currentLevel => {
      // To implement correct cross-filtering:
      // When calculating options for "Level A", we should apply filters from ALL OTHER levels + Search query
      // but NOT the filters from "Level A" itself (otherwise you couldn't select multiple items in the same level).
      
      const filteredForThisLevel = species.filter(s => {
        // 1. Apply Search Query
        const matchesSearch = searchQuery === '' || 
          [s.common_name, s.scientific_name, s.kingdom, s.phylum, s.class, s.order, s.family, s.genus]
            .some(attr => attr.toLowerCase().includes(searchQuery.toLowerCase()));
        if (!matchesSearch) return false;

        // 2. Apply ALL OTHER taxonomy filters except currentLevel
        const matchesOtherTaxonomy = Object.entries(selected.taxonomy).every(([lvl, values]) => {
          if (lvl === currentLevel || values.length === 0) return true;
          return values.includes(s[lvl as keyof Species] as string);
        });
        if (!matchesOtherTaxonomy) return false;

        // 3. Apply Rarity Filter
        const matchesRarity = selected.rarity.length === 0 || selected.rarity.includes(s.rarity);
        return matchesRarity;
      });

      const counts: Record<string, number> = {};
      filteredForThisLevel.forEach(s => {
        const val = s[currentLevel];
        counts[val] = (counts[val] || 0) + 1;
      });
      
      options[currentLevel] = Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    });

    return options;
  }, [species, selected, searchQuery]);

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

  const handleRarityToggle = (value: string) => {
    const newSelected = { ...selected };
    if (newSelected.rarity.includes(value)) {
      newSelected.rarity = newSelected.rarity.filter(v => v !== value);
    } else {
      newSelected.rarity = [...newSelected.rarity, value];
    }
    setSelected(newSelected);
    onFilterChange(newSelected);
  };

  const clearFilters = () => {
    const reset = {
      taxonomy: { kingdom: [], phylum: [], class: [], order: [], family: [], genus: [] },
      rarity: [],
    };
    setSelected(reset);
    onFilterChange(reset);
  };

  const activeCount = Object.values(selected.taxonomy).flat().length + selected.rarity.length;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-cyan-900/30 backdrop-blur-md z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed lg:sticky top-0 lg:top-8 left-0 h-full lg:h-[calc(100vh-4rem)]
        w-[320px] bg-white border-r border-cyan-100 lg:border lg:rounded-3xl
        shadow-2xl lg:shadow-xl overflow-y-auto z-50 lg:z-0
        transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)
        ${isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full lg:translate-x-0'}
        scrollbar-thin scrollbar-thumb-cyan-100 scrollbar-track-transparent
      `}>
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black text-cyan-900 flex items-center gap-3">
              <Filter className="w-6 h-6 text-cyan-500" />
              進階篩選
            </h2>
            {activeCount > 0 && (
              <button 
                onClick={clearFilters}
                className="text-xs font-bold text-cyan-500 hover:text-cyan-700 bg-cyan-50 px-2 py-1 rounded-lg transition-colors"
              >
                重置
              </button>
            )}
            <button onClick={onClose} className="lg:hidden p-2 text-cyan-400 hover:bg-cyan-50 rounded-xl">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Search Box */}
          <div className="relative mb-10 group">
            <input 
              type="text" 
              placeholder="快速檢檢檢..." 
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              suppressHydrationWarning={true}
              className="w-full pl-12 pr-4 py-4 bg-cyan-50/50 border-2 border-transparent rounded-2xl text-cyan-900 placeholder:text-cyan-400 focus:bg-white focus:border-cyan-200 focus:ring-4 focus:ring-cyan-50 transition-all outline-none"
            />
            <Search className="w-6 h-6 text-cyan-300 absolute left-4 top-4 group-focus-within:text-cyan-500 transition-colors" />
          </div>

          <div className="space-y-8">
            {/* Taxonomy Section */}
            <div className="space-y-4">
              <button 
                onClick={() => toggleExpand('taxonomy')}
                className="w-full flex items-center justify-between text-sm font-black uppercase tracking-widest text-cyan-400 hover:text-cyan-600 transition-colors"
              >
                物種分類層級
                {expanded.taxonomy ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              
              {expanded.taxonomy && (
                <div className="space-y-6 pt-2">
                  {(Object.keys(TAXONOMY_LABELS) as TaxonomyLevel[]).map((level) => (
                    <div key={level} className="space-y-3">
                      <button 
                        onClick={() => toggleExpand(level)}
                        className="w-full flex items-center justify-between text-xs font-bold text-cyan-800 hover:text-cyan-500 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${selected.taxonomy[level].length > 0 ? 'bg-cyan-500' : 'bg-cyan-200'}`} />
                          {TAXONOMY_LABELS[level]}
                          {selected.taxonomy[level].length > 0 && (
                            <span className="ml-1 text-[10px] bg-cyan-100 text-cyan-600 px-1.5 py-0.5 rounded-md">
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
                                  px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 border shadow-sm flex items-center gap-1.5 animate-filter-in opacity-0
                                  ${isSelected
                                    ? 'bg-cyan-600 border-cyan-600 text-white ring-4 ring-cyan-100'
                                    : 'bg-white border-cyan-100 text-cyan-700 hover:border-cyan-300 hover:bg-cyan-50'}
                                `}
                              >
                                {isSelected && <CheckCircle2 className="w-3 h-3" />}
                                {opt.name}
                                <span className={`transition-colors duration-300 opacity-60 font-medium ${isSelected ? 'text-cyan-100' : 'text-cyan-400'}`}>
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

            {/* Rarity Section */}
            <div className="space-y-4 pt-4 border-t border-cyan-50">
              <button 
                onClick={() => toggleExpand('rarity')}
                className="w-full flex items-center justify-between text-sm font-black uppercase tracking-widest text-cyan-400 hover:text-cyan-600 transition-colors"
              >
                稀有度與現狀
                {expanded.rarity ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              
              {expanded.rarity && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {RARITIES.map((rarity) => (
                    <button
                      key={rarity}
                      onClick={() => handleRarityToggle(rarity)}
                      className={`
                        px-4 py-3 rounded-2xl text-xs font-bold transition-all border text-center
                        ${selected.rarity.includes(rarity)
                          ? 'bg-cyan-900 border-cyan-900 text-white shadow-lg'
                          : 'bg-white border-cyan-100 text-cyan-700 hover:bg-cyan-50'}
                      `}
                    >
                      {rarity}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
