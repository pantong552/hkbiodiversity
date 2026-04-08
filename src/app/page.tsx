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

export default function Home() {
  const { language, t } = useLanguage();
  const [species, setSpecies] = useState<Species[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<SelectedFilters>({
    taxonomy: { phylum_eng: [], class_eng: [], order_eng: [], family_eng: [], genus_eng: [] },
    iucn: []
  });

  // Sorting and Pagination State
  const [sortBy, setSortBy] = useState<'common_name' | 'scientific_name' | 'rarity'>('common_name');
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function fetchSpecies() {
      console.log('Supabase: 正在開始抓取物種資料...');
      setIsLoading(true);
      setError(null);
      try {
        const { data, error, status, statusText } = await supabase
          .from('species')
          .select('*')
          .order('common_name_chi', { ascending: true });

        console.log('Supabase Response Status:', status, statusText);

        if (error) {
          console.error('Supabase 查詢錯誤:', error);
          setError(error.message);
          throw error;
        }
        
        if (data) {
          console.log('Supabase 資料抓取成功，總筆數:', data.length);
          if (data.length === 0) {
            console.warn('警告: 資料庫回傳為空陣列 []，請檢查 species 表是否有資料。');
          }
          setSpecies(data as Species[]);
        }
      } catch (err: any) {
        console.error('fetchSpecies 捕捉到異常:', err);
        setError(err.message || '未知連線錯誤');
      } finally {
        setIsLoading(false);
      }
    }
    fetchSpecies();
  }, []);

  const iucnPriority: Record<string, number> = {
    'Critically Endangered': 1,
    'Endangered': 2,
    'Vulnerable': 3,
    'Near Threatened': 4,
    'Least Concern': 5,
    'Data Deficient': 6,
    'Not Evaluated': 7,
  };

  // Filter & Sort Logic
  const filteredAndSortedSpecies = useMemo(() => {
    let result = species.filter(s => {
      // 1. Text Search
      const matchesSearch = searchQuery === '' || 
        [s.common_name_chi, s.common_name_eng, s.scientific_name, s.phylum_eng, s.phylum_chi, s.class_eng, s.class_chi, s.order_eng, s.order_chi, s.family_eng, s.family_chi, s.genus_eng, s.genus_chi]
          .some(attr => attr && attr.toLowerCase().includes(searchQuery.toLowerCase()));

      // 2. Taxonomy Filter
      const matchesTaxonomy = Object.entries(selectedFilters.taxonomy).every(([level, values]) => {
        if (values.length === 0) return true;
        const speciesValue = s[level as keyof Species] as string;
        return values.includes(speciesValue);
      });

      // 3. IUCN Filter
      const matchesIUCN = selectedFilters.iucn.length === 0 || 
        selectedFilters.iucn.includes(s.iucn);

      return matchesSearch && matchesTaxonomy && matchesIUCN;
    });

    // Sort Results
    return result.sort((a, b) => {
      if (sortBy === 'rarity') {
        return (iucnPriority[a.iucn] || 99) - (iucnPriority[b.iucn] || 99);
      }
      
      const field = (sortBy === 'common_name' && language === 'en') ? 'common_name_eng' : (sortBy === 'common_name' ? 'common_name_chi' : sortBy);
      return (a[field as keyof Species] as string).localeCompare(b[field as keyof Species] as string, language === 'zh' ? 'zh-TW' : 'en');
    });
  }, [species, searchQuery, selectedFilters, sortBy, language]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredAndSortedSpecies.length / itemsPerPage);
  const paginatedSpecies = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedSpecies.slice(start, start + itemsPerPage);
  }, [filteredAndSortedSpecies, currentPage, itemsPerPage]);

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
              species={species}
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
                      <span>{t('results.found')} {filteredAndSortedSpecies.length} {t('results.unit')}</span>
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
                            onClick={() => setCurrentPage(p)}
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
                  {t('pagination.showing')} {Math.min(filteredAndSortedSpecies.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredAndSortedSpecies.length, currentPage * itemsPerPage)} {t('pagination.of')} {filteredAndSortedSpecies.length} {t('pagination.species')}
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
