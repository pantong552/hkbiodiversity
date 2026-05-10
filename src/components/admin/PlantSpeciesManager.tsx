'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { useClickOutside } from '@/hooks/useClickOutside';
import { 
  Search, 
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  X,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTaxonomy } from '@/context/TaxonomyContext';
import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown';
import AlertModal from '@/components/ui/AlertModal';

interface PlantSpeciesData {
  taxa_id: string;
  category_eng: string;
  scientific_name: string;
  common_name_eng: string;
  common_name_chi: string;
  family_eng: string;
  genus_eng: string;
  species_eng: string;
}

type SortKey = keyof PlantSpeciesData;
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 50;

export default function PlantSpeciesManager() {
  const { language, t } = useLanguage();
  const { getTaxonomyChi } = useTaxonomy();
  const supabase = createClient();
  
  const [data, setData] = useState<PlantSpeciesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [multiFilters, setMultiFilters] = useState<Record<string, string[]>>({});
  const [isBilingual, setIsBilingual] = useState(false);
  
  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ 
    key: 'taxa_id', 
    direction: 'asc' 
  });

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<PlantSpeciesData>>({});
  const [originalValues, setOriginalValues] = useState<Partial<PlantSpeciesData>>({});
  const [saving, setSaving] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Column Resizing
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    taxa_id: 100,
    category_eng: 120,
    scientific_name: 250,
    common_name_eng: 180,
    common_name_chi: 150,
    family_eng: 150,
    genus_eng: 120,
    species_eng: 120
  });

  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  const handleMouseDown = (key: string, e: React.MouseEvent) => {
    resizingRef.current = {
      key,
      startX: e.pageX,
      startWidth: columnWidths[key]
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { key, startX, startWidth } = resizingRef.current;
    const deltaX = e.pageX - startX;
    const newWidth = Math.max(60, startWidth + deltaX);
    setColumnWidths(prev => ({ ...prev, [key]: newWidth }));
  };

  const handleMouseUp = () => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  // Fetch Species Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let allSpecies: PlantSpeciesData[] = [];
      let offset = 0;
      const limit = 1000;

      while (true) {
        const { data, error } = await supabase
          .from('plant_species')
          .select('*')
          .range(offset, offset + limit - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allSpecies = [...allSpecies, ...(data as unknown as PlantSpeciesData[])];
        if (data.length < limit) break;
        offset += limit;
      }
      
      setData(allSpecies);
    } catch (err) {
      console.error('Error fetching plant species data:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Edit Actions
  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditValues({});
    setOriginalValues({});
    setShowDiscardConfirm(false);
  }, []);

  const startEditing = useCallback((item: PlantSpeciesData) => {
    setEditingId(item.taxa_id);
    const vals = { ...item };
    setEditValues(vals);
    setOriginalValues(vals);
  }, []);

  const isDirty = useMemo(() => {
    if (!editingId) return false;
    return JSON.stringify(editValues) !== JSON.stringify(originalValues);
  }, [editValues, originalValues, editingId]);

  const handleExitAttempt = useCallback(() => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      cancelEditing();
    }
  }, [isDirty, cancelEditing]);

  const editingRowRef = useClickOutside(() => {
    if (editingId && !showDiscardConfirm) {
      handleExitAttempt();
    }
  });

  // Global Keyboard Listener for Esc when editing
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingId && !showDiscardConfirm) {
        handleExitAttempt();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [editingId, showDiscardConfirm, handleExitAttempt]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // 1. Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        (item.scientific_name?.toLowerCase() || '').includes(q) ||
        (item.common_name_eng?.toLowerCase() || '').includes(q) ||
        (item.common_name_chi?.toLowerCase() || '').includes(q)
      );
    }

    // 2. Multi-column Filters
    Object.entries(multiFilters).forEach(([key, values]) => {
      if (values && values.length > 0) {
        result = result.filter(item => values.includes(String((item as any)[key] || '')));
      }
    });

    // 3. Sort
    result.sort((a, b) => {
      let aVal: any = a[sortConfig.key];
      let bVal: any = b[sortConfig.key];

      // Natural Sort for taxa_id (Handle "flora_")
      if (sortConfig.key === 'taxa_id') {
        const aNum = parseInt(String(aVal).replace('flora_', ''), 10) || 0;
        const bNum = parseInt(String(bVal).replace('flora_', ''), 10) || 0;
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, searchQuery, sortConfig, multiFilters]);

  const paginatedData = useMemo(() => {
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE;
    return filteredAndSortedData.slice(from, to);
  }, [filteredAndSortedData, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedData.length / PAGE_SIZE);

  // Handle Edit
  const handleEditChange = (key: keyof PlantSpeciesData, value: string) => {
    setEditValues(prev => ({ ...prev, [key]: value }));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('plant_species')
        .update(editValues)
        .eq('taxa_id', editingId);

      if (error) throw error;

      // Update local data
      setData(prev => prev.map(item => item.taxa_id === editingId ? { ...item, ...editValues } as PlantSpeciesData : item));
      setEditingId(null);
      setEditValues({});
      setOriginalValues({});
    } catch (err) {
      console.error('Error saving plant edit:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleExitAttempt();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      saveEdit();
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 text-slate-200 transition-colors" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />;
  };

  // Compute options for each filter
  const filterOptions = useMemo(() => {
    const options: Record<string, { name: string; display: string; count: number }[]> = {};
    
    Object.keys(columnWidths).forEach(key => {
      const otherFilters = { ...multiFilters };
      delete otherFilters[key];

      const intermediateResult = data.filter(item => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matches = (item.scientific_name?.toLowerCase() || '').includes(q) ||
                        (item.common_name_eng?.toLowerCase() || '').includes(q) ||
                        (item.common_name_chi?.toLowerCase() || '').includes(q);
          if (!matches) return false;
        }

        return Object.entries(otherFilters).every(([fKey, fValues]) => {
          if (!fValues || fValues.length === 0) return true;
          return fValues.includes(String((item as any)[fKey] || ''));
        });
      });

      const counts: Record<string, number> = {};
      intermediateResult.forEach(item => {
        const val = String((item as any)[key] || '');
        counts[val] = (counts[val] || 0) + 1;
      });

      options[key] = Object.entries(counts).map(([name, count]) => {
        let display = name;
        if (!name) display = language === 'zh' ? '(空白)' : '(Empty)';
        
        if (isBilingual && ['category_eng', 'family_eng', 'genus_eng', 'species_eng'].includes(key) && name) {
          const rank = key.replace('_eng', '');
          const translated = getTaxonomyChi(rank, 'flora', name);
          if (translated && translated !== name) {
            display = `${translated} (${name})`;
          }
        }

        return { name, display, count };
      }).sort((a, b) => b.count - a.count);
    });

    return options;
  }, [data, multiFilters, searchQuery, language, isBilingual, getTaxonomyChi, columnWidths]);

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Search Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div className="flex flex-col gap-1 w-full max-w-xl">
          <div className="flex items-center gap-3">
            <div className="relative group flex-1">
              <div className="absolute inset-0 bg-emerald-500/5 blur-xl rounded-2xl transition-all group-focus-within:bg-emerald-500/10" />
              <div className="relative flex items-center bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl px-4 py-2 transition-all focus-within:border-emerald-400">
                <Search className="w-4 h-4 text-slate-400 mr-2.5" />
                <input 
                  type="text" 
                  placeholder={t('search.placeholder')}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full bg-transparent border-none outline-none text-slate-700 text-sm font-medium placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-white/40 border border-white rounded-full text-[10px] font-bold text-slate-500 flex items-center gap-2">
            <Database className="w-3 h-3 text-emerald-500" />
            <span className="text-emerald-600 font-black">
              {t('admin.total_ratio')
                .replace('{filtered}', String(filteredAndSortedData.length))
                .replace('{total}', String(data.length))}
            </span>
          </div>
          {searchQuery && (
            <button 
              onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
              className="px-3 py-1 text-[10px] font-black text-red-500 hover:bg-red-50 rounded-full transition-colors"
            >
              {t('admin.clear_all')}
            </button>
          )}
          {Object.values(multiFilters).some(v => v.length > 0) && (
            <button 
              onClick={() => { setMultiFilters({}); setCurrentPage(1); }}
              className="px-3 py-1 text-[10px] font-black text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-full transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              {language === 'zh' ? '重設所有過濾器' : 'Reset All Filters'}
            </button>
          )}

          <button 
            onClick={() => setIsBilingual(!isBilingual)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-all duration-300 group ${
              isBilingual 
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-200' 
                : 'bg-white/60 text-slate-500 border-white/80 hover:bg-white/80'
            }`}
          >
            <div className="relative w-7 h-4 bg-slate-200 rounded-full transition-colors group-hover:bg-slate-300 p-0.5">
              <motion.div 
                animate={{ x: isBilingual ? 12 : 0 }}
                className={`w-3 h-3 rounded-full shadow-sm transition-colors ${isBilingual ? 'bg-white' : 'bg-slate-400'}`}
              />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">
              {language === 'zh' ? '雙語顯示' : 'Bilingual'}
            </span>
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
          <p className="text-slate-400 text-xs font-medium">{t('loading.message')}</p>
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-auto rounded-[1.5rem] border border-white bg-white/30 backdrop-blur-xl shadow-sm custom-scrollbar">
            <table className="w-max text-left border-collapse table-fixed">
              <thead className="sticky top-0 z-40 bg-slate-50 shadow-sm">
                <tr className="border-b border-slate-100">
                  {Object.keys(columnWidths).map((key) => (
                    <th 
                      key={key}
                      style={{ width: columnWidths[key] }}
                      className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest relative group/header overflow-visible"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div 
                          className="flex items-center gap-1 cursor-pointer hover:text-emerald-600 transition-colors shrink-0"
                          onClick={() => requestSort(key as SortKey)}
                        >
                          <span className="whitespace-nowrap">{t(`admin.${key}`)}</span>
                          <SortIcon column={key as SortKey} />
                        </div>
                        
                        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                          <MultiSelectDropdown
                            label={t(`admin.${key}`)}
                            options={filterOptions[key] || []}
                            selectedValues={multiFilters[key] || []}
                            onChange={(values) => {
                              setMultiFilters(prev => ({ ...prev, [key]: values }));
                              setCurrentPage(1);
                            }}
                            placeholder={language === 'zh' ? '搜尋...' : 'Search...'}
                            align="right"
                            minWidth="200px"
                            variant="minimal"
                          />
                        </div>
                      </div>
                      
                      <div 
                        onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(key, e); }}
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group-hover/header:bg-emerald-500/20 active:bg-emerald-500 transition-colors z-30"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white/20">
                {paginatedData.map((item) => {
                  const isEditing = editingId === item.taxa_id;
                  
                  return (
                    <tr 
                      key={item.taxa_id} 
                      ref={isEditing ? (editingRowRef as React.RefObject<HTMLTableRowElement>) : null}
                      onClick={() => !isEditing && startEditing(item)}
                      className={`transition-all duration-300 group border-b border-white/10 ${
                        isEditing 
                          ? 'bg-emerald-50/80 shadow-inner' 
                          : 'hover:bg-emerald-50/60 hover:shadow-lg hover:shadow-slate-200/40 cursor-pointer'
                      }`}
                    >
                      <td className="px-4 py-2 text-[12px] font-bold text-slate-500">{item.taxa_id}</td>
                      
                      {/* Category */}
                      <td className="px-4 py-2 text-[12px] font-medium text-slate-700">
                        {isEditing ? (
                          <input 
                            value={editValues.category_eng || ''} 
                            onChange={(e) => handleEditChange('category_eng', e.target.value)}
                            className="w-full bg-white border border-emerald-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            onKeyDown={handleKeyDown}
                            autoFocus
                          />
                        ) : (
                          <div className="flex flex-col min-h-[1.4rem] justify-center">
                            {isBilingual && (
                              <motion.span 
                                initial={{ opacity: 0, y: -2 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-[11px] font-black text-emerald-600 leading-none mb-0.5"
                              >
                                {getTaxonomyChi('category_eng', 'flora', item.category_eng)}
                              </motion.span>
                            )}
                            <span className={`transition-all duration-300 ${isBilingual ? 'text-[10px] opacity-60' : 'text-[12px]'}`}>
                              {item.category_eng}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-2 text-[13px] font-black text-emerald-700 italic">
                        {isEditing ? (
                          <input 
                            value={editValues.scientific_name || ''} 
                            onChange={(e) => handleEditChange('scientific_name', e.target.value)}
                            className="w-full bg-white border border-emerald-200 rounded px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-emerald-500 italic"
                            onKeyDown={handleKeyDown}
                          />
                        ) : item.scientific_name}
                      </td>

                      <td className="px-4 py-2 text-[12px] font-bold text-slate-600">
                        {isEditing ? (
                          <input 
                            value={editValues.common_name_eng || ''} 
                            onChange={(e) => handleEditChange('common_name_eng', e.target.value)}
                            className="w-full bg-white border border-emerald-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            onKeyDown={handleKeyDown}
                          />
                        ) : item.common_name_eng}
                      </td>

                      <td className="px-4 py-2 text-[14px] font-black text-slate-900">
                        {isEditing ? (
                          <input 
                            value={editValues.common_name_chi || ''} 
                            onChange={(e) => handleEditChange('common_name_chi', e.target.value)}
                            className="w-full bg-white border border-emerald-200 rounded px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            onKeyDown={handleKeyDown}
                          />
                        ) : item.common_name_chi}
                      </td>

                      {['family_eng', 'genus_eng', 'species_eng'].map((key) => {
                        const rank = key.replace('_eng', '');
                        const englishValue = (item as any)[key];
                        const chineseValue = (isBilingual && key !== 'species_eng') ? getTaxonomyChi(rank, 'flora', englishValue) : null;

                        return (
                          <td key={key} className="px-4 py-2 text-[11px] font-bold text-slate-400">
                            {isEditing ? (
                              <input 
                                value={englishValue || ''} 
                                onChange={(e) => handleEditChange(key as any, e.target.value)}
                                className="w-full bg-white border border-emerald-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                onKeyDown={handleKeyDown}
                              />
                            ) : (
                              <div className="flex flex-col min-h-[1.4rem] justify-center">
                                {isBilingual && chineseValue && (
                                  <motion.span 
                                    initial={{ opacity: 0, y: -2 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-[11px] font-black text-emerald-600 leading-none mb-0.5"
                                  >
                                    {chineseValue}
                                  </motion.span>
                                )}
                                <span className={`transition-all duration-300 ${isBilingual && chineseValue ? 'text-[10px] opacity-60' : 'text-[11px]'}`}>
                                  {englishValue}
                                </span>
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {isEditing && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={saveEdit}
                              disabled={saving}
                              className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50"
                            >
                              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                            </button>
                            <button 
                              onClick={cancelEditing}
                              className="p-1.5 bg-slate-200 text-slate-500 rounded-lg hover:bg-slate-300 transition-colors shadow-sm"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between py-2 border-t border-slate-50 flex-shrink-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {t('admin.showing')
                .replace('{start}', String((currentPage - 1) * PAGE_SIZE + 1))
                .replace('{end}', String(Math.min(currentPage * PAGE_SIZE, filteredAndSortedData.length)))
                .replace('{total}', String(filteredAndSortedData.length))}
            </p>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-xl border border-white bg-white/40 text-slate-400 disabled:opacity-30 hover:bg-white transition-all shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-1">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  
                  return (
                    <button 
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all ${currentPage === pageNum ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white/40 text-slate-400 hover:bg-white'}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl border border-white bg-white/40 text-slate-400 disabled:opacity-30 hover:bg-white transition-all shadow-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      <AlertModal
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={cancelEditing}
        title={language === 'zh' ? '尚未儲存變更' : 'Unsaved Changes'}
        description={language === 'zh' 
          ? '您剛才進行了修改，如果不儲存直接退出，所有變更將會遺失。確定要退出嗎？' 
          : 'You have made changes. If you leave without saving, your changes will be lost. Are you sure?'}
        confirmLabel={language === 'zh' ? '不儲存並退出' : 'Discard & Exit'}
        cancelLabel={language === 'zh' ? '繼續編輯' : 'Continue Editing'}
        type="warning"
      />
    </div>
  );
}
