'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, FilterX, LayoutGrid, List, ChevronLeft, ChevronRight, Filter, Table as TableIcon } from 'lucide-react';
import SpeciesCard from '@/components/SpeciesCard';
import SpeciesTable from '@/components/species/SpeciesTable';
import SidebarFilter, { SelectedFilters } from '@/components/SidebarFilter';
import PlantFilterPanel from '@/components/plants/PlantFilterPanel';
import TaxaGroupSwitcher, { TaxaType } from '@/components/search/TaxaGroupSwitcher';
import Header from '@/components/Header';
import MobilePlantFilter from '@/components/MobilePlantFilter';
import CustomDropdown from '@/components/ui/CustomDropdown';
import { Species } from '@/types/species';
import { PlantSpecies, PlantFilterState } from '@/types/plants';
import { useLanguage } from '@/context/LanguageContext';
import { supabase as supabaseSingleton } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import MobileToolbar from '@/components/search/MobileToolbar';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const PAGE_SIZE_OPTIONS = {
  detail: [12, 24, 36, 48, 60],
  photo: [20, 40, 60, 80, 100],
  table: [50, 75, 100, 150, 200, 300]
};

const INITIAL_PLANT_FILTERS: PlantFilterState = {
  searchQuery: '',
  categories: [],
  families: [],
  genuses: [],
  origins: [],
  floweringMonths: [],
  fruitingMonths: [],
  isCap96: null,
  isCap586: null,
  isRare: null,
  isInChinaRedBook: null,
};

