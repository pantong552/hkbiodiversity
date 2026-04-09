'use client';

import { useState, useMemo, useEffect } from 'react';
import { Menu, Search, X, FilterX, LayoutGrid, List, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import SpeciesCard from '@/components/SpeciesCard';
import SidebarFilter, { SelectedFilters } from '@/components/SidebarFilter';
import Header from '@/components/Header';
import CustomDropdown from '@/components/ui/CustomDropdown';
import { Species } from '@/types/species';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import debounce from 'lodash/debounce';

export default function Home() {
  const { language, t } = useLanguage();
  const [species, setSpecies] = useState<Species[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [totalResultCount, setTotalResultCount] = useState(0);
  const [selectedFilters, setSelectedFilters] = useState<SelectedFilters>({
    taxonomy: { phylum_eng: [], class_eng: [], order_eng: [], family_eng: [], genus_eng: [] },
    iucn: []
  });

  // Sorting and Pagination State
  const [sortBy, setSortBy] = useState<'common_name' | 'scientific_name' | 'rarity'>('common_name');
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);

  // Debounced search logic
  const debouncedSetSearch = useMemo(
    () => debounce((query: string) => setDebouncedSearch(query), 300),
    []
  );

  useEffect(() => {
    debouncedSetSearch(searchQuery);
  }, [searchQuery, debouncedSetSearch]);

  const fetchSpecies = useMemo(() => {
    return async () => {
      console.log('Supabase: 正在根據條件抓取動態資料...', { debouncedSearch, selectedFilters, currentPage, sortBy });
      setIsLoading(true);
      setError(null);
      
      try {
        let query = supabase.from('species').select('*', { count: 'exact' });

        // 1. Server-side Search (Full Text / Like)
        if (debouncedSearch) {
          query = query.or(`common_name_chi.ilike.%${debouncedSearch}%,common_name_eng.ilike.%${debouncedSearch}%,scientific_name.ilike.%${debouncedSearch}%`);
        }

        // 2. Server-side Taxonomy Filtering
        Object.entries(selectedFilters.taxonomy).forEach(([level, values]) => {
          if (values.length > 0) {
            query = query.in(level, values);
          }
        });

        // 3. Server-side IUCN Filtering
        if (selectedFilters.iucn.length > 0) {
          query = query.in('iucn', selectedFilters.iucn);
        }

        // 4. Server-side Sorting
        const fieldMap: Record<string, string> = {
          'common_name': language === 'zh' ? 'common_name_chi' : 'common_name_eng',
          'scientific_name': 'scientific_name',
          'rarity': 'iucn' // 注意：IUCN 排序較複雜，此處先簡單處理
        };
        const sortField = fieldMap[sortBy] || 'common_name_chi';
        query = query.order(sortField, { ascending: true });

        // 5. Server-side Pagination
        const from = (currentPage - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) throw error;
        
        if (data) {
          setSpecies(data as Species[]);
          setTotalResultCount(count || 0);
        }
      } catch (err: any) {
        console.error('fetchSpecies 錯誤:', err);
        setError(err.message || '連線錯誤');
      } finally {
        setIsLoading(false);
      }
    };
  }, [debouncedSearch, selectedFilters, currentPage, itemsPerPage, sortBy, language]);

  useEffect(() => {
    fetchSpecies();
  }, [fetchSpecies]);

  const iucnPriority: Record<string, number> = {
    'Critically Endangered': 1,
    'Endangered': 2,
    'Vulnerable': 3,
    'Near Threatened': 4,
    'Least Concern': 5,
    'Data Deficient': 6,
    'Not Evaluated': 7,
  };

  // 已由伺服器端處理，此處僅作為佔位或簡單排序微調
  const filteredAndSortedSpecies = species;

  // Pagination Logic
  const totalPages = Math.ceil(totalResultCount / itemsPerPage);
  const paginatedSpecies = species; // 伺服器端已經分好頁了

  // Reset page when filters or itemsPerPage change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilters, searchQuery, itemsPerPage]);

  const handleFilterChange = (filters: SelectedFilters) => {
    setSelectedFilters(filters);
  };

  return (
    <div className="min-h-screen text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <Header />

      <main className="max-w-[1920px] mx-auto px-6 sm:px-10 min-[1101px]:px-16 py-10">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
          
          {/* Sidebar Area - Collapses at 1100px */}
          <div className="shrink-0 min-[1101px]:w-[320px]">
            <SidebarFilter 
              isOpen={isSidebarOpen} 
              onClose={() => setIsSidebarOpen(false)} 
              onFilterChange={handleFilterChange}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            {/* Desktop Hero & Tools - Visible on Tablet and above */}
            <div className="hidden md:flex flex-col gap-10 mb-8 pb-10 border-b border-slate-100">
              <div className="flex justify-between items-end">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-3 text-emerald-600 font-black text-xs uppercase tracking-[0.3em] mb-4">
                    <div className="h-[2px] w-8 bg-emerald-600" />
                    {t('hero.badge')}
                  </div>
                  <h1 className="text-7xl font-black text-slate-900 tracking-tight leading-[0.9] mb-6">
                    {language === 'zh' ? (
                      <>香港 <span className="text-emerald-600">生物多樣性</span></>
                    ) : (
                      <>Hong Kong <span className="text-emerald-600">Biodiversity</span></>
                    )}
                  </h1>
                  <p className="text-xl text-slate-500 font-medium leading-relaxed">
                    {t('hero.subtitle_part1')}
                    <span className="text-slate-900 font-bold">{t('hero.subtitle_part2')}</span>
                    {t('hero.subtitle_part3')}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-4">
                   <div className="bg-white shadow-xl shadow-slate-200/50 rounded-[2rem] p-2 flex items-center ring-1 ring-slate-100">
                      <div className="relative group">
                        <input 
                          type="text" 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={t('search.placeholder')} 
                          suppressHydrationWarning={true}
                          className="bg-transparent pl-12 pr-6 py-3 w-[400px] outline-none text-slate-900 font-bold placeholder:text-slate-300"
                        />
                        <Search className="w-6 h-6 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-emerald-500 transition-colors" />
                      </div>
                   </div>
                   <div className="flex items-center gap-4 text-xs font-black text-slate-400 uppercase tracking-widest">
                      <span>{t('results.found')} {totalResultCount} {t('results.unit')}</span>
                      <div className="w-1 h-1 rounded-full bg-slate-300" />
                      <span>{t('results.viewing_page')} {currentPage} {t('results.page_of')} {totalPages || 1}</span>
                   </div>
                </div>
              </div>

              {/* Advanced Toolbar: Sort & Paging */}
              <div className="flex items-center justify-between bg-white px-8 py-5 rounded-[2rem] shadow-sm border border-slate-100 ring-1 ring-slate-50">
                 <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('sort.label')}</span>
                       <CustomDropdown 
                          options={[
                            { value: 'common_name_chi', label: t('sort.common_name') },
                            { value: 'scientific_name', label: t('sort.scientific_name') },
                            { value: 'rarity', label: t('sort.rarity') }
                          ]}
                          value={sortBy === 'common_name' ? 'common_name_chi' : sortBy}
                          onChange={(val) => setSortBy(val)}
                       />
                    </div>
                    <div className="h-6 w-px bg-slate-100" />
                    <div className="flex items-center gap-3">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('view.per_page')}</span>
                       <div className="flex bg-slate-50 rounded-xl p-1">
                          {[9, 12, 15, 18, 21].map((size) => (
                             <button
                                key={size}
                                onClick={() => setItemsPerPage(size)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${itemsPerPage === size ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                             >
                                {size}
                             </button>
                          ))}
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

            {/* Empty State */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-40">
                <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
                <p className="text-slate-400 font-medium">{t('loading.message') || '正在從雲端載入 5,800+ 筆資料...'}</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-40 text-center bg-red-50 rounded-[3rem] border border-red-100">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6 text-red-500">
                  <X className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-red-900 mb-2">資料載入失敗</h3>
                <p className="text-red-600 font-medium mb-8 max-w-sm px-6">
                  錯誤訊息: {error}
                </p>
                <button 
                  onClick={() => window.location.reload()}
                  className="px-8 py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-200 hover:-translate-y-1 transition-all"
                >
                  重試連線
                </button>
              </div>
            ) : filteredAndSortedSpecies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-40 text-center bg-white rounded-[3rem] border border-dashed border-slate-200 shadow-sm">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <FilterX className="w-12 h-12 text-slate-300" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">{t('empty.title')}</h3>
                <p className="text-slate-400 font-medium mb-8 max-w-sm px-6">
                  {t('empty.subtitle')}
                </p>
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedFilters({
                      taxonomy: { phylum_eng: [], class_eng: [], order_eng: [], family_eng: [], genus_eng: [] },
                      iucn: []
                    });
                  }}
                  className="px-8 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl shadow-slate-200 hover:-translate-y-1 transition-all"
                >
                  {t('filter.clear_all')}
                </button>
              </div>
            ) : (
              /* Grid Layout */
              <div 
                key={`${currentPage}-${sortBy}-${itemsPerPage}-${searchQuery}-${JSON.stringify(selectedFilters)}`}
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4 gap-x-8 gap-y-12 animate-grid-fade"
              >
                {paginatedSpecies.map((species) => (
                  <SpeciesCard key={species.id} species={species} />
                ))}
              </div>
            )}

            {/* Full Pagination Navigation */}
            {totalPages > 1 && (
              <div className="mt-20 pt-10 border-t border-slate-200/60 flex flex-col items-center gap-6">
                <div className="flex items-center gap-2">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1 mx-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2))
                      .map((p, i, arr) => (
                        <div key={p} className="flex items-center">
                          {i > 0 && arr[i-1] !== p - 1 && <span className="px-2 text-slate-300">...</span>}
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
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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
            
            <div className="h-20" />
          </div>
        </div>
      </main>

      {/* Floating Action Button for Mobile Filter - Visible below 1100px */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="min-[1101px]:hidden fixed bottom-8 right-8 w-16 h-16 bg-emerald-600 text-white rounded-full shadow-2xl shadow-emerald-200 flex items-center justify-center z-40 animate-in fade-in zoom-in duration-300 backdrop-blur-md border border-white/20 active:scale-95 transition-transform"
        >
          <div className="relative">
            <Filter className="w-8 h-8" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-emerald-600" />
          </div>
        </button>
      )}
    </div>
  );
}
