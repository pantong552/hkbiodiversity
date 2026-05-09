'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
  Edit2,
  X,
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  is_from_mappings?: boolean;
}

type SortKey = 'rank' | 'name_eng' | 'name_chi' | 'taxa_group';
type SortDirection = 'asc' | 'desc';

// Define the mapping between internal ranks and database columns
const RANK_FIELD_MAP = {
  fauna: {
    class: 'class_eng',
    order: 'order_eng',
    family: 'family_eng',
    genus: 'genus_eng'
  } as Record<string, string>,
  flora: {
    class: 'category_eng',
    family: 'family_eng',
    genus: 'genus_eng'
  } as Record<string, string>
};

export default function TaxonomyMappingsManager({ mode, onRequestConfirm }: TaxonomyMappingsManagerProps) {
  const { language, t } = useLanguage();
  const supabase = createClient();
  const [data, setData] = useState<TaxonomyMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | number | null>(null);
  
  // Inline Editing State
  const [editingCell, setEditingCell] = useState<{ id: string | number | null; field: keyof TaxonomyMapping | null }>({
    id: null,
    field: null
  });
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sorting & Filtering State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ 
    key: 'name_eng', 
    direction: 'asc' 
  });
  const [rankFilters, setRankFilters] = useState<string[]>([]);
  const [showRankFilter, setShowRankFilter] = useState(false);
  const [groupFilters, setGroupFilters] = useState<string[]>(['Amphibian']);
  const [showGroupFilter, setShowGroupFilter] = useState(false);
  const [showMissingOnly, setShowMissingOnly] = useState(false);

  // Click Outside Refs
  const rankFilterRef = useClickOutside(() => setShowRankFilter(false));
  const groupFilterRef = useClickOutside(() => setShowGroupFilter(false));

  // Column Resizing State
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    rank: 100,
    name_eng: 220,
    name_chi: 250
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
      const order = ['class', 'order', 'family', 'genus'];
      return order.indexOf(a) - order.indexOf(b);
    });
  }, [data]);

  const uniqueGroups = useMemo(() => {
    const groups = Array.from(new Set(data.map(d => d.taxa_group).filter(Boolean))) as string[];
    return groups.sort();
  }, [data]);

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
        const selectFields = mode === 'fauna' ? `${field}, taxa_group` : field;
        const uniqueMap = new Map<string, string>();
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
              const group = (item as any).taxa_group || (mode === 'flora' ? 'FLORA' : '');
              const key = `${name}||${group}`;
              uniqueMap.set(key, group);
            }
          });

          if (batchData.length < limit) break;
          offset += limit;
        }

        return Array.from(uniqueMap.entries()).map(([key, group]) => {
          const [name] = key.split('||');
          return { rank, name_eng: name, taxa_group: group };
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

  const handleUpdate = async (item: TaxonomyMapping, field: keyof TaxonomyMapping, newValue: string) => {
    const oldValue = String(item[field] || '');
    if (oldValue === newValue) {
      setEditingCell({ id: null, field: null });
      return;
    }

    const loadingKey = item.id || `${item.rank}-${item.taxa_type}-${item.taxa_group || ''}-${item.name_eng}`;
    
    try {
      const taxaType = mode === 'fauna' ? 'fauna' : 'flora';
      const targetTable = mode === 'fauna' ? 'species' : 'plant_species';
      const dbField = RANK_FIELD_MAP[mode][item.rank];

      if (field === 'name_eng') {
        // --- MODIFYING ENGLISH NAME (Merge / Sync Logic) ---
        const normalizedNewValue = newValue.trim();
        
        // 1. Check if the target name already exists in OUR LOCAL DATA (which includes species table results)
        const targetExists = data.some(d => 
          d.rank === item.rank && 
          d.name_eng.trim().toLowerCase() === normalizedNewValue.toLowerCase() &&
          d.name_eng.trim() !== oldValue.trim() // Ensure it's not the current item itself
        );

        if (targetExists) {
          // TARGET EXISTS: This is a MERGE operation
          setEditingCell({ id: null, field: null });
          
          const title = language === 'zh' ? '分類合併確認' : 'Taxonomy Merge Confirmation';
          const message = language === 'zh' 
            ? `警告：目標名稱 "${normalizedNewValue}" 已存在。\n\n所有原本屬於 "${oldValue}" 的物種將會被合併到 "${normalizedNewValue}" 之下。此操作無法復原，您確定要繼續嗎？`
            : `Warning: Target name "${normalizedNewValue}" already exists.\n\nAll species currently under "${oldValue}" will be merged into "${normalizedNewValue}". This action cannot be undone. Do you want to proceed?`;

          onRequestConfirm(async () => {
            setActionLoading(loadingKey);
            try {
              // A. Update all species/plants to the NEW (existing) name
              const { error: syncError } = await supabase.from(targetTable).update({ [dbField]: normalizedNewValue }).eq(dbField, oldValue);
              if (syncError) throw syncError;

              // B. Delete the old mapping record if it existed
              if (item.is_from_mappings && item.id) {
                const { error: delError } = await supabase.from('taxonomy_mappings').delete().eq('id', item.id);
                if (delError) throw delError;
              }

              // C. Update local state
              await fetchData();
            } finally {
              setActionLoading(null);
            }
          }, title, message);
          return;
        } else {
          // TARGET DOES NOT EXIST: Standard Rename
          setActionLoading(loadingKey);
          // A. Update Taxonomy Mappings table
          if (item.is_from_mappings && item.id) {
            const { error } = await supabase.from('taxonomy_mappings').update({ name_eng: normalizedNewValue }).eq('id', item.id);
            if (error) throw error;
          }

          // B. Update all occurrences in Species/Plant_Species table
          const { error: syncError } = await supabase.from(targetTable).update({ [dbField]: normalizedNewValue }).eq(dbField, oldValue);
          if (syncError) throw syncError;

          // C. Refresh data to reflect the name change across all lists
          await fetchData();
        }

      } else if (field === 'name_chi') {
        // --- MODIFYING CHINESE NAME ---
        setActionLoading(loadingKey);

        if (item.is_from_mappings && item.id) {
          // Update existing
          const { error } = await supabase.from('taxonomy_mappings').update({ name_chi: newValue }).eq('id', item.id);
          if (error) throw error;
        } else {
          // Insert new mapping
          const { data: newData, error } = await supabase.from('taxonomy_mappings').insert({
            rank: item.rank,
            taxa_type: taxaType,
            name_eng: item.name_eng,
            name_chi: newValue
          }).select().single();
          
          if (error) throw error;
          
          // Update local item with new ID and mark as mapped
          setData(data.map(d => (d.rank === item.rank && d.name_eng === item.name_eng) ? { ...d, id: newData.id, name_chi: newValue, is_from_mappings: true } : d));
          setActionLoading(null);
          setEditingCell({ id: null, field: null });
          return;
        }
        
        // Update local state for simple update
        setData(data.map(d => (d.rank === item.rank && d.name_eng === item.name_eng) ? { ...d, name_chi: newValue } : d));
      }

    } catch (err) {
      console.error('Error updating data:', err);
      alert('Update failed: ' + (err as any).message);
    } finally {
      setActionLoading(null);
      setEditingCell({ id: null, field: null });
    }
  };

  const startEditing = (item: TaxonomyMapping, field: keyof TaxonomyMapping) => {
    setEditingCell({ id: item.id || `${item.rank}-${item.taxa_type}-${item.name_eng}`, field });
    setEditValue(String(item[field] || ''));
    setTimeout(() => inputRef.current?.focus(), 50);
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
      const aVal = String(a[sortConfig.key] || '').toLowerCase();
      const bVal = String(b[sortConfig.key] || '').toLowerCase();
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
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
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />;
  };

  return (
    <div className="space-y-4">
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
                          {group}
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
            Total: <span className="text-emerald-600 font-black ml-1">{filteredAndSortedData.length}</span>
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
              Clear All
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
          <p className="text-slate-400 text-xs font-medium">{t('loading.message')}</p>
        </div>
      ) : (
        <div className="overflow-visible rounded-[1.5rem] border border-white bg-white/30 backdrop-blur-xl shadow-sm overflow-x-auto">
          <table className="w-max text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th 
                  ref={rankFilterRef as any} 
                  style={{ width: columnWidths.rank }}
                  className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest relative group/header"
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
                  style={{ width: columnWidths.name_eng }}
                  className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group/header relative" 
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
                  className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group/header relative" 
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
              </tr>
            </thead>
            <tbody className="bg-white/20">
              {filteredAndSortedData.map((item, index) => {
                // Generate a unique ID for this row. 
                // We use index + taxa_group + rank + name to guarantee uniqueness, 
                // as a single mapping record might be referenced by multiple taxa groups.
                const rowId = `row-${index}-${item.rank}-${item.taxa_group || ''}-${item.name_eng.trim()}`;
                
                // For action loading, we use the specific mapping ID if available, otherwise the composite name
                const loadingKey = item.id || `${item.rank}-${item.taxa_type}-${item.taxa_group || ''}-${item.name_eng}`;
                const isActionLoading = actionLoading === loadingKey;

                return (
                  <tr key={rowId} className="hover:bg-emerald-50/60 hover:shadow-lg hover:shadow-slate-200/40 transition-all duration-300 group border-b border-white/10 cursor-pointer">
                    <td className="px-4 py-2 text-[11px] font-black text-slate-400 uppercase">{item.rank}</td>
                    
                    {/* Editable Eng Name */}
                    <td className="px-6 py-2">
                      {editingCell.id === rowId && editingCell.field === 'name_eng' ? (
                        <div className="flex items-center gap-2">
                          <input
                            ref={inputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdate(item, 'name_eng', editValue);
                              if (e.key === 'Escape') setEditingCell({ id: null, field: null });
                            }}
                            onBlur={() => handleUpdate(item, 'name_eng', editValue)}
                            className="bg-white border border-emerald-300 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-700 outline-none shadow-inner w-full"
                          />
                        </div>
                      ) : (
                        <div 
                          onClick={() => {
                            setEditingCell({ id: rowId, field: 'name_eng' });
                            setEditValue(item.name_eng);
                            setTimeout(() => inputRef.current?.focus(), 50);
                          }} 
                          className="flex items-center justify-between group/cell cursor-pointer py-0.5"
                        >
                          <div className="flex items-center gap-2">
                            {isActionLoading && editingCell.field === 'name_eng' && <Loader2 className="w-2.5 h-2.5 text-emerald-500 animate-spin" />}
                            <span className="font-bold text-slate-700 text-xs italic">{item.name_eng}</span>
                          </div>
                          <Edit2 className="w-2.5 h-2.5 text-emerald-500 opacity-0 group-hover/cell:opacity-100 transition-opacity ml-2" />
                        </div>
                      )}
                    </td>

                    {/* Editable Chi Name */}
                    <td className="px-6 py-2">
                      {editingCell.id === rowId && editingCell.field === 'name_chi' ? (
                        <div className="flex items-center gap-2">
                          <input
                            ref={inputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdate(item, 'name_chi', editValue);
                              if (e.key === 'Escape') setEditingCell({ id: null, field: null });
                            }}
                            onBlur={() => handleUpdate(item, 'name_chi', editValue)}
                            className="bg-white border border-emerald-300 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-700 outline-none shadow-inner w-full"
                          />
                        </div>
                      ) : (
                        <div 
                          onClick={() => {
                            setEditingCell({ id: rowId, field: 'name_chi' });
                            setEditValue(item.name_chi || '');
                            setTimeout(() => inputRef.current?.focus(), 50);
                          }} 
                          className="flex items-center justify-between group/cell cursor-pointer py-0.5"
                        >
                          <div className="flex items-center gap-2">
                            {isActionLoading && editingCell.field === 'name_chi' && <Loader2 className="w-2.5 h-2.5 text-emerald-500 animate-spin" />}
                            {item.name_chi ? (
                              <span className="font-black text-slate-800 text-sm">{item.name_chi}</span>
                            ) : (
                              <span className="flex items-center gap-1 text-[11px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                                <X className="w-2.5 h-2.5" /> {language === 'zh' ? '缺中文' : 'Missing'}
                              </span>
                            )}
                          </div>
                          <Edit2 className="w-2.5 h-2.5 text-emerald-500 opacity-0 group-hover/cell:opacity-100 transition-opacity ml-2" />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
