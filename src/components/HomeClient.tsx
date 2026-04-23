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
  const searchParams = useSearchParams();
  const router = useRouter();

  const [taxaType, setTaxaType] = useState<TaxaType>('fauna');
  const [species, setSpecies] = useState<any[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSearch, setLocalSearch] = useState('');
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
            const rpcParams = {
                p_categories: plantFilters.categories,
                p_families: plantFilters.families,
                p_genuses: plantFilters.genuses,
                p_is_cap96: plantFilters.isCap96,
                p_is_cap586: plantFilters.isCap586,
                p_is_rare: plantFilters.isRare,
                p_is_china_red_book: plantFilters.isInChinaRedBook,
                p_flowering_months: plantFilters.floweringMonths,
                p_fruiting_months: plantFilters.fruitingMonths,
                p_search: searchQuery
            };

            const { data, error } = await supabaseSingleton.rpc('get_plant_stats', rpcParams);
            
            if (data && !error) {
                const formatOpts = (items: any[]) => (items || []).map(i => ({
                    name: i.name, // 使用中文名作為 Filter Key
                    display: language === 'zh' ? (i.name || i.en) : (i.en || i.name),
                    count: i.count
                })).sort((a, b) => b.count - a.count);

                setAvailablePlantMeta({
                    categories: (data.categories || []).map((i: any) => ({
                        zh: i.name,
                        en: i.en,
                        display: language === 'zh' ? i.name : (i.en || i.name)
                    })),
                    families: formatOpts(data.families),
                    genuses: formatOpts(data.genuses),
                });
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
    setLocalSearch('');
    setIsSidebarOpen(false);
  };

  const fetchSpecies = useMemo(() => {
    return async () => {
      if (isAuthLoading) return;

      setIsLoading(true);
      setError(null);

      try {
        const table = taxaType === 'fauna' ? 'species' : 'plant_species';
        let query = supabaseSingleton.from(table).select('*', { count: 'exact' });

        // Apply Global Search
        if (searchQuery.trim()) {
            if (taxaType === 'fauna') {
                query = query.or(`common_name_chi.ilike.%${searchQuery}%,common_name_eng.ilike.%${searchQuery}%,scientific_name.ilike.%${searchQuery}%`);
            } else {
                query = query.textSearch('fts', searchQuery, { type: 'plain', config: 'simple' });
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

  useEffect(() => {
    if (!isAuthLoading) fetchSpecies();
  }, [fetchSpecies, isAuthLoading]);

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
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                    onFilterChange={setSelectedFilters}
                    searchValue={localSearch}
                    onSearchChange={setLocalSearch}
                    onSearchSubmit={() => setSearchQuery(localSearch)}
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
            {/* Desktop Hero */}
            <div className="hidden md:flex flex-col gap-6 lg:gap-10 mb-6 lg:mb-8 pb-6 lg:pb-10 border-b border-slate-100">
              <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-3 text-emerald-600 font-black text-[10px] lg:text-xs uppercase tracking-[0.3em] mb-3 lg:mb-4">
                    <div className="h-[2px] w-8 bg-emerald-600" />
                    {taxaType === 'fauna' ? t('hero.badge') : (language === 'zh' ? '植物資料庫' : 'PLANT DATABASE')}
                  </div>
                  <h1 className="text-4xl md:text-5xl lg:text-7xl font-black text-slate-900 tracking-tight leading-[0.9] mb-3 lg:mb-6 uppercase">
                    {language === 'zh' ? (
                      <>香港 <span className="text-emerald-600">{taxaType === 'fauna' ? '生物多樣性' : '植物資料庫'}</span></>
                    ) : (
                      <>Hong Kong <span className="text-emerald-600">{taxaType === 'fauna' ? 'Biodiversity' : 'Flora'}</span></>
                    )}
                  </h1>
                   <p className="text-lg lg:text-xl text-slate-500 font-medium leading-relaxed">
                    {t('hero.subtitle_part1')}
                    <span className="text-slate-900 font-bold">{t('hero.subtitle_part2')}</span>
                    {t('hero.subtitle_part3')}
                  </p>
                </div>
                
                <div className="flex flex-col items-start md:items-end gap-3 lg:gap-4 shrink-0">
                  <div className="bg-white shadow-xl shadow-slate-200/40 rounded-[2rem] p-1.5 lg:p-2 flex items-center ring-1 ring-slate-100 group">
                    <div className="relative flex items-center">
                      <Search className="w-5 h-5 lg:w-6 lg:h-6 text-slate-400 absolute left-4 pointer-events-none group-focus-within:text-emerald-500 transition-colors" />
                      <input
                        type="text"
                        value={localSearch}
                        onChange={(e) => setLocalSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && setSearchQuery(localSearch)}
                        placeholder={t('search.placeholder')}
                        suppressHydrationWarning
                        className="bg-transparent pl-12 lg:pl-14 pr-20 lg:pr-24 py-2.5 lg:py-3 w-full sm:w-[350px] lg:w-[400px] outline-none text-sm lg:text-base text-slate-900 font-bold placeholder:text-slate-300"
                      />
                      <button
                        onClick={() => setSearchQuery(localSearch)}
                        className="absolute right-1.5 px-3 py-1.5 bg-emerald-600 text-white text-[10px] lg:text-xs font-black rounded-xl shadow-lg shadow-emerald-100 opacity-0 group-focus-within:opacity-100 hover:scale-105 active:scale-95 transition-all"
                      >
                        ENTER
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] lg:text-xs font-black text-slate-400 uppercase tracking-widest">
                    <span>{t('results.found')} {totalResultCount} {t('results.unit')}</span>
                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                    <span>{t('results.viewing_page')} {currentPage} {t('results.page_of')} {totalPages || 1}</span>
                  </div>
                </div>
              </div>

               {/* Advanced Toolbar: Sort & Paging */}
               <div 
                ref={toolbarRef}
                className="mt-8 flex flex-nowrap items-center justify-between bg-white px-4 lg:px-8 py-3.5 lg:py-5 rounded-[2rem] shadow-sm border border-slate-100 ring-1 ring-slate-50 gap-2 lg:gap-4 scale-in duration-500"
              >
                <div className="flex items-center gap-2 lg:gap-8 shrink-0">
                  {displayMode !== 'table' && (
                    <>
                      <div className="flex items-center gap-2 lg:gap-3">
                        <div 
                          className={`overflow-hidden transition-all duration-500 ease-in-out flex items-center ${
                            showLabels ? 'max-w-[150px] opacity-100 mr-2' : 'max-w-0 opacity-0'
                          }`}
                        >
                          <span className="text-[10px] lg:text-[12px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
                            {t('sort.label')}
                          </span>
                        </div>
                        <CustomDropdown
                          options={[
                            { value: 'common_name', label: t('sort.common_name') },
                            { value: 'scientific_name', label: t('sort.scientific_name') },
                            { value: 'rarity', label: t('sort.rarity') }
                          ]}
                          value={sortBy}
                          onChange={(val) => setSortBy(val)}
                        />
                      </div>
                      <div className="h-4 lg:h-6 w-px bg-slate-100" />
                    </>
                  )}
                  <div className="flex items-center gap-2 lg:gap-3">
                    <div 
                      className={`overflow-hidden transition-all duration-500 ease-in-out flex items-center ${
                        showLabels ? 'max-w-[150px] opacity-100 mr-2' : 'max-w-0 opacity-0'
                      }`}
                    >
                      <span className="text-[10px] lg:text-[12px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
                        {t('view.per_page')}
                      </span>
                    </div>
                    <div className="flex bg-slate-50 rounded-xl p-0.5 lg:p-1">
                      {PAGE_SIZE_OPTIONS[displayMode].map((size) => (
                        <button
                          key={size}
                          onClick={() => setItemsPerPage(size)}
                          className={`px-2 lg:px-3 py-1 lg:py-1.5 rounded-lg text-[10px] lg:text-xs font-black transition-all ${itemsPerPage === size ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-4 lg:h-6 w-px bg-slate-100" />
                  <div className="flex items-center gap-2 lg:gap-3">
                    <div 
                      className={`overflow-hidden transition-all duration-500 ease-in-out flex items-center ${
                        showLabels ? 'max-w-[150px] opacity-100 mr-2' : 'max-w-0 opacity-0'
                      }`}
                    >
                      <span className="text-[10px] lg:text-[12px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
                        {t('view.display_mode')}
                      </span>
                    </div>
                    <div className="flex bg-slate-50 rounded-xl p-0.5 lg:p-1">
                      <button
                        onClick={() => setDisplayMode('detail')}
                        title={t('view.mode_detail')}
                        className={`p-1 lg:p-1.5 rounded-lg transition-all ${displayMode === 'detail' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <List className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                      </button>
                      <button
                        onClick={() => setDisplayMode('photo')}
                        title={t('view.mode_photo')}
                        className={`p-1 lg:p-1.5 rounded-lg transition-all ${displayMode === 'photo' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                      </button>
                      <button
                        onClick={() => setDisplayMode('table')}
                        title={t('view.mode_table')}
                        className={`p-1 lg:p-1.5 rounded-lg transition-all ${displayMode === 'table' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <TableIcon className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mini pagination for top toolbar */}
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-2 rounded-xl border border-slate-100 text-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-black text-slate-700 px-2">{currentPage} / {totalPages || 1}</span>
                  <button
                    disabled={currentPage === totalPages || totalPages === 0}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="p-2 rounded-xl border border-slate-100 text-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Specialized Toolbar */}
            <MobileToolbar
              sortBy={sortBy}
              onSortChange={setSortBy}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
              displayMode={displayMode}
              onDisplayModeChange={setDisplayMode}
              pageSizeOptions={PAGE_SIZE_OPTIONS[displayMode]}
              totalCount={totalResultCount}
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
      {taxaType === 'flora' && isSidebarOpen && (
          <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md min-[1101px]:hidden overflow-y-auto pt-20 pb-10 px-6">
              <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl relative">
                  <button 
                    onClick={() => setIsSidebarOpen(false)}
                    className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-400"
                  >
                      <X className="w-6 h-6" />
                  </button>
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
  );
}
