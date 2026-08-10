'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, FilterX, LayoutGrid, List, ChevronLeft, ChevronRight, Filter, Table as TableIcon, Lock, Sparkles } from 'lucide-react';
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
import { useTaxonomy } from '@/context/TaxonomyContext';
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
  const { getTaxonomyChi } = useTaxonomy();
  const { isAuthorized, isLoading: isAuthLoading, openAuthReminder } = useAuth();
  const { addSpecies, openSpeciesIds, isExpanded, isFilterOpen, setIsFilterOpen, pendingTaxonomyFilter, setPendingTaxonomyFilter } = useSpeciesPanel();
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
  const fetchIdRef = useRef(0); // 用於追踪請求序號以防止 Race Condition

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
    taxonomy: { phylum_eng: [], class_eng: [], order_eng: [], family_eng: [], genus_eng: [], informal_group_eng: [] },
    iucn: []
  });

  // Flora Filters
  const [plantFilters, setPlantFilters] = useState<PlantFilterState>(INITIAL_PLANT_FILTERS);
  const [availablePlantMeta, setAvailablePlantMeta] = useState<{
    categories: any[];
    families: any[];
    genuses: any[];
  }>({ categories: [], families: [], genuses: [] });
  const [tableMetadata, setTableMetadata] = useState<Record<string, any[]>>({});
  const [tableFilters, setTableFilters] = useState<Record<string, any>>({});

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
                        p_categories: level === 'categories' ? [] : (plantFilters.categories || []),
                        p_families: level === 'families' ? [] : (plantFilters.families || []),
                        p_genuses: level === 'genuses' ? [] : (plantFilters.genuses || []),
                        p_origins: (plantFilters.origins || []).flatMap(o => 
                            o === 'Native' ? ['Native', '原生'] : o === 'Exotic' ? ['Exotic', '外來'] : [o]
                        ),
                        p_is_cap96: plantFilters.isCap96 === true,
                        p_is_cap586: plantFilters.isCap586 === true,
                        p_is_rare: plantFilters.isRare === true,
                        p_is_china_red_book: plantFilters.isInChinaRedBook === true,
                        p_flowering_months: (plantFilters.floweringMonths || []).map(Number),
                        p_fruiting_months: (plantFilters.fruitingMonths || []).map(Number),
                        p_search: (searchQuery || plantFilters.searchQuery || '').trim()
                    };

                    const { data, error } = await supabaseSingleton.rpc('get_plant_stats', rpcParams);
                    return { level, data, error };
                });

                const results = await Promise.all(levelPromises);
                
                interface PlantMeta {
                    categories: any[];
                    families: any[];
                    genuses: any[];
                    [key: string]: any[];
                }
                
                const newMeta: PlantMeta = { categories: [], families: [], genuses: [] };
                
                results.forEach(({ level, data, error }) => {
                    if (data && !error) {
                        const items = level === 'categories' ? (data.categories || []) : (level === 'families' ? (data.families || []) : (data.genuses || []));
                        const rankKey = level === 'categories' ? 'category' : (level === 'families' ? 'family' : 'genus');

                        const uniqueMap = new Map<string, { name: string; display: string; count: number }>();

                        items.forEach((i: any) => {
                            const nameEng = i.en || i.name;
                            uniqueMap.set(nameEng, {
                                name: nameEng,
                                display: language === 'zh' ? getTaxonomyChi(rankKey, 'flora', nameEng) : nameEng,
                                count: i.count
                            });
                        });

                        // 確保已選取項目即使被下級過濾排除，也保留在選單列表中
                        const currentSelected = level === 'categories' ? (plantFilters.categories || []) : (level === 'families' ? (plantFilters.families || []) : (plantFilters.genuses || []));
                        currentSelected.forEach((selName: string) => {
                            if (!uniqueMap.has(selName)) {
                                uniqueMap.set(selName, {
                                    name: selName,
                                    display: language === 'zh' ? getTaxonomyChi(rankKey, 'flora', selName) : selName,
                                    count: 0
                                });
                            }
                        });

                        newMeta[level] = Array.from(uniqueMap.values()).sort((a: any, b: any) => b.count - a.count);
                    }
                });
                
                setAvailablePlantMeta(newMeta);
            } catch (err) {
                console.error("Error fetching plant meta", err);
            }
        };
        fetchMeta();
    }
  }, [taxaType, plantFilters, searchQuery, language, getTaxonomyChi]);

  // Handle Taxa Switch
  const handleTaxaChange = (type: TaxaType) => {
    setTaxaType(type);
    setCurrentPage(1);
    setSearchQuery('');
    setTableFilters({}); // 切換物種類型時清空表格篩選，以便 Metadata 重新初始化為全選
  };

  // Handle Taxonomy Click from Species Card
  const handleTaxonomyClick = useCallback((level: string, value: string) => {
    // 立即反應：重設分頁與清空搜尋關鍵字
    setCurrentPage(1);
    setSearchQuery('');
    setTableFilters({});

    // 根據 level 自動判定是動物還是植物過濾
    const isFaunaLevel = ['phylum_eng', 'class_eng', 'order_eng', 'family_eng', 'genus_eng', 'informal_group_eng'].includes(level);
    const isFloraLevel = ['categories', 'families', 'genuses'].includes(level);

    if (isFaunaLevel) {
      // 強制切換至動物模式（如果目前不在動物模式）
      if (taxaType !== 'fauna') setTaxaType('fauna');

      const cleanTaxonomy: any = { 
        phylum_eng: [], class_eng: [], order_eng: [], family_eng: [], genus_eng: [], informal_group_eng: [] 
      };
      cleanTaxonomy[level] = [value];

      setSelectedFilters({
        taxonomy: cleanTaxonomy,
        iucn: []
      });
      
      setIsFilterOpen(true);
    } else if (isFloraLevel) {
      // 強制切換至植物模式（如果目前不在植物模式）
      if (taxaType !== 'flora') setTaxaType('flora');

      setPlantFilters({
        ...INITIAL_PLANT_FILTERS,
        [level]: [value],
        searchQuery: ''
      });
      
      setIsFilterOpen(true);
    }

    // 捲動至頂部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [taxaType, setIsFilterOpen, setSelectedFilters, setPlantFilters, setSearchQuery, setTableFilters, setCurrentPage, setTaxaType]);

  const fetchSpecies = useMemo(() => {
    return async () => {
      if (isAuthLoading) return;

      const currentFetchId = ++fetchIdRef.current; // 更新目前請求 ID
      setIsLoading(true);
      setError(null);

      try {
        const table = taxaType === 'fauna' ? 'species' : 'plant_species';
        let query = supabaseSingleton.from(table).select('*', { count: 'exact' });

        // Apply Global & Quick Search
        const currentSearch = searchQuery.trim();
        if (currentSearch && taxaType === 'fauna') {
            query = query.or(`common_name_chi.ilike.%${currentSearch}%,common_name_eng.ilike.%${currentSearch}%,scientific_name.ilike.%${currentSearch}%,alias_common_name_chi.ilike.%${currentSearch}%,alias_common_name_eng.ilike.%${currentSearch}%,alias_scientific_name.ilike.%${currentSearch}%`);
        }

        if (taxaType === 'fauna') {
            // 合併側邊欄與表格過濾器
            const finalTaxonomy = {
                phylum_eng: (tableFilters.phylum?.length > 0) ? tableFilters.phylum : selectedFilters.taxonomy.phylum_eng,
                class_eng: (tableFilters.class?.length > 0) ? tableFilters.class : selectedFilters.taxonomy.class_eng,
                order_eng: (tableFilters.order?.length > 0) ? tableFilters.order : selectedFilters.taxonomy.order_eng,
                family_eng: (tableFilters.family?.length > 0) ? tableFilters.family : selectedFilters.taxonomy.family_eng,
                genus_eng: (tableFilters.genus?.length > 0) ? tableFilters.genus : selectedFilters.taxonomy.genus_eng,
                informal_group_eng: (tableFilters.informal_group?.length > 0) ? tableFilters.informal_group : selectedFilters.taxonomy.informal_group_eng
            };

            Object.entries(finalTaxonomy).forEach(([level, values]) => {
                if (values && values.length > 0) {
                    query = query.in(level, values);
                }
            });

            // IUCN Filters
            const finalIucn = (tableFilters.iucn?.length > 0) ? tableFilters.iucn : selectedFilters.iucn;
            if (finalIucn && finalIucn.length > 0) {
                query = query.in('iucn', finalIucn);
            }
            
            // Native Status
            const finalNative = (tableFilters.native_status?.length > 0) ? tableFilters.native_status : ((selectedFilters as any).status?.native_status || []);
            if (finalNative && finalNative.length > 0) {
                query = query.in('native_status', finalNative);
            }

            // Protection Filters (Cap. 170 & Cap. 586)
            if (selectedFilters.isCap170) {
                query = query.eq('cap170', 'Y');
            }
            if (selectedFilters.isCap586) {
                query = query.eq('cap586', 'Y');
            }

            // Scientific & Common Name Table Filters
            if (tableFilters.scientific_name?.length > 0) {
                query = query.in('scientific_name', tableFilters.scientific_name);
            }
            if (tableFilters.common_name?.length > 0) {
                query = query.in('common_name_chi', tableFilters.common_name);
            }
        } else {
            // Flora Filters
            // 1. Search Logic
            const ps = (plantFilters.searchQuery || searchQuery || '').trim();
            if (ps) {
                query = query.or(`scientific_name.ilike.%${ps}%,common_name_chi.ilike.%${ps}%,common_name_eng.ilike.%${ps}%,alias_scientific_name.ilike.%${ps}%,alias_common_name_chi.ilike.%${ps}%,alias_common_name_eng.ilike.%${ps}%`);
            }
            
            // 2. Taxonomy Filters (Sidebar Priority)
            // 確保只有在陣列真正有值時才加入過濾條件
            if (plantFilters.categories && plantFilters.categories.length > 0) {
                query = query.in('category_eng', plantFilters.categories);
            }
            if (plantFilters.families && plantFilters.families.length > 0) {
                query = query.in('family_eng', plantFilters.families);
            }
            if (plantFilters.genuses && plantFilters.genuses.length > 0) {
                query = query.in('genus_eng', plantFilters.genuses);
            }
            
            // 3. Table Mode Overrides (Only if active in table mode)
            if (displayMode === 'table') {
                if (tableFilters.scientific_name?.length > 0) query = query.in('scientific_name', tableFilters.scientific_name);
                if (tableFilters.common_name?.length > 0) query = query.in('common_name_chi', tableFilters.common_name);
            }

            // 4. Native Status Filter
            const f_origins = (displayMode === 'table' && tableFilters.native_status?.length > 0) 
                ? tableFilters.native_status 
                : plantFilters.origins;

            if (f_origins && f_origins.length > 0) {
                const expandedOrigins = f_origins.flatMap((o: string) => 
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

        // Apply Table Filters (for list mode)
        if (displayMode === 'table') {
          Object.entries(tableFilters).forEach(([key, value]) => {
            if (!value || (Array.isArray(value) && value.length === 0)) return;
            
            // Map table keys to actual DB columns - 統一使用英文欄位作為 Filter Key
            const dbKey = key === 'common_name' 
              ? 'common_name_chi'
              : key === 'scientific_name' ? 'scientific_name'
              : key === 'order' ? (taxaType === 'fauna' ? 'order_eng' : 'family_eng')
              : key === 'family' ? (taxaType === 'fauna' ? 'family_eng' : 'family_eng')
              : key === 'genus' ? (taxaType === 'fauna' ? 'genus_eng' : 'genus_eng')
              : key === 'iucn' ? (taxaType === 'fauna' ? 'iucn' : 'hk_rare_precious_note')
              : key;

            if (Array.isArray(value)) {
              if (dbKey === 'iucn' && value.includes('NE')) {
                // 處理 NE: 包含簡寫 'NE'、NULL 或空字串
                const otherValues = value.filter(v => v !== 'NE');
                const filterParts = [`iucn.is.null`, `iucn.eq.""` , `iucn.eq.NE` ];
                if (otherValues.length > 0) {
                  filterParts.push(`iucn.in.(${otherValues.map(v => `"${v}"`).join(',')})`);
                }
                query = query.or(filterParts.join(','));
              } else {
                query = query.in(dbKey, value);
              }
            }
          });
        }

        const fieldMap: Record<string, string> = taxaType === 'fauna' ? {
          'common_name': language === 'zh' ? 'common_name_chi' : 'common_name_eng',
          'scientific_name': 'scientific_name',
          'rarity': 'iucn',
        } : {
          'common_name': language === 'zh' ? 'common_name_chi' : 'common_name_eng',
          'scientific_name': 'scientific_name',
          'rarity': 'hk_rare_precious_note',
        };

        const sortField = fieldMap[sortBy] || sortBy;
        if (sortField) query = query.order(sortField, { ascending: sortOrder === 'asc' });

        const safeItemsPerPage = itemsPerPage || 12;
        query = query.range((currentPage - 1) * safeItemsPerPage, currentPage * safeItemsPerPage - 1);

        const { data, error: fetchError, count } = await query;
        if (fetchError) throw fetchError;

        // 檢查此請求是否過時 (這就是解決載入兩次的關鍵)
        if (currentFetchId !== fetchIdRef.current) return;

        setSpecies(data || []);
        const total = count || 0;
        setTotalResultCount(total);

        // 手機模式下，若結果太少不足以觸發出現 Scrollbar（例如少於 4 筆），直接開啟 mobile filter panel
        if (typeof window !== 'undefined' && window.innerWidth <= 1100 && total <= 3) {
          setIsFilterOpen(true);
        }
      } catch (err: any) {
        setError(err.message || '連線錯誤');
      } finally {
        setIsLoading(false);
      }
    };
  }, [taxaType, searchQuery, selectedFilters, plantFilters, tableFilters, currentPage, itemsPerPage, sortBy, sortOrder, language, isAuthLoading]);

  // 獲取表格專用的中繼資料 (All unique values for filters)
  useEffect(() => {
    const fetchTableMetadata = async () => {
      if (isAuthLoading) return;
      
      const rpcName = taxaType === 'fauna' ? 'get_fauna_table_metadata' : 'get_flora_table_metadata';
      const currentSearch = taxaType === 'fauna' ? searchQuery.trim() : (searchQuery.trim() || plantFilters.searchQuery.trim());
      
      const params = taxaType === 'fauna' ? {
        p_search: currentSearch,
        p_phylum: (tableFilters.phylum?.length > 0) ? tableFilters.phylum : (selectedFilters.taxonomy?.phylum_eng || []),
        p_class: (tableFilters.class?.length > 0) ? tableFilters.class : (selectedFilters.taxonomy?.class_eng || []),
        p_order: (tableFilters.order?.length > 0) ? tableFilters.order : (selectedFilters.taxonomy?.order_eng || []),
        p_family: (tableFilters.family?.length > 0) ? tableFilters.family : (selectedFilters.taxonomy?.family_eng || []),
        p_scientific_name: tableFilters.scientific_name || [],
        p_common_name: tableFilters.common_name || [],
        p_iucn: (tableFilters.iucn?.length > 0) ? tableFilters.iucn : (selectedFilters.iucn || []),
        p_native_status: (tableFilters.native_status?.length > 0) ? tableFilters.native_status : ((selectedFilters as any).status?.native_status || [])
      } : {
        p_search: currentSearch,
        p_categories: (tableFilters.category?.length > 0) ? tableFilters.category : (plantFilters.categories || []),
        p_family: (tableFilters.family?.length > 0) ? tableFilters.family : (plantFilters.families || []),
        p_genus: (tableFilters.genus?.length > 0) ? tableFilters.genus : (plantFilters.genuses || []),
        p_scientific_name: tableFilters.scientific_name || [],
        p_common_name: tableFilters.common_name || [],
        p_native_status: (tableFilters.native_status?.length > 0) ? tableFilters.native_status : (plantFilters.origins || [])
      };

      try {
        const { data, error } = await supabaseSingleton.rpc(rpcName, params);
        
        if (error) throw error;
        
        // Data 為一個包含了各個欄位統計資訊的 JSON 對象
        const metadata = data || {};
        
        // 確保每個欄位都有一個空的 array 以免渲染崩潰
        const safeMetadata: Record<string, any[]> = {};
        const keys = taxaType === 'fauna' 
            ? ['order', 'family', 'scientific_name', 'common_name', 'iucn', 'native_status']
            : ['family', 'genus', 'scientific_name', 'common_name', 'iucn', 'native_status'];
        
        keys.forEach(key => {
            safeMetadata[key] = metadata[key] || [];
        });

        setTableMetadata(safeMetadata);
      } catch (err) {
        console.error("Error fetching table metadata via RPC", err);
      }
    };

    fetchTableMetadata();
  }, [taxaType, searchQuery, selectedFilters, plantFilters, tableFilters, isAuthLoading]);
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
    if (!isAuthLoading) {
      const timer = setTimeout(() => {
        fetchSpecies();
      }, 50); // 50ms 防抖延遲，足以合併多個同步/異步狀態變動引發的請求
      return () => clearTimeout(timer);
    }
  }, [fetchSpecies, isAuthLoading]);

  // 處理來自物種面板的過濾請求 (使用 Context 通訊比 URL 參數更穩定，避免 Race Condition)
  useEffect(() => {
    if (pendingTaxonomyFilter) {
      const { level, value } = pendingTaxonomyFilter;
      const faunaTaxaLevels = ['phylum_eng', 'class_eng', 'order_eng', 'family_eng', 'genus_eng', 'informal_group_eng'];
      
      if (faunaTaxaLevels.includes(level)) {
        setTaxaType('fauna');
        setPlantFilters(INITIAL_PLANT_FILTERS); // 清空植物過濾器，避免衝突
        
        const cleanTaxonomy: any = { 
          phylum_eng: [], class_eng: [], order_eng: [], family_eng: [], genus_eng: [], informal_group_eng: [] 
        };
        cleanTaxonomy[level] = [value];
        setSelectedFilters({
          taxonomy: cleanTaxonomy,
          iucn: []
        });
      } else {
        setTaxaType('flora');
        // 清空動物過濾器，避免衝突
        setSelectedFilters({
          taxonomy: { phylum_eng: [], class_eng: [], order_eng: [], family_eng: [], genus_eng: [], informal_group_eng: [] },
          iucn: []
        });
        
        setPlantFilters({
          ...INITIAL_PLANT_FILTERS,
          [level]: [value],
          searchQuery: ''
        });
      }
      
      setSearchQuery('');
      setIsFilterOpen(true);
      setCurrentPage(1);
      
      // 重要：處理完畢後清空請求，防止重複觸發
      setPendingTaxonomyFilter(null);
    }
  }, [pendingTaxonomyFilter, setPendingTaxonomyFilter, setIsFilterOpen]);

  // 1. 僅在初次掛載時處理 sessionStorage 搜尋負載
  useEffect(() => {
    try {
      const internalSearch = sessionStorage.getItem('hkbc_quick_search');
      if (internalSearch) {
        const payload = JSON.parse(internalSearch);
        if (payload.q) {
          setSearchQuery(payload.q);
          if (payload.type === 'flora') {
            setPlantFilters(prev => ({ ...prev, searchQuery: payload.q }));
          }
        }
        if (payload.type) {
          setTaxaType(payload.type);
        }
        // 處理完畢後立即清除，避免重新整理時重複觸發
        sessionStorage.removeItem('hkbc_quick_search');
      }
    } catch (err) {
      console.error('Failed to parse internal search payload', err);
    }
  }, []); // 嚴格僅執行一次

  // 2. 持續監聽 URL 參數 (species, taxonomy, type, q)
  useEffect(() => {
    const speciesId = searchParams.get('species');
    if (speciesId) {
      addSpecies(speciesId);
    }

    // 處理類型切換參數 (URL Override)
    const typeFromUrl = searchParams.get('type') as TaxaType | null;
    if (typeFromUrl && (typeFromUrl === 'fauna' || typeFromUrl === 'flora')) {
      setTaxaType(typeFromUrl);
    }

    // 處理搜尋關鍵字參數 (URL Fallback)
    const queryFromUrl = searchParams.get('q');
    if (queryFromUrl) {
      setSearchQuery(queryFromUrl);
      if (typeFromUrl === 'flora' || (typeFromUrl === null && taxaType === 'flora')) {
        setPlantFilters(prev => ({ ...prev, searchQuery: queryFromUrl }));
      }
    }

    // 處理分類搜尋參數
    const faunaTaxaLevels = ['phylum_eng', 'class_eng', 'order_eng', 'family_eng', 'genus_eng', 'informal_group_eng'];
    const floraTaxaLevels = ['categories', 'families', 'genuses'];
    
    let hasTaxonomyParam = false;
    
    // 檢查動物分類
    for (const level of faunaTaxaLevels) {
      const val = searchParams.get(level);
      if (val) {
        setTaxaType('fauna');
        const cleanTaxonomy: any = { 
          phylum_eng: [], class_eng: [], order_eng: [], family_eng: [], genus_eng: [], informal_group_eng: [] 
        };
        cleanTaxonomy[level] = [val];
        setSelectedFilters({
          taxonomy: cleanTaxonomy,
          iucn: []
        });
        setSearchQuery(''); 
        setIsFilterOpen(true);
        hasTaxonomyParam = true;
        break;
      }
    }
    
    // 檢查植物分類
    if (!hasTaxonomyParam) {
      for (const level of floraTaxaLevels) {
        const val = searchParams.get(level);
        if (val) {
          setTaxaType('flora');
          setPlantFilters({
            ...INITIAL_PLANT_FILTERS,
            [level]: [val],
            searchQuery: ''
          });
          setSearchQuery('');
          setIsFilterOpen(true);
          hasTaxonomyParam = true;
          break;
        }
      }
    }

    // 3. 清理 URL 參數 (僅針對 species 參數，且只在初始化或特定情境下執行)
    // 注意：為了避免 router.replace 與面板開啟衝突，我們只有在真正需要清理時才呼叫
    const timer = setTimeout(() => {
      if (speciesId && window.location.search.includes('species=')) {
        const params = new URLSearchParams(window.location.search);
        params.delete('species');
        const newQuery = params.toString();
        router.replace(newQuery ? `/database?${newQuery}` : '/database', { scroll: false });
      }
    }, 1000); // 延遲清理，確保面板已穩定開啟

    return () => clearTimeout(timer);
  }, [searchParams, addSpecies, setIsFilterOpen, router]);

  // 權限管制防護：未登入或 user status !== 'active' 時顯示存取限制鎖定頁面
  if (!isAuthLoading && !isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900 relative overflow-hidden">
        <Header />
        
        {/* Background Ambience */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/90 via-slate-900/95 to-slate-950 z-10" />
          <img 
            src="/cloudinary/dpvdoeoc0/image/upload/f_auto,q_auto/v1786118511/hero_bg/photo-1518173946687-a4c8892bbd9f.jpg" 
            alt="Nature Background"
            className="w-full h-full object-cover blur-md opacity-25 scale-105"
          />
        </div>

        <main className="relative z-20 max-w-4xl mx-auto px-6 pt-36 pb-20 min-h-[85vh] flex items-center justify-center">
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full bg-white/95 backdrop-blur-2xl rounded-[3rem] p-8 sm:p-12 shadow-2xl border border-white/80 text-center relative overflow-hidden"
          >
            <div className="w-20 h-20 bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 rounded-3xl mx-auto mb-6 shadow-xl shadow-emerald-500/20">
              <div className="w-full h-full bg-white rounded-[1.4rem] flex items-center justify-center">
                <Lock className="w-10 h-10 text-emerald-600" />
              </div>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
              {language === 'zh' ? '資料庫僅供已啟用會員存取' : 'Database Access Restricted'}
            </h1>

            <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-6">
              {language === 'zh' ? '需要登入與 Active 帳號狀態' : 'Login & Active Account Required'}
            </p>

            <div className="max-w-md mx-auto bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-8 text-left space-y-3">
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                {language === 'zh'
                  ? '香港自然生態物種資料庫包含上萬筆生物數據與研究級影像紀錄。根據權限規範，資料庫內容、Quick Search 快搜及 AI 物種辨識功能僅開放予已登入且帳號狀態為 Active 的正式會員使用。'
                  : 'The species database, Quick Search, and AI Photo Recognition are restricted to signed-in members with an Active account status.'}
              </p>
            </div>

            <div className="max-w-xs mx-auto space-y-3">
              <button
                onClick={() => openAuthReminder('資料庫全庫檢索')}
                className="w-full py-4 px-6 bg-slate-900 hover:bg-emerald-600 text-white font-bold text-sm rounded-2xl shadow-xl hover:shadow-emerald-500/20 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer group active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>{language === 'zh' ? '登入 / 註冊會員' : 'Sign In / Register'}</span>
              </button>

              <Link
                href="/"
                className="block w-full py-3 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
              >
                {language === 'zh' ? '返回網站首頁' : 'Return to Home'}
              </Link>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <Header />

      <main className={`max-w-[1920px] mx-auto px-6 md:px-8 lg:px-10 xl:px-16 pt-28 md:pt-36 transition-all duration-500 ${openSpeciesIds.length > 0 ? 'pb-32' : 'pb-10'}`}>
        <div className="flex flex-col min-[1101px]:flex-row gap-0 min-[1101px]:gap-16">

          {/* Sidebar Area */}
          <div className="shrink-0 min-[1101px]:w-[320px]">
            
            {taxaType === 'fauna' ? (
                <SidebarFilter
                    isOpen={isFilterOpen}
                    onClose={() => setIsFilterOpen(false)}
                    onFilterChange={setSelectedFilters}
                    onSearchSubmit={setSearchQuery}
                    searchQuery={searchQuery}
                    selectedFilters={selectedFilters}
                    activeTaxaType={taxaType}
                    onTaxaChange={handleTaxaChange}
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
                            onReset={() => {
                                setPlantFilters(INITIAL_PLANT_FILTERS);
                                setSearchQuery('');
                            }}
                            onSearchSubmit={setSearchQuery}
                            activeTaxaType={taxaType}
                            onTaxaChange={handleTaxaChange}
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
                {/* Left: Filter Toggle (visible when needed) */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setIsFilterOpen(true)}
                    className="min-[1101px]:hidden p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                    title={t('filter.title')}
                  >
                    <Filter className="w-4 h-4" />
                  </button>
                </div>

                {/* Center: Controls Grouped Tightly with Custom Scroll */}
                <div className="flex-1 min-w-0 flex items-center justify-center">
                  <div className="flex items-center gap-2 lg:gap-4 bg-slate-50/50 p-1 rounded-2xl border border-slate-100/50 overflow-x-auto custom-scrollbar scroll-smooth">
                    <div className="flex items-center gap-2 pl-2 shrink-0">
                      {showLabels && <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">{t('sort.label')}</span>}
                      <CustomDropdown
                        size="sm"
                        disabled={displayMode === 'table'}
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

                    {showLabels && <div className="h-4 w-px bg-slate-200/60 shrink-0" />}

                    <div className="flex items-center gap-2 px-1 shrink-0">
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

                    <div className="h-4 w-px bg-slate-200/60 shrink-0" />

                    <div className="flex items-center gap-2 px-1 text-slate-300 shrink-0">
                      {showLabels && <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">{t('view.display_mode')}</span>}
                      <div className="flex bg-white shadow-sm ring-1 ring-slate-100 rounded-lg p-0.5">
                        {[
                          { id: 'detail', icon: TableIcon, title: t('view.mode_detail') },
                          { id: 'photo', icon: LayoutGrid, title: t('view.mode_photo') },
                          { id: 'table', icon: List, title: t('view.mode_table') }
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
                </div>

                {/* Right: Compact Pagination & Results Count */}
                <div className="flex items-center gap-4 shrink-0 bg-white/80 md:bg-transparent pl-2">
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
                            taxaType={taxaType}
                            species={species}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            filters={tableFilters}
                            metadata={tableMetadata}
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
                                onTaxonomyClick={handleTaxonomyClick}
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
                  <div className="mt-6 sm:mt-16 pt-5 sm:pt-10 border-t border-slate-200/60 flex flex-col items-center gap-4 sm:gap-6">
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
          onReset={() => {
            setPlantFilters(INITIAL_PLANT_FILTERS);
            setSearchQuery('');
          }}
          onSearchSubmit={setSearchQuery}
          activeTaxaType={taxaType}
          onTaxaChange={handleTaxaChange}
        />
      )}
    </div>
  );
}