export default function HomeClient() {
  const { language, t } = useLanguage();
  const { isLoading: isAuthLoading } = useAuth();
  const { addSpecies, isExpanded, isFilterOpen, setIsFilterOpen } = useSpeciesPanel();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [taxaType, setTaxaType] = useState<TaxaType>('fauna');
  const [species, setSpecies] = useState<any[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalResultCount, setTotalResultCount] = useState(0);
  const [toolbarWidth, setToolbarWidth] = useState(0);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Dynamic width sensing for toolbar labels
  useEffect(() => {
    if (!toolbarRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setToolbarWidth(entry.contentRect.width);
      }
    });
    observer.observe(toolbarRef.current);
    return () => observer.disconnect();
  }, []);

  const showLabels = toolbarWidth > 950;

  // Fauna Filters
  const [selectedFilters, setSelectedFilters] = useState<SelectedFilters>({
    taxonomy: { phylum_eng: [], class_eng: [], order_eng: [], family_eng: [], genus_eng: [] },
    iucn: []
  });

  // Flora Filters
  const [plantFilters, setPlantFilters] = useState<PlantFilterState>(INITIAL_PLANT_FILTERS);
  const [availablePlantMeta, setAvailablePlantMeta] = useState<any>({ categories: [], families: [], genuses: [] });

  const [tableFilters, setTableFilters] = useState<Record<string, string>>({});

  // Sorting and Pagination State
  const [sortBy, setSortBy] = useState<string>('common_name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [displayMode, setDisplayMode] = useState<'detail' | 'photo' | 'table'>('detail');
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(totalResultCount / itemsPerPage);

  // Fetch Flora Metadata with basic counts (Cross-filtering support)
  useEffect(() => {
    if (taxaType === 'flora') {
        const fetchMeta = async () => {
            const levels = ['categories', 'families', 'genuses'];
            
            try {
                const levelPromises = levels.map(async (level) => {
                    const rpcParams = {
                        p_categories: level === 'categories' ? [] : plantFilters.categories,
                        p_families: level === 'families' ? [] : plantFilters.families,
                        p_genuses: level === 'genuses' ? [] : plantFilters.genuses,
                        p_origins: plantFilters.origins.flatMap(o => 
                            o === 'Native' ? ['Native', '原生'] : o === 'Exotic' ? ['Exotic', '外來'] : [o]
                        ),
                        p_is_cap96: plantFilters.isCap96,
                        p_is_cap586: plantFilters.isCap586,
                        p_is_rare: plantFilters.isRare,
                        p_is_china_red_book: plantFilters.isInChinaRedBook,
                        p_flowering_months: plantFilters.floweringMonths,
                        p_fruiting_months: plantFilters.fruitingMonths,
                        p_search: searchQuery.trim() || plantFilters.searchQuery.trim()
                    };
                    const { data, error } = await supabaseSingleton.rpc('get_plant_stats', rpcParams);
                    return { level, data, error };
                });

                const results = await Promise.all(levelPromises);
                
                interface PlantMeta {
                    categories: any[];
                    families: any[];
                    genuses: any[];
                    [key: string]: any[]; // 加入索引簽名
                }
                
                const newMeta: PlantMeta = { categories: [], families: [], genuses: [] };
                
                results.forEach(({ level, data, error }) => {
                    if (data && !error) {
                        if (level === 'categories') {
                            newMeta.categories = (data.categories || []).map((i: any) => ({
                                zh: i.name,
                                en: i.en,
                                display: language === 'zh' ? i.name : (i.en || i.name)
                            }));
                        } else {
                            const items = level === 'families' ? data.families : data.genuses;
                            newMeta[level] = (items || []).map((i: any) => ({
                                name: i.name,
                                display: language === 'zh' ? (i.name || i.en) : (i.en || i.name),
                                count: i.count
                            })).sort((a: any, b: any) => b.count - a.count);
                        }
                    }
                });
                
                setAvailablePlantMeta(newMeta);
            } catch (err) {
                console.error("Error fetching plant meta", err);
            }
        };
        fetchMeta();
    }
  }, [taxaType, plantFilters, searchQuery, language]);

  // Handle Taxa Switch
  const handleTaxaChange = (type: TaxaType) => {
    setTaxaType(type);
    setCurrentPage(1);
    setSearchQuery('');
    setIsFilterOpen(false);
  };

  const fetchSpecies = useMemo(() => {
    return async () => {
      if (isAuthLoading) return;

      setIsLoading(true);
      setError(null);

      try {
        const table = taxaType === 'fauna' ? 'species' : 'plant_species';
        let query = supabaseSingleton.from(table).select('*', { count: 'exact' });

        // Apply Global & Quick Search
        const currentSearch = taxaType === 'fauna' ? searchQuery.trim() : (searchQuery.trim() || plantFilters.searchQuery.trim());
        if (currentSearch) {
            if (taxaType === 'fauna') {
                query = query.or(`common_name_chi.ilike.%${currentSearch}%,common_name_eng.ilike.%${currentSearch}%,scientific_name.ilike.%${currentSearch}%`);
            } else {
                query = query.or(`scientific_name.ilike.%${currentSearch}%,common_name_zh.ilike.%${currentSearch}%,common_name_en.ilike.%${currentSearch}%`);
            }
        }

        if (taxaType === 'fauna') {
            Object.entries(selectedFilters.taxonomy).forEach(([level, values]) => {
                if (values && values.length > 0) query = query.in(level, values);
            });
            if (selectedFilters.iucn && selectedFilters.iucn.length > 0) {
                query = query.in('iucn', selectedFilters.iucn);
            }
        } else {
            if (plantFilters.categories.length > 0) query = query.in('category_zh', plantFilters.categories);
            if (plantFilters.families.length > 0) query = query.in('family_zh', plantFilters.families);
            if (plantFilters.genuses.length > 0) query = query.in('genus_zh', plantFilters.genuses);
            if (plantFilters.origins.length > 0) {
                const expandedOrigins = plantFilters.origins.flatMap(o => 
                    o === 'Native' ? ['Native', '原生'] : o === 'Exotic' ? ['Exotic', '外來'] : [o]
                );
                query = query.in('origin', expandedOrigins);
            }
            if (plantFilters.isCap96) query = query.eq('is_cap96', 'Y');
            if (plantFilters.isCap586) query = query.eq('is_cap586', 'Y');
            if (plantFilters.floweringMonths.length > 0) query = query.overlaps('flowering_months', plantFilters.floweringMonths);
            if (plantFilters.fruitingMonths.length > 0) query = query.overlaps('fruiting_months', plantFilters.fruitingMonths);
            if (plantFilters.isRare) query = query.neq('hk_rare_precious_note', 'No');
            if (plantFilters.isInChinaRedBook) query = query.neq('china_red_data_book_note', '沒有列入');
        }

        const fieldMap: Record<string, string> = taxaType === 'fauna' ? {
          'common_name': language === 'zh' ? 'common_name_chi' : 'common_name_eng',
          'scientific_name': 'scientific_name',
          'rarity': 'iucn',
        } : {
          'common_name': language === 'zh' ? 'common_name_zh' : 'common_name_en',
          'scientific_name': 'scientific_name',
          'rarity': 'china_red_data_book_note',
        };

        const sortField = fieldMap[sortBy] || sortBy;
        if (sortField) query = query.order(sortField, { ascending: sortOrder === 'asc' });

        const safeItemsPerPage = itemsPerPage || 12;
        query = query.range((currentPage - 1) * safeItemsPerPage, currentPage * safeItemsPerPage - 1);

        const { data, error: fetchError, count } = await query;
        if (fetchError) throw fetchError;

        setSpecies(data || []);
        setTotalResultCount(count || 0);
      } catch (err: any) {
        setError(err.message || '連線錯誤');
      } finally {
        setIsLoading(false);
      }
    };
  }, [taxaType, searchQuery, selectedFilters, plantFilters, currentPage, itemsPerPage, sortBy, sortOrder, language, isAuthLoading]);

  // Handle Sort Change
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  useEffect(() => {
    if (!isAuthLoading) fetchSpecies();
  }, [fetchSpecies, isAuthLoading]);

  // Handle species parameter in URL on initial load and param change
  useEffect(() => {
    const speciesId = searchParams.get('species');
    if (speciesId) {
      // Support both new taxa_id (e.g. fauna_123) and legacy numeric ID
      addSpecies(speciesId);
      
      // Clean up URL parameter to avoid re-opening on re-renders/collapses
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [searchParams, addSpecies]);

  // Reset page when triggers change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilters, plantFilters, searchQuery, itemsPerPage]);

  return (
    <div className="min-h-screen text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <Header />

      <main className="max-w-[1920px] mx-auto px-6 md:px-8 lg:px-10 xl:px-16 pt-28 md:pt-36 pb-10">
        <div className="flex flex-col min-[1101px]:flex-row gap-0 min-[1101px]:gap-16">

          {/* Sidebar Area */}
          <div className="shrink-0 min-[1101px]:w-[320px] space-y-6">
            <TaxaGroupSwitcher activeType={taxaType} onChange={handleTaxaChange} />
            
            {taxaType === 'fauna' ? (
                <SidebarFilter
                    isOpen={isFilterOpen}
                    onClose={() => setIsFilterOpen(false)}
                    onFilterChange={setSelectedFilters}
                    onSearchSubmit={setSearchQuery}
                    searchQuery={searchQuery}
                    selectedFilters={selectedFilters}
                />
            ) : (
                <div className="hidden min-[1101px]:block animate-in fade-in slide-in-from-left-4 duration-500">
                    <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-xl">
                        <PlantFilterPanel 
                            filters={plantFilters}
                            setFilters={setPlantFilters}
                            availableCategories={availablePlantMeta.categories}
                            availableFamilies={availablePlantMeta.families}
                            availableGenuses={availablePlantMeta.genuses}
                            onReset={() => setPlantFilters(INITIAL_PLANT_FILTERS)}
                        />
                    </div>
                </div>
            )}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">


               {/* Advanced Toolbar: Sort, Results & Paging (Desktop/Tablet Only) */}
               <div 
                ref={toolbarRef}
                className={`hidden md:flex relative z-40 flex-nowrap items-center justify-between bg-white/80 backdrop-blur-2xl px-6 py-2.5 rounded-[1.25rem] shadow-xl shadow-slate-200/40 border border-slate-200/50 ring-1 ring-white/50 mb-8 scale-in duration-500 gap-4 transition-opacity ${isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              >
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setIsFilterOpen(true)}
                    className="min-[1101px]:hidden p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                    title={t('filter.title')}
                  >
                    <Filter className="w-4 h-4" />
                  </button>
                </div>

                {/* Center: Controls Grouped Tightly */}
                <div className="flex items-center gap-2 lg:gap-4 bg-slate-50/50 p-1 rounded-2xl border border-slate-100/50">
                  {displayMode !== 'table' && (
                    <div className="flex items-center gap-2 pl-2">
                      {showLabels && <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">{t('sort.label')}</span>}
                      <CustomDropdown
                        size="sm"
                        options={[
                          { 
                            value: 'common_name', 
                            label: (sortBy === 'common_name' && sortOrder === 'desc') ? t('sort.common_name').replace('A-Z', 'Z-A') : t('sort.common_name')
                          },
                          { 
                            value: 'scientific_name', 
                            label: (sortBy === 'scientific_name' && sortOrder === 'desc') ? t('sort.scientific_name').replace('A-Z', 'Z-A') : t('sort.scientific_name')
                          },
                          { 
                            value: 'rarity', 
                            label: (sortBy === 'rarity' && sortOrder === 'desc') ? t('sort.rarity').replace('High First', 'Low First') : t('sort.rarity')
                          }
                        ]}
                        value={sortBy}
                        onChange={handleSort}
                        className="min-w-[120px] lg:min-w-[160px]"
                      />
                    </div>
                  )}

                  {(displayMode !== 'table' && showLabels) && <div className="h-4 w-px bg-slate-200/60" />}

                  <div className="flex items-center gap-2 px-1">
                    {showLabels && <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">{t('view.per_page')}</span>}
                    <div className="flex bg-white shadow-sm ring-1 ring-slate-100 rounded-lg p-0.5">
                      {PAGE_SIZE_OPTIONS[displayMode].map((size) => (
                        <button
                          key={size}
                          onClick={() => setItemsPerPage(size)}
                          className={`px-2 py-1 rounded-md text-[10px] font-black transition-all ${itemsPerPage === size ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-4 w-px bg-slate-200/60" />

                  <div className="flex items-center gap-2 px-1 text-slate-300">
                    {showLabels && <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">{t('view.display_mode')}</span>}
                    <div className="flex bg-white shadow-sm ring-1 ring-slate-100 rounded-lg p-0.5">
                      {[
                        { id: 'detail', icon: List, title: t('view.mode_detail') },
                        { id: 'photo', icon: LayoutGrid, title: t('view.mode_photo') },
                        { id: 'table', icon: TableIcon, title: t('view.mode_table') }
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          onClick={() => setDisplayMode(mode.id as any)}
                          title={mode.title}
                          className={`p-1.5 rounded-md transition-all ${displayMode === mode.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          <mode.icon className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Compact Pagination & Results Count */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-1 bg-white ring-1 ring-slate-100 rounded-xl p-1 shadow-sm">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 disabled:opacity-30 transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] font-black text-slate-700 px-2 min-w-[50px] text-center whitespace-nowrap">
                      {currentPage} <span className="text-slate-300 mx-0.5">/</span> {totalPages || 1}
                    </span>
                    <button
                      disabled={currentPage === totalPages || totalPages === 0}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 disabled:opacity-30 transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="bg-slate-900 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-slate-200">
                    <span className="text-xs font-black tracking-tight whitespace-nowrap">
                      {totalResultCount} <span className="opacity-60 text-[10px] ml-1 uppercase">{t('results.unit')}</span>
                    </span>
                  </div>
                </div>
              </div>

            {/* Mobile Specialized Toolbar */}
            <MobileToolbar
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSort}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
              displayMode={displayMode}
              onDisplayModeChange={setDisplayMode}
              pageSizeOptions={PAGE_SIZE_OPTIONS[displayMode]}
              totalCount={totalResultCount}
              onFilterOpen={() => setIsFilterOpen(true)}
            />

            {/* Results Grid */}
            <div className="min-h-[400px]">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-40">
                  <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
                  <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">載入中...</p>
                </div>
              ) : (
                <>
                   {displayMode === 'table' ? (
                        <SpeciesTable
                            species={species}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            filters={tableFilters}
                            onFilterChange={setTableFilters}
                            onSort={(field) => {
                            if (sortBy === field) {
                                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            } else {
                                setSortBy(field);
                                setSortOrder('asc');
                            }
                            }}
                        />
                   ) : (
                        <div className={`
                            grid gap-6 animate-in fade-in duration-700
                            ${displayMode === 'photo'
                                ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 min-[1101px]:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
                                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 min-[1101px]:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4'}
                        `}>
                            {species.map((item, idx) => (
                            <SpeciesCard 
                                key={item.id} 
                                species={item} 
                                isPlant={taxaType === 'flora'} 
                                mode={displayMode}
                                priority={idx < 4}
                            />
                            ))}
                        </div>
                   )}

                  {species.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                        <FilterX className="w-16 h-16 text-slate-200 mb-6" />
                        <h3 className="text-xl font-black text-slate-800">找不到結果</h3>
                        <p className="text-slate-400 mt-2">嘗試調整篩選條件或搜尋關鍵字</p>
                    </div>
                  )}
                </>
              )}
              
              {/* Full Pagination Navigation */}
              {!isLoading && totalPages > 1 && (
                  <div className="mt-20 pt-10 border-t border-slate-200/60 flex flex-col items-center gap-6">
                    <div className="flex items-center gap-2">
                        <button
                        disabled={currentPage === 1}
                        onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-all"
                        >
                        <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-1 mx-2">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2))
                            .map((p, i, arr) => (
                            <div key={p} className="flex items-center">
                                {i > 0 && arr[i - 1] !== p - 1 && <span className="px-2 text-slate-300">...</span>}
                                <button
                                onClick={() => {
                                    setCurrentPage(p);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className={`w-10 h-10 rounded-xl text-sm font-black transition-all ${currentPage === p ? 'bg-emerald-600 text-white shadow-lg shadow-cyan-200' : 'text-slate-500 hover:bg-slate-100'}`}
                                >
                                {p}
                                </button>
                            </div>
                            ))}
                        </div>
                        <button
                        disabled={currentPage === totalPages}
                        onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-all"
                        >
                        <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {t('pagination.showing')} {Math.min(totalResultCount, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(totalResultCount, currentPage * itemsPerPage)} {t('pagination.of')} {totalResultCount} {t('pagination.species')}
                    </p>
                  </div>
                )}

            </div>
          </div>
        </div>
      </main>

      {/* Mobile Drawer */}
      {taxaType === 'flora' && (
        <MobilePlantFilter 
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          filters={plantFilters}
          setFilters={setPlantFilters}
          availableCategories={availablePlantMeta.categories}
          availableFamilies={availablePlantMeta.families}
          availableGenuses={availablePlantMeta.genuses}
          onReset={() => setPlantFilters(INITIAL_PLANT_FILTERS)}
        />
      )}
    </div>
  );
}
