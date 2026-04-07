'use client';

import { useState, useMemo, useEffect } from 'react';
import { Menu, Search, X, FilterX, LayoutGrid, List, ChevronLeft, ChevronRight } from 'lucide-react';
import SpeciesCard from '@/components/SpeciesCard';
import SidebarFilter, { SelectedFilters } from '@/components/SidebarFilter';
import { MOCK_SPECIES } from '@/data/mockSpecies';
import { Species } from '@/types/species';

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<SelectedFilters>({
    taxonomy: { kingdom: [], phylum: [], class: [], order: [], family: [], genus: [] },
    rarity: []
  });

  // Sorting and Pagination State
  const [sortBy, setSortBy] = useState<'common_name' | 'scientific_name' | 'rarity'>('common_name');
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);

  const rarityPriority: Record<string, number> = {
    '極危': 1,
    '瀕危': 2,
    '易危': 3,
    '近危': 4,
    '常見': 5,
  };

  // Filter & Sort Logic
  const filteredAndSortedSpecies = useMemo(() => {
    let result = MOCK_SPECIES.filter(s => {
      // 1. Text Search
      const matchesSearch = searchQuery === '' || 
        [s.common_name, s.scientific_name, s.kingdom, s.phylum, s.class, s.order, s.family, s.genus]
          .some(attr => attr.toLowerCase().includes(searchQuery.toLowerCase()));

      // 2. Taxonomy Filter
      const matchesTaxonomy = Object.entries(selectedFilters.taxonomy).every(([level, values]) => {
        if (values.length === 0) return true;
        const speciesValue = s[level as keyof Species] as string;
        return values.includes(speciesValue);
      });

      // 3. Rarity Filter
      const matchesRarity = selectedFilters.rarity.length === 0 || 
        selectedFilters.rarity.includes(s.rarity);

      return matchesSearch && matchesTaxonomy && matchesRarity;
    });

    // Sort Results
    return result.sort((a, b) => {
      if (sortBy === 'rarity') {
        return (rarityPriority[a.rarity] || 99) - (rarityPriority[b.rarity] || 99);
      }
      return a[sortBy].localeCompare(b[sortBy], 'zh-TW');
    });
  }, [searchQuery, selectedFilters, sortBy]);

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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-cyan-100 selection:text-cyan-900">
      {/* Premium Floating Header (Mobile Only) */}
      <header className="lg:hidden bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex flex-col">
          <h1 className="text-lg font-black text-slate-900 tracking-tighter leading-none">
            HK BIO<span className="text-cyan-500">DIVERSITY</span>
          </h1>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Encyclopedia</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="w-10 h-10 flex items-center justify-center bg-slate-900 text-white rounded-full shadow-lg shadow-slate-200 active:scale-95 transition-transform"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto px-6 sm:px-10 lg:px-16 py-10 lg:py-16">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
          
          {/* Sidebar Area */}
          <div className="shrink-0 lg:w-[320px]">
            <SidebarFilter 
              isOpen={isSidebarOpen} 
              onClose={() => setIsSidebarOpen(false)} 
              species={MOCK_SPECIES}
              onFilterChange={handleFilterChange}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            {/* Desktop Hero & Tools */}
            <div className="hidden lg:flex flex-col gap-10 mb-16 pb-12 border-b border-slate-100">
              <div className="flex justify-between items-end">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-3 text-cyan-500 font-black text-xs uppercase tracking-[0.3em] mb-4">
                    <div className="h-[2px] w-8 bg-cyan-500" />
                    Nature Directory
                  </div>
                  <h1 className="text-6xl font-black text-slate-900 tracking-tight leading-[0.9] mb-6">
                    探索萬物之美
                  </h1>
                  <p className="text-xl text-slate-500 font-medium leading-relaxed">
                    收錄超過 <span className="text-slate-900 font-bold">10,000</span> 種物種的數位資料庫，
                    <br />為您呈現香港最完整的生物多樣性圖錄。
                  </p>
                </div>
                <div className="flex flex-col items-end gap-4">
                   <div className="bg-white shadow-xl shadow-slate-200/50 rounded-[2rem] p-2 flex items-center ring-1 ring-slate-100">
                      <div className="relative group">
                        <input 
                          type="text" 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="快速搜尋俗名、學名..." 
                          className="bg-transparent pl-12 pr-6 py-3 w-[400px] outline-none text-slate-900 font-bold placeholder:text-slate-300"
                        />
                        <Search className="w-6 h-6 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-cyan-500 transition-colors" />
                      </div>
                   </div>
                   <div className="flex items-center gap-4 text-xs font-black text-slate-400 uppercase tracking-widest">
                      <span>Found {filteredAndSortedSpecies.length} Results</span>
                      <div className="w-1 h-1 rounded-full bg-slate-300" />
                      <span>Viewing Page {currentPage} of {totalPages || 1}</span>
                   </div>
                </div>
              </div>

              {/* Advanced Toolbar: Sort & Paging */}
              <div className="flex items-center justify-between bg-white px-8 py-5 rounded-[2rem] shadow-sm border border-slate-100 ring-1 ring-slate-50">
                 <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">排序方式</span>
                       <select 
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as any)}
                          className="bg-slate-50 border-none rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-cyan-100 transition-all cursor-pointer"
                       >
                          <option value="common_name">俗名 (A-Z)</option>
                          <option value="scientific_name">學名 (A-Z)</option>
                          <option value="rarity">稀有度 (高級優先)</option>
                       </select>
                    </div>
                    <div className="h-6 w-px bg-slate-100" />
                    <div className="flex items-center gap-3">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">每頁顯示</span>
                       <div className="flex bg-slate-50 rounded-xl p-1">
                          {[9, 12, 15, 18, 21].map((size) => (
                             <button
                                key={size}
                                onClick={() => setItemsPerPage(size)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${itemsPerPage === size ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
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
            {filteredAndSortedSpecies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-40 text-center bg-white rounded-[3rem] border border-dashed border-slate-200 shadow-sm">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <FilterX className="w-12 h-12 text-slate-300" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">找不到匹配的物種</h3>
                <p className="text-slate-400 font-medium mb-8 max-w-sm px-6">
                  請嘗試放寬篩選條件，或使用不同的搜尋字串進行檢索。
                </p>
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedFilters({
                      taxonomy: { kingdom: [], phylum: [], class: [], order: [], family: [], genus: [] },
                      rarity: []
                    });
                  }}
                  className="px-8 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl shadow-slate-200 hover:-translate-y-1 transition-all"
                >
                  清除所有篩選
                </button>
              </div>
            ) : (
              /* Grid Layout */
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4 gap-x-8 gap-y-12 animate-in fade-in duration-700">
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
                            className={`w-10 h-10 rounded-xl text-sm font-black transition-all ${currentPage === p ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-200' : 'text-slate-500 hover:bg-slate-100'}`}
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
                  Showing {Math.min(filteredAndSortedSpecies.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredAndSortedSpecies.length, currentPage * itemsPerPage)} of {filteredAndSortedSpecies.length} Species
                </p>
              </div>
            )}
            
            <div className="h-20" />
          </div>
        </div>
      </main>
    </div>
  );
}
