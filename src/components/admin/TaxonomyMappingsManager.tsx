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
  Filter,
  Check,
  ChevronDown,
  ShieldCheck,
  Edit2,
  AlertCircle,
  ChevronRight,
  Database,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTaxonomy } from '@/context/TaxonomyContext';
import AlertModal from '@/components/ui/AlertModal';

interface TaxonomyMappingsManagerProps {
  mode: 'fauna' | 'flora';
  onRequestConfirm: (action: () => Promise<void>, title?: string, message?: string) => void;
}

interface TaxonomyMapping {
  id?: number | string;
  rank: string;
  taxa_type: string;
  taxa_group?: string;
  name_eng: string;
  name_chi: string;
  species_count?: number;
  is_from_mappings?: boolean;
}

type SortKey = 'rank' | 'name_eng' | 'name_chi' | 'taxa_group' | 'species_count';
type SortDirection = 'asc' | 'desc';

// Define the mapping between internal ranks and database columns
const RANK_FIELD_MAP = {
  fauna: {
    informal_group: 'informal_group_eng',
    class: 'class_eng',
    order: 'order_eng',
    family: 'family_eng',
    genus: 'genus_eng'
  } as Record<string, string>,
  flora: {
    category: 'category_eng',
    family: 'family_eng',
    genus: 'genus_eng'
  } as Record<string, string>
};

export default function TaxonomyMappingsManager({ mode, onRequestConfirm }: TaxonomyMappingsManagerProps) {
  const { language, t } = useLanguage();
  const { getTaxonomyChi } = useTaxonomy();
  const supabase = createClient();
  const [data, setData] = useState<TaxonomyMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | number | null>(null);

  // Inline Editing State (New Row-based system)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [originalItem, setOriginalItem] = useState<TaxonomyMapping | null>(null);
  const [editValues, setEditValues] = useState<Partial<TaxonomyMapping>>({});
  const [saving, setSaving] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sorting & Filtering State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ 
    key: 'name_eng', 
    direction: 'asc' 
  });
  const [rankFilters, setRankFilters] = useState<string[]>([]);
  const [showRankFilter, setShowRankFilter] = useState(false);
  const [groupFilters, setGroupFilters] = useState<string[]>([]);
  const [showGroupFilter, setShowGroupFilter] = useState(false);
  const [showMissingOnly, setShowMissingOnly] = useState(false);

  // Column Resizing State
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    rank: 100,
    taxa_group: 250,
    name_eng: 220,
    name_chi: 250,
    species_count: 100
  });

  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  const isDirty = useMemo(() => {
    if (!editingId) return false;
    return JSON.stringify(editValues) !== JSON.stringify(originalItem);
  }, [editValues, originalItem, editingId]);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setOriginalItem(null);
    setEditValues({});
    setShowDiscardConfirm(false);
  }, []);

  const handleExitAttempt = useCallback(() => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      cancelEditing();
    }
  }, [isDirty, cancelEditing]);

  // Click Outside Refs
  const rankFilterRef = useClickOutside(() => setShowRankFilter(false));
  const groupFilterRef = useClickOutside(() => setShowGroupFilter(false));
  const editingRowRef = useClickOutside(() => {
    if (editingId && !showDiscardConfirm) {
      handleExitAttempt();
    }
  });

  // Global Keyboard Listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingId && !showDiscardConfirm) {
        handleExitAttempt();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [editingId, showDiscardConfirm, handleExitAttempt]);

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
    const newWidth = Math.max(80, startWidth + deltaX);
    setColumnWidths(prev => ({ ...prev, [key]: newWidth }));
  };

  const handleMouseUp = () => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  const uniqueRanks = useMemo(() => {
    const ranks = Array.from(new Set(data.map(d => d.rank)));
    return ranks.sort((a, b) => {
      const order = ['informal_group', 'category', 'class', 'order', 'family', 'genus'];
      return order.indexOf(a) - order.indexOf(b);
    });
  }, [data]);

  const uniqueGroups = useMemo(() => {
    const groups = Array.from(new Set(data.map(d => d.taxa_group).filter(Boolean))) as string[];
    return groups.sort();
  }, [data]);

  useEffect(() => {
    if (mode === 'fauna') {
      setGroupFilters(['Amphibian']);
    } else {
      setGroupFilters(['Angiosperms (Dicotyledons)']);
    }
  }, [mode]);

  useEffect(() => {
    fetchData();
  }, [mode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const taxaType = mode === 'fauna' ? 'fauna' : 'flora';
      const targetTable = mode === 'fauna' ? 'species' : 'plant_species';
      const rankFields = RANK_FIELD_MAP[mode];

      // 1. Fetch ALL taxonomy names from species/plant_species table (with pagination)
      const distinctPromises = Object.entries(rankFields).map(async ([rank, field]) => {
        const selectFields = mode === 'fauna' ? `${field}, taxa_group` : `${field}, category_eng`;
        const uniqueMap = new Map<string, { group: string; count: number }>();
        let offset = 0;
        const limit = 1000;

        while (true) {
          const { data: batchData, error } = await supabase
            .from(targetTable)
            .select(selectFields)
            .not(field, 'is', null)
            .range(offset, offset + limit - 1);
          
          if (error) throw error;
          if (!batchData || batchData.length === 0) break;

          batchData.forEach((item: any) => {
            const name = (item[field] as string || '').trim();
            if (name) {
              const group = (item as any).taxa_group || (mode === 'flora' ? (item as any).category_eng : '');
              const key = `${name}||${group}`;
              
              const current = uniqueMap.get(key) || { group, count: 0 };
              uniqueMap.set(key, { ...current, count: current.count + 1 });
            }
          });

          if (batchData.length < limit) break;
          offset += limit;
        }

        return Array.from(uniqueMap.entries()).map(([key, info]) => {
          const [name] = key.split('||');
          return { rank, name_eng: name, taxa_group: info.group, species_count: info.count };
        });
      });

      const rawResults = await Promise.all(distinctPromises);
      const speciesTaxaList = rawResults.flat();

      // 2. Fetch all mappings for this taxa_type
      let allMappings: any[] = [];
      let offset = 0;
      const limit = 1000;
      while (true) {
        const { data: mappingsData, error } = await supabase
          .from('taxonomy_mappings')
          .select('*')
          .eq('taxa_type', taxaType)
          .range(offset, offset + limit - 1);
        
        if (error) throw error;
        if (!mappingsData || mappingsData.length === 0) break;
        allMappings = [...allMappings, ...mappingsData];
        if (mappingsData.length < limit) break;
        offset += limit;
      }

      // 3. Merge data
      const mergedData: TaxonomyMapping[] = speciesTaxaList.map(st => {
        const mapping = allMappings.find(m => m.rank === st.rank && m.name_eng.trim().toLowerCase() === st.name_eng.trim().toLowerCase());
        return {
          id: mapping?.id,
          rank: st.rank,
          taxa_type: taxaType,
          taxa_group: st.taxa_group,
          name_eng: st.name_eng,
          name_chi: mapping?.name_chi || '',
          species_count: st.species_count,
          is_from_mappings: !!mapping
        };
      });

      setData(mergedData);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (rowId: string, item: TaxonomyMapping) => {
    setEditingId(rowId);
    setOriginalItem({ ...item });
    setEditValues({ ...item });
  };

  const handleEditChange = (field: keyof TaxonomyMapping, value: string) => {
    setEditValues(prev => ({ ...prev, [field]: value }));
  };

  const saveEdit = async () => {
    if (!editingId || !originalItem) return;
    setSaving(true);
    try {
      const item = originalItem;

      const taxaType = mode === 'fauna' ? 'fauna' : 'flora';
      const targetTable = mode === 'fauna' ? 'species' : 'plant_species';
      const dbField = RANK_FIELD_MAP[mode][item.rank];

      const newNameEng = (editValues.name_eng !== undefined ? editValues.name_eng : item.name_eng).trim();
      const newNameChi = (editValues.name_chi !== undefined ? editValues.name_chi : item.name_chi).trim();
      const oldNameEng = item.name_eng.trim();

      let savedId = item.id;

      // 1. Sync with taxonomy_mappings table
      if (savedId) {
        // Update existing mapping by ID
        const { data: updatedData, error } = await supabase
          .from('taxonomy_mappings')
          .update({
            name_eng: newNameEng,
            name_chi: newNameChi
          })
          .eq('id', savedId)
          .select('id')
          .single();
        if (error) throw error;
        if (updatedData) savedId = updatedData.id;
      } else if (newNameChi || newNameEng) {
        // Create new mapping or upsert if key exists
        const { data: insertedData, error } = await supabase
          .from('taxonomy_mappings')
          .upsert(
            {
              rank: item.rank,
              taxa_type: taxaType,
              name_eng: newNameEng,
              name_chi: newNameChi
            },
            { onConflict: 'rank,taxa_type,name_eng' }
          )
          .select('id')
          .single();
        if (error) throw error;
        if (insertedData) savedId = insertedData.id;
      }

      // 2. Sync with species/plant_species table if name_eng changed
      if (dbField && newNameEng && newNameEng !== oldNameEng) {
        const { error: syncError } = await supabase
          .from(targetTable)
          .update({ [dbField]: newNameEng })
          .eq(dbField, oldNameEng);
        if (syncError) throw syncError;
      }

      // 3. Update local state immediately for instant feedback
      setData(prev => prev.map(d => {
        // Find matching row to keep in sync
        const isTarget = (savedId && d.id === savedId) || (d.rank === item.rank && d.name_eng.trim() === oldNameEng);
        if (isTarget) {
          return { 
            ...d, 
            id: savedId || d.id,
            name_eng: newNameEng || d.name_eng, 
            name_chi: newNameChi,
            is_from_mappings: true
          };
        }
        return d;
      }));

      setEditingId(null);
      setOriginalItem(null);
      setEditValues({});
    } catch (err: any) {
      console.error('Error saving edit:', err);
      // Log more details for Supabase errors
      if (err.code || err.details || err.hint) {
        console.error('Supabase Error Details:', {
          code: err.code,
          details: err.details,
          hint: err.hint,
          message: err.message
        });
      }
      setErrorMessage(err.message || (typeof err === 'string' ? err : JSON.stringify(err)) || 'An unexpected error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleExitAttempt();
    } else if (e.key === 'Enter') {
      // 避免中文輸入法選字 (IME Composing) 時誤觸發儲存
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      saveEdit();
    }
  };

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    if (groupFilters.length > 0) {
      result = result.filter(item => item.taxa_group && groupFilters.includes(item.taxa_group));
    }

    if (showMissingOnly) {
      result = result.filter(m => !m.name_chi || m.name_chi.trim() === '');
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m => 
        (m.name_eng?.toLowerCase() || '').includes(q) ||
        (m.name_chi?.toLowerCase() || '').includes(q)
      );
    }

    if (rankFilters.length > 0) {
      result = result.filter(m => rankFilters.includes(m.rank));
    }

    result.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const sA = String(aVal || '').toLowerCase();
      const sB = String(bVal || '').toLowerCase();
      if (sA < sB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (sA > sB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, searchQuery, rankFilters, groupFilters, sortConfig, showMissingOnly]);

  const toggleFilter = (list: string[], setList: (l: string[]) => void, value: string) => {
    if (list.includes(value)) {
      setList(list.filter(v => v !== value));
    } else {
      setList([...list, value]);
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 text-slate-200 transition-colors" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />;
  };

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Search Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1 w-full max-w-xl">
          <div className="flex items-center gap-3">
            {/* Taxa Group Filter Dropdown */}
            <div className="relative" ref={groupFilterRef}>
              <button 
                onClick={() => setShowGroupFilter(!showGroupFilter)}
                className={`flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl text-xs font-bold transition-all hover:bg-white/80 ${groupFilters.length > 0 ? 'text-emerald-600 border-emerald-200' : 'text-slate-500'}`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>{groupFilters.length === 0 ? t('admin.taxa_group') : `${t('admin.taxa_group')} (${groupFilters.length})`}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showGroupFilter ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showGroupFilter && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl shadow-slate-200/50 border border-slate-100 p-2 z-[60]"
                  >
                    <div className="px-2 py-1.5 mb-1 border-b border-slate-50 flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('admin.taxa_group')}</span>
                      {groupFilters.length > 0 && (
                        <button onClick={() => setGroupFilters([])} className="text-[9px] font-bold text-red-500 hover:underline">Reset</button>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-0.5 custom-scrollbar">
                      {uniqueGroups.map(group => (
                        <button 
                          key={group}
                          onClick={() => toggleFilter(groupFilters, setGroupFilters, group)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl transition-all ${groupFilters.includes(group) ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                          {language === 'zh' 
                            ? getTaxonomyChi(mode === 'flora' ? 'category' : 'taxa_group', mode, group) 
                            : group
                          }
                          {groupFilters.includes(group) && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative group flex-1">
              <div className="absolute inset-0 bg-emerald-500/5 blur-xl rounded-2xl transition-all group-focus-within:bg-emerald-500/10" />
              <div className="relative flex items-center bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl px-4 py-2 transition-all focus-within:border-emerald-400">
                <Search className="w-4 h-4 text-slate-400 mr-2.5" />
                <input 
                  type="text" 
                  placeholder={t('admin.search_taxonomy')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-slate-700 text-sm font-medium placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-1 ml-4">
            <p className="text-[9px] text-slate-400 font-medium flex items-center gap-1">
              <Edit2 className="w-2.5 h-2.5" /> {t('admin.edit_hint')}
            </p>
            <div className="w-1 h-1 bg-slate-300 rounded-full" />
            <p className="text-[9px] text-amber-500 font-bold flex items-center gap-1">
              <AlertCircle className="w-2.5 h-2.5" /> English changes will sync with species database
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowMissingOnly(!showMissingOnly)}
            className={`px-3 py-1 rounded-full text-[10px] font-black transition-all border ${
              showMissingOnly 
                ? 'bg-amber-100 text-amber-600 border-amber-200 shadow-sm' 
                : 'bg-white/40 text-slate-400 border-white hover:bg-white/60'
            }`}
          >
            {language === 'zh' ? '僅顯示缺中文' : 'Missing Chinese Only'}
          </button>
          
          <div className="px-3 py-1 bg-white/40 border border-white rounded-full text-[10px] font-bold text-slate-500">
            <span className="text-emerald-600 font-black">
              {t('admin.total_ratio')
                .replace('{filtered}', String(filteredAndSortedData.length))
                .replace('{total}', String(data.length))}
            </span>
          </div>
          {(rankFilters.length > 0 || groupFilters.length > 0 || searchQuery || showMissingOnly) && (
            <button 
              onClick={() => {
                setRankFilters([]);
                setGroupFilters([]);
                setSearchQuery('');
                setShowMissingOnly(false);
              }}
              className="px-3 py-1 text-[10px] font-black text-red-500 hover:bg-red-50 rounded-full transition-colors"
            >
              {t('admin.clear_all')}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
          <p className="text-slate-400 text-xs font-medium">{t('loading.message')}</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto rounded-[1.5rem] border border-white bg-white/30 backdrop-blur-xl shadow-sm custom-scrollbar">
          <table className="w-max text-left border-collapse table-fixed">
            <thead className="sticky top-0 z-40 bg-slate-50 shadow-sm">
              <tr className="border-b border-slate-100">
                <th 
                  ref={rankFilterRef as any} 
                  style={{ width: columnWidths.rank }}
                  className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest relative group/header"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer group" onClick={() => requestSort('rank')}>
                      {t('admin.rank')}
                      <SortIcon column="rank" />
                    </div>
                    <button onClick={() => setShowRankFilter(!showRankFilter)} className="p-1 hover:bg-slate-100 rounded-md transition-colors">
                      <Filter className={`w-3 h-3 ${rankFilters.length > 0 ? 'text-emerald-500' : 'text-slate-300'}`} />
                    </button>
                  </div>
                  
                  {/* Resizer Handle */}
                  <div 
                    onMouseDown={(e) => handleMouseDown('rank', e)}
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group-hover/header:bg-emerald-500/20 active:bg-emerald-500 transition-colors z-30"
                  />

                  <AnimatePresence>
                    {showRankFilter && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-20 max-h-64 overflow-y-auto"
                      >
                        {uniqueRanks.map(rank => (
                          <button 
                            key={rank}
                            onClick={() => toggleFilter(rankFilters, setRankFilters, rank)}
                            className={`w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold rounded-lg transition-colors ${rankFilters.includes(rank) ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500 hover:bg-slate-50'}`}
                          >
                            {rank}
                            {rankFilters.includes(rank) && <Check className="w-2.5 h-2.5" />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </th>

                <th 
                  style={{ width: columnWidths.taxa_group }}
                  className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group/header relative" 
                >
                  <div className="flex items-center gap-2" onClick={() => requestSort('taxa_group')}>
                    {t('admin.taxa_group')}
                    <SortIcon column="taxa_group" />
                  </div>
                  
                  {/* Resizer Handle */}
                  <div 
                    onMouseDown={(e) => handleMouseDown('taxa_group', e)}
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group-hover/header:bg-emerald-500/20 active:bg-emerald-500 transition-colors z-30"
                  />
                </th>

                <th 
                  style={{ width: columnWidths.name_eng }}
                  className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group/header relative" 
                >
                  <div className="flex items-center gap-2" onClick={() => requestSort('name_eng')}>
                    {t('admin.name_eng')}
                    <SortIcon column="name_eng" />
                  </div>
                  
                  {/* Resizer Handle */}
                  <div 
                    onMouseDown={(e) => handleMouseDown('name_eng', e)}
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group-hover/header:bg-emerald-500/20 active:bg-emerald-500 transition-colors z-30"
                  />
                </th>

                <th 
                  style={{ width: columnWidths.name_chi }}
                  className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group/header relative" 
                >
                  <div className="flex items-center gap-2" onClick={() => requestSort('name_chi')}>
                    {t('admin.name_chi')}
                    <SortIcon column="name_chi" />
                  </div>

                  {/* Resizer Handle */}
                  <div 
                    onMouseDown={(e) => handleMouseDown('name_chi', e)}
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group-hover/header:bg-emerald-500/20 active:bg-emerald-500 transition-colors z-30"
                  />
                </th>

                <th 
                  style={{ width: columnWidths.species_count }}
                  className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group/header relative" 
                >
                  <div className="flex items-center gap-2" onClick={() => requestSort('species_count')}>
                    {language === 'zh' ? '數量' : 'Count'}
                    <SortIcon column="species_count" />
                  </div>

                  {/* Resizer Handle */}
                  <div 
                    onMouseDown={(e) => handleMouseDown('species_count', e)}
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group-hover/header:bg-emerald-500/20 active:bg-emerald-500 transition-colors z-30"
                  />
                </th>
              </tr>
            </thead>
            <tbody className="bg-white/20">
              {filteredAndSortedData.map((item, index) => {
                const rowId = `row-${index}-${item.rank}-${item.taxa_group || ''}-${item.name_eng.trim()}`;
                const isEditing = editingId === rowId;

                return (
                  <tr 
                    key={rowId} 
                    ref={isEditing ? (editingRowRef as React.RefObject<HTMLTableRowElement>) : null}
                    onClick={() => !isEditing && startEditing(rowId, item)}
                    className={`transition-all duration-300 group border-b border-white/10 ${
                      isEditing 
                        ? 'bg-emerald-50/80 shadow-inner' 
                        : 'hover:bg-emerald-50/60 hover:shadow-lg hover:shadow-slate-200/40 cursor-pointer'
                    }`}
                  >
                    <td className="px-4 py-1.5 text-[11px] font-black text-slate-400 uppercase">{item.rank}</td>
                    
                    {/* Taxa Group / Informal Group */}
                    <td className="px-4 py-1.5">
                      <span className="px-2 py-0.5 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-black uppercase ring-1 ring-slate-100/50">
                        {language === 'zh' 
                          ? getTaxonomyChi('taxa_group', mode, item.taxa_group || '') 
                          : item.taxa_group
                        }
                      </span>
                    </td>
                    
                    {/* Editable Eng Name */}
                    <td className="px-4 py-1.5">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editValues.name_eng || ''}
                          onChange={(e) => handleEditChange('name_eng', e.target.value)}
                          className={`bg-white border border-emerald-300 rounded-lg px-2 py-0.5 text-xs font-bold text-emerald-700 outline-none shadow-inner w-full focus:ring-1 focus:ring-emerald-500 ${item.rank !== 'informal_group' ? 'italic' : ''}`}
                          onKeyDown={handleKeyDown}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className={`font-bold text-slate-700 text-xs ${item.rank !== 'informal_group' ? 'italic' : ''}`}>{item.name_eng}</span>
                      )}
                    </td>

                    {/* Editable Chi Name */}
                    <td className="px-4 py-1.5">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editValues.name_chi || ''}
                          onChange={(e) => handleEditChange('name_chi', e.target.value)}
                          className="bg-white border border-emerald-300 rounded-lg px-2 py-0.5 text-xs font-black text-slate-800 outline-none shadow-inner w-full focus:ring-1 focus:ring-emerald-500"
                          onKeyDown={handleKeyDown}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        item.name_chi ? (
                          <span className="font-black text-slate-800 text-[13px]">{item.name_chi}</span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                            <X className="w-2.5 h-2.5" /> {language === 'zh' ? '缺中文' : 'Missing'}
                          </span>
                        )
                      )}
                    </td>

                    {/* Species Count */}
                    <td className="px-4 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black min-w-[32px] text-center shadow-sm border border-slate-200/50">
                          {item.species_count || 0}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Species</span>
                      </div>
                    </td>

                    {/* Action Buttons */}
                    {isEditing && (
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
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
      )}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(241, 245, 249, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.2);
          border-radius: 10px;
          transition: all 0.2s;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(16, 185, 129, 0.5);
        }
      `}</style>

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

      <AlertModal
        isOpen={!!errorMessage}
        onClose={() => setErrorMessage(null)}
        onConfirm={() => setErrorMessage(null)}
        title={language === 'zh' ? '儲存失敗' : 'Save Failed'}
        description={errorMessage || ''}
        confirmLabel={language === 'zh' ? '確定' : 'OK'}
        type="danger"
      />
    </div>
  );
}
