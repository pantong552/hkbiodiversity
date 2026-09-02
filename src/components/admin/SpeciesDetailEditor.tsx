'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { useTaxonomy } from '@/context/TaxonomyContext';
import { useAuth } from '@/context/AuthContext';
import { 
  Save, 
  RotateCcw, 
  X, 
  Loader2, 
  FileText, 
  Lock, 
  Layers, 
  ShieldAlert, 
  MapPin, 
  Plus,
  ExternalLink,
  Search,
  BookOpen,
  ChevronDown,
  Check,
  Sparkles,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatScientificName, parseAliases, renderFormattedText } from '@/utils/formatters';

interface SimilarSpeciesPickerProps {
  value: string;
  onChange: (value: string) => void;
  table: string;
  supabase: any;
  language: string;
}

function SimilarSpeciesPicker({ value, onChange, table, supabase, language }: SimilarSpeciesPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedDetails, setSelectedDetails] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 監聽點擊外部關閉下拉選單
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 解析並加載已選物種詳情
  useEffect(() => {
    async function loadSelectedDetails() {
      const ids = value.split(',').map(id => id.trim()).filter(Boolean);
      if (ids.length === 0) {
        setSelectedDetails([]);
        return;
      }
      const targetTable = table === 'plant_species' ? 'plant_species' : 'species';
      const { data, error } = await supabase
        .from(targetTable)
        .select('taxa_id, scientific_name, common_name_chi, common_name_eng')
        .in('taxa_id', ids);
      
      if (!error && data) {
        // 保留原 ids 的順序
        const sorted = ids.map(id => data.find((item: any) => item.taxa_id === id)).filter(Boolean);
        setSelectedDetails(sorted);
      }
    }
    loadSelectedDetails();
  }, [value, table, supabase]);

  // 搜尋處理
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const targetTable = table === 'plant_species' ? 'plant_species' : 'species';
      const ids = value.split(',').map(id => id.trim()).filter(Boolean);

      const { data, error } = await supabase
        .from(targetTable)
        .select('taxa_id, scientific_name, common_name_chi, common_name_eng')
        .or(`scientific_name.ilike.%${searchQuery}%,common_name_chi.ilike.%${searchQuery}%,common_name_eng.ilike.%${searchQuery}%`)
        .limit(8);

      if (!error && data) {
        // 過濾已選中的項目
        const filtered = data.filter((item: any) => !ids.includes(item.taxa_id));
        setSearchResults(filtered);
      }
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, value, table, supabase]);

  // 新增選擇
  const handleSelect = (item: any) => {
    const ids = value.split(',').map(id => id.trim()).filter(Boolean);
    if (!ids.includes(item.taxa_id)) {
      const newIds = [...ids, item.taxa_id];
      onChange(newIds.join(', '));
    }
    setSearchQuery('');
    setShowDropdown(false);
  };

  // 移除選擇
  const handleRemove = (taxaId: string) => {
    const ids = value.split(',').map(id => id.trim()).filter(Boolean);
    const newIds = ids.filter(id => id !== taxaId);
    onChange(newIds.join(', '));
  };

  return (
    <div ref={containerRef} className="relative flex flex-col gap-3 w-full bg-slate-50/30 border border-slate-100/80 rounded-2xl p-4">
      {/* 搜尋框 */}
      <div className="relative">
        <div className="flex items-center bg-white border border-slate-200 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/20 rounded-xl px-3 py-2 transition-all shadow-sm">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            placeholder={language === 'zh' ? '搜尋物種中文名稱、英文名稱或學名...' : 'Search common name or scientific name...'}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            className="w-full bg-transparent border-none outline-none text-xs font-semibold text-slate-700 placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 搜尋下拉結果 */}
        <AnimatePresence>
          {showDropdown && (searchQuery.trim() !== '') && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute z-50 left-0 right-0 mt-1 bg-white/95 backdrop-blur-md border border-slate-100 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar"
            >
              {isSearching ? (
                <div className="p-3 text-center text-xs text-slate-400 font-bold flex items-center justify-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                  <span>{language === 'zh' ? '搜尋中...' : 'Searching...'}</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400 font-bold">
                  {language === 'zh' ? '未找到符合的物種' : 'No matching species found'}
                </div>
              ) : (
                searchResults.map((item) => {
                  const chiName = item.common_name_chi;
                  const engName = item.common_name_eng;
                  const showName = chiName && engName ? `${chiName} (${engName})` : (chiName || engName || '');
                  return (
                    <button
                      key={item.taxa_id}
                      onClick={() => handleSelect(item)}
                      className="w-full text-left px-4 py-2.5 hover:bg-emerald-50/50 flex flex-col transition-colors border-b border-slate-50 last:border-0 cursor-pointer"
                    >
                      <span className="text-xs font-bold text-slate-700">
                        {showName}
                        <span className="text-[10px] font-medium text-slate-400 ml-2">({item.taxa_id})</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-serif italic">{item.scientific_name}</span>
                    </button>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 已選物種列表 */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
          {language === 'zh' ? '已選擇的相似物種' : 'Selected Similar Species'} ({selectedDetails.length})
        </span>
        {selectedDetails.length === 0 ? (
          <div className="text-center py-4 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-bold bg-white/20">
            {language === 'zh' ? '尚未選擇任何相似物種' : 'No similar species selected yet'}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedDetails.map((item) => {
              const chiName = item.common_name_chi;
              const engName = item.common_name_eng;
              const displayName = language === 'zh' ? (chiName || engName) : (engName || chiName);
              return (
                <motion.div
                  key={item.taxa_id}
                  layout
                  className="flex items-center gap-2 pl-3 pr-2 py-1.5 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-emerald-200 transition-colors"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-slate-700 truncate leading-snug">
                      {displayName}
                    </span>
                    <span className="text-[9px] font-serif italic text-slate-400 leading-none mt-0.5">{item.scientific_name}</span>
                  </div>
                  <button
                    onClick={() => handleRemove(item.taxa_id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer hover:scale-105"
                    title={language === 'zh' ? '移除' : 'Remove'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  isFieldDirty: boolean;
  language: string;
}

function CustomSelect({ value, onChange, options, isFieldDirty, language }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = value
    ? value
    : (language === 'zh' ? '-- 空白 / 未設定 --' : '-- Blank / Not set --');

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 outline-none border cursor-pointer ${
          isFieldDirty
            ? 'border-emerald-400 font-bold bg-white text-emerald-950 shadow-xs ring-1 ring-emerald-500/20'
            : 'bg-slate-50/50 hover:bg-slate-50 border-slate-100 hover:border-slate-200 text-slate-700'
        } ${isOpen ? 'ring-2 ring-emerald-500/20 border-emerald-500 bg-white' : ''}`}
      >
        <span className={!value ? 'text-slate-400 font-normal italic' : ''}>
          {selectedLabel}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-600' : ''}`} />
      </button>

      {/* Custom Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 left-0 right-0 bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-2xl rounded-2xl p-1.5 flex flex-col gap-0.5 max-h-56 overflow-y-auto custom-scrollbar"
          >
            {/* Blank Option */}
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                !value
                  ? 'bg-emerald-50 text-emerald-800 font-bold'
                  : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
              }`}
            >
              <span className="italic">{language === 'zh' ? '-- 空白 / 未設定 --' : '-- Blank / Not set --'}</span>
              {!value && <Check className="w-3.5 h-3.5 text-emerald-600" />}
            </button>

            {/* Value Options */}
            {options.map((opt) => {
              const isSelected = value === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-900 shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-emerald-700'
                  }`}
                >
                  <span>{opt}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type SourceType = 'journal' | 'book' | 'web';

interface ReferencePickerProps {
  value: string;
  onChange: (value: string) => void;
  supabase: any;
  language: string;
}

function ReferencePicker({ value, onChange, supabase, language }: ReferencePickerProps) {
  const [allReferences, setAllReferences] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 新增參考文獻 Modal 狀態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formCode, setFormCode] = useState('');
  const [formZh, setFormZh] = useState('');
  const [formEn, setFormEn] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // APA Helper 狀態
  const [showHelper, setShowHelper] = useState(false);
  const [helperType, setHelperType] = useState<SourceType>('web');
  const [helperAuthor, setHelperAuthor] = useState('');
  const [helperYear, setHelperYear] = useState('');
  const [helperTitle, setHelperTitle] = useState('');
  const [helperSource, setHelperSource] = useState('');
  const [helperVolIssue, setHelperVolIssue] = useState('');
  const [helperPages, setHelperPages] = useState('');
  const [helperUrl, setHelperUrl] = useState('');
  const [helperPreview, setHelperPreview] = useState('');

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadAllReferences = async () => {
    setIsSearching(true);
    try {
      const { data: refData, error: refError } = await supabase
        .from('references')
        .select('*')
        .order('code', { ascending: true });
        
      if (refError) throw refError;

      if (!refData || refData.length === 0) {
        setAllReferences([]);
        return;
      }

      // 收集 user ids
      const userIds = Array.from(
        new Set(
          refData
            .flatMap((r: any) => [r.created_by, r.updated_by])
            .filter(Boolean)
        )
      );

      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds);

        if (profileData) {
          profileMap = profileData.reduce((acc: Record<string, string>, p: any) => {
            if (p.id) acc[p.id] = p.username || '';
            return acc;
          }, {} as Record<string, string>);
        }
      }

      const enrichedRefs = refData.map((r: any) => ({
        ...r,
        creator: r.created_by && profileMap[r.created_by] ? { username: profileMap[r.created_by] } : null,
        updater: r.updated_by && profileMap[r.updated_by] ? { username: profileMap[r.updated_by] } : null
      }));

      setAllReferences(enrichedRefs);
    } catch (err) {
      console.error('Error loading references:', err);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    loadAllReferences();
  }, [supabase]);

  const selectedRefs = useMemo(() => {
    const codes = value.split(',').map(c => c.trim()).filter(Boolean);
    return codes.map(code => allReferences.find(r => r.code === code)).filter(Boolean);
  }, [value, allReferences]);

  const dropdownResults = useMemo(() => {
    const codes = value.split(',').map(c => c.trim()).filter(Boolean);
    
    // 如果沒有輸入任何搜尋字，預設列出所有未選取文獻供直接選擇
    if (!searchQuery.trim()) {
      return allReferences.filter(r => !codes.includes(r.code)).slice(0, 15);
    }
    
    const q = searchQuery.toLowerCase();
    return allReferences.filter(r => 
      !codes.includes(r.code) && 
      (r.code.toLowerCase().includes(q) || 
       r.zh.toLowerCase().includes(q) || 
       r.en.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [searchQuery, allReferences, value]);

  const handleSelect = (code: string) => {
    const codes = value.split(',').map(c => c.trim()).filter(Boolean);
    if (!codes.includes(code)) {
      const newCodes = [...codes, code];
      onChange(newCodes.join(', '));
    }
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleRemove = (code: string) => {
    const codes = value.split(',').map(c => c.trim()).filter(Boolean);
    const newCodes = codes.filter(c => c !== code);
    onChange(newCodes.join(', '));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const codes = value.split(',').map(c => c.trim()).filter(Boolean);
    const temp = codes[index];
    codes[index] = codes[index - 1];
    codes[index - 1] = temp;
    onChange(codes.join(', '));
  };

  const handleMoveDown = (index: number) => {
    const codes = value.split(',').map(c => c.trim()).filter(Boolean);
    if (index === codes.length - 1) return;
    const temp = codes[index];
    codes[index] = codes[index + 1];
    codes[index + 1] = temp;
    onChange(codes.join(', '));
  };

  // 開啟新增參考文獻 Modal
  const handleOpenAddModal = () => {
    // 自動計算最小未使用的 ref_N 代碼 (包含重用空置代碼)
    const numbers = allReferences
      .map(r => {
        const match = r.code.match(/^ref_(\d+)$/i);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((n): n is number => n !== null);
      
    let nextNum = 1;
    while (numbers.includes(nextNum)) {
      nextNum++;
    }
    
    setFormCode(`ref_${nextNum}`);
    setFormZh('');
    setFormEn('');
    setFormUrl('');
    setFormError('');
    setShowHelper(false);
    setIsModalOpen(true);
  };

  // 提交新增參考文獻
  const handleCreateReference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formZh.trim() || !formEn.trim()) {
      setFormError(language === 'zh' ? '請填寫所有必要欄位' : 'Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id || null;

      const { data, error } = await supabase
        .from('references')
        .insert({
          code: formCode.trim(),
          zh: formZh.trim(),
          en: formEn.trim(),
          url: formUrl.trim() || null,
          created_by: currentUserId,
          updated_by: currentUserId
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error(language === 'zh' ? '編碼已存在，請使用不同的編碼' : 'Code already exists. Please use a unique code.');
        }
        throw error;
      }
      
      if (data) {
        // 更新本地參考文獻清單
        setAllReferences(prev => [...prev, data].sort((a, b) => a.code.localeCompare(b.code)));
        // 自動選取新增的文獻
        handleSelect(data.code);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving reference:', err);
      setFormError(err.message || (language === 'zh' ? '儲存失敗，請重試' : 'Failed to save reference. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  // APA 7 格式即時預覽生成邏輯
  useEffect(() => {
    if (!showHelper) return;
    
    const authorStr = helperAuthor.trim() || 'Author';
    const yearStr = helperYear.trim() ? `(${helperYear.trim()})` : '(n.d.)';
    const titleStr = helperTitle.trim() ? `*${helperTitle.trim()}*` : 'Title';
    const sourceStr = helperSource.trim();
    const urlStr = helperUrl.trim();
    
    let preview = '';
    
    if (helperType === 'journal') {
      const volIssueStr = helperVolIssue.trim() ? `, *${helperVolIssue.trim()}*` : '';
      const pagesStr = helperPages.trim() ? `, ${helperPages.trim()}` : '';
      preview = `${authorStr}. ${yearStr}. ${helperTitle.trim() || 'Title'}. ${sourceStr ? `*${sourceStr}*` : 'Journal'}${volIssueStr}${pagesStr}.${urlStr ? ` ${urlStr}` : ''}`;
    } else if (helperType === 'book') {
      preview = `${authorStr}. ${yearStr}. ${titleStr}. ${sourceStr || 'Publisher'}.${urlStr ? ` ${urlStr}` : ''}`;
    } else { // web
      preview = `${authorStr}. ${yearStr}. ${helperTitle.trim() || 'Title'}. ${sourceStr ? `${sourceStr}.` : ''} ${language === 'zh' ? '擷取自' : 'Retrieved from'} ${urlStr || 'URL'}`;
    }
    
    setHelperPreview(preview);
  }, [helperType, helperAuthor, helperYear, helperTitle, helperSource, helperVolIssue, helperPages, helperUrl, showHelper, language]);

  const handleApplyHelper = (lang: 'zh' | 'en') => {
    if (lang === 'zh') {
      setFormZh(helperPreview);
    } else {
      setFormEn(helperPreview);
    }
    setHelperAuthor('');
    setHelperYear('');
    setHelperTitle('');
    setHelperSource('');
    setHelperVolIssue('');
    setHelperPages('');
    setHelperUrl('');
    setShowHelper(false);
  };

  return (
    <div ref={containerRef} className="relative flex flex-col gap-3 w-full bg-slate-50/30 border border-slate-100/80 rounded-2xl p-4">
      {/* 搜尋與新增按鈕區域 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <div className="flex items-center bg-white border border-slate-200 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/20 rounded-xl px-3 py-2 transition-all shadow-sm">
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder={language === 'zh' ? '搜尋文獻代碼、內容...' : 'Search reference code, content...'}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onClick={() => setShowDropdown(true)}
              className="w-full bg-transparent border-none outline-none text-xs font-semibold text-slate-700 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute z-50 left-0 right-0 mt-1 bg-white/95 backdrop-blur-md border border-slate-100 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar"
              >
                {isSearching ? (
                  <div className="p-3 text-center text-xs text-slate-400 font-bold flex items-center justify-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                    <span>{language === 'zh' ? '載入中...' : 'Loading...'}</span>
                  </div>
                ) : dropdownResults.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400 font-bold">
                    {language === 'zh' ? '未找到符合的文獻' : 'No matching references found'}
                  </div>
                ) : (
                  dropdownResults.map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => handleSelect(item.code)}
                      className="w-full text-left px-4 py-2.5 hover:bg-emerald-50/50 flex flex-col transition-colors border-b border-slate-50 last:border-0 cursor-pointer"
                    >
                      <span className="text-xs font-bold text-slate-700">
                        [{item.code}]
                      </span>
                      <span className="text-[10px] text-slate-400 truncate mt-0.5">
                        {language === 'zh' ? item.zh : item.en}
                      </span>
                    </button>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 新增參考文獻按鈕 */}
        <button
          type="button"
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all shrink-0 cursor-pointer"
          title={language === 'zh' ? '新增參考文獻' : 'Add Reference'}
        >
          <Plus className="w-4 h-4" />
          <span>{language === 'zh' ? '新增參考文獻' : 'Add Reference'}</span>
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
          {language === 'zh' ? '已選擇的參考文獻' : 'Selected References'} ({selectedRefs.length})
        </span>
        {selectedRefs.length === 0 ? (
          <div className="text-center py-4 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-bold bg-white/20">
            {language === 'zh' ? '尚未選擇任何參考文獻' : 'No references selected yet'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {selectedRefs.map((item, idx) => {
              const text = language === 'zh' ? item.zh : item.en;
              const creatorName = item.creator?.username;
              const updaterName = item.updater?.username;

              return (
                <motion.div
                  key={item.code}
                  layout
                  className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-emerald-200 transition-colors"
                >
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5 w-max">
                        {item.code}
                      </span>
                      {creatorName && (
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.2" title={language === 'zh' ? `建立者: ${creatorName}` : `Created by: ${creatorName}`}>
                          @{creatorName}
                        </span>
                      )}
                      {updaterName && updaterName !== creatorName && (
                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50/50 border border-emerald-100 rounded px-1.5 py-0.2" title={language === 'zh' ? `最後修改: ${updaterName}` : `Updated by: ${updaterName}`}>
                          ✎ {updaterName}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-slate-600 leading-relaxed mt-1.5">
                      {renderFormattedText(text)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0}
                      className="p-1 rounded-lg text-slate-450 hover:text-emerald-600 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title={language === 'zh' ? '上移' : 'Move Up'}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === selectedRefs.length - 1}
                      className="p-1 rounded-lg text-slate-450 hover:text-emerald-600 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title={language === 'zh' ? '下移' : 'Move Down'}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(item.code)}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer hover:scale-105"
                      title={language === 'zh' ? '移除' : 'Remove'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* 新增參考文獻 Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            {/* Modal Body */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-4xl bg-white/95 backdrop-blur-2xl border border-slate-100 rounded-[2.5rem] shadow-2xl p-6 md:p-8 flex flex-col md:flex-row gap-6 max-h-[90vh] overflow-hidden z-10"
            >
              {/* 左側：表單編輯區域 */}
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar pr-1">
                <div className="flex items-center gap-2 mb-4 shrink-0">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <h3 className="text-md font-black text-slate-800">
                    {language === 'zh' ? '新增參考文獻' : 'Add Reference'}
                  </h3>
                </div>

                <form onSubmit={handleCreateReference} className="flex-1 flex flex-col gap-4">
                  {/* Code */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>{language === 'zh' ? '文獻唯一代碼 (Code)' : 'Unique Code'}</span>
                      <span className="text-[9px] text-slate-300 font-mono">(自動生成 / Auto-generated)</span>
                    </label>
                    <input 
                      type="text"
                      required
                      readOnly
                      value={formCode}
                      className="w-full bg-slate-100 border border-slate-200 text-slate-400 rounded-xl px-4 py-2.5 text-xs font-semibold cursor-not-allowed outline-none select-none"
                    />
                  </div>

                  {/* 中文 */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {language === 'zh' ? '中文 APA 7th 格式內容' : 'Chinese APA 7th Content'}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setHelperType('web');
                          setShowHelper(!showHelper);
                        }}
                        className="text-[9px] font-black text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>APA 產生器</span>
                      </button>
                    </div>
                    <textarea 
                      required
                      rows={3}
                      placeholder={language === 'zh' ? '請輸入符合 APA 第 7 版格式的中文文獻內容...' : 'Enter reference in APA 7th format...'}
                      value={formZh}
                      onChange={(e) => setFormZh(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition-all custom-scrollbar leading-relaxed"
                    />
                  </div>

                  {/* 英文 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      {language === 'zh' ? '英文 APA 7th 格式內容' : 'English APA 7th Content'}
                    </label>
                    <textarea 
                      required
                      rows={3}
                      placeholder={language === 'zh' ? '請輸入符合 APA 第 7 版格式的英文文獻內容...' : 'Enter reference in APA 7th format...'}
                      value={formEn}
                      onChange={(e) => setFormEn(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition-all custom-scrollbar leading-relaxed"
                    />
                  </div>

                  {/* 超連結 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      {language === 'zh' ? '文獻超連結 / Hyperlink (URL)' : 'Hyperlink (URL)'}
                    </label>
                    <input 
                      type="url"
                      placeholder="e.g. https://www.example.com"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 outline-none transition-all"
                    />
                  </div>

                  {formError && (
                    <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold flex items-start gap-1.5">
                      <Info className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-3 mt-4 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      {language === 'zh' ? '取消' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {submitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        language === 'zh' ? '儲存並選取' : 'Save & Select'
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* 右側：APA 7th Formatter Helper 區域 */}
              <AnimatePresence>
                {showHelper && (
                  <motion.div 
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 340, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="w-[340px] shrink-0 border-l border-slate-100 pl-6 flex flex-col min-h-0 overflow-y-auto custom-scrollbar justify-between"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                          {language === 'zh' ? 'APA 產生輔助器' : 'APA Generator Helper'}
                        </span>
                        <button 
                          type="button"
                          onClick={() => setShowHelper(false)}
                          className="p-1 hover:bg-slate-50 rounded-lg text-slate-400 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* 類型選擇 */}
                      <div className="flex border border-slate-200 rounded-xl overflow-hidden text-xs font-bold shrink-0">
                        {(['web', 'journal', 'book'] as const).map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setHelperType(type)}
                            className={`flex-1 py-2 transition-colors cursor-pointer ${helperType === type ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                          >
                            {type === 'web' 
                              ? (language === 'zh' ? '網頁/資料庫' : 'Web/Database') 
                              : type === 'journal' 
                              ? (language === 'zh' ? '期刊' : 'Journal') 
                              : (language === 'zh' ? '圖書' : 'Book')}
                          </button>
                        ))}
                      </div>

                      {/* 產生器欄位 */}
                      <div className="space-y-3.5">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {language === 'zh' ? '作者 (Authors)' : 'Authors'}
                          </label>
                          <input 
                            type="text"
                            placeholder={language === 'zh' ? 'e.g. 葉國樑 或 Yip, K. L.' : 'e.g. Yip, K. L. or AFCD'}
                            value={helperAuthor}
                            onChange={(e) => setHelperAuthor(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {language === 'zh' ? '出版年份 (Year)' : 'Year'}
                          </label>
                          <input 
                            type="text"
                            placeholder="e.g. 2010"
                            value={helperYear}
                            onChange={(e) => setHelperYear(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {language === 'zh' ? '標題 (Title)' : 'Title'}
                          </label>
                          <input 
                            type="text"
                            placeholder={language === 'zh' ? 'e.g. 香港蝴蝶圖誌' : 'e.g. Butterflies of HK'}
                            value={helperTitle}
                            onChange={(e) => setHelperTitle(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {helperType === 'journal' 
                              ? (language === 'zh' ? '期刊名稱 (Journal)' : 'Journal Name') 
                              : helperType === 'book' 
                              ? (language === 'zh' ? '出版社 (Publisher)' : 'Publisher') 
                              : (language === 'zh' ? '網站名稱 (Website)' : 'Website Name')}
                          </label>
                          <input 
                            type="text"
                            placeholder={helperType === 'journal' 
                              ? (language === 'zh' ? 'e.g. 香港學報' : 'e.g. Journal of Ecology') 
                              : helperType === 'book' 
                              ? (language === 'zh' ? 'e.g. 郊野公園之友會' : 'e.g. Friends of Country Parks') 
                              : (language === 'zh' ? 'e.g. 漁農自然護理署' : 'e.g. AFCD')}
                            value={helperSource}
                            onChange={(e) => setHelperSource(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10"
                          />
                        </div>

                        {helperType === 'journal' && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                {language === 'zh' ? '卷期 (Vol/Issue)' : 'Vol/Issue'}
                              </label>
                              <input 
                                type="text"
                                placeholder="e.g. 1(2)"
                                value={helperVolIssue}
                                onChange={(e) => setHelperVolIssue(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                              />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                {language === 'zh' ? '頁碼 (Pages)' : 'Pages'}
                              </label>
                              <input 
                                type="text"
                                placeholder="e.g. 10-15"
                                value={helperPages}
                                onChange={(e) => setHelperPages(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {language === 'zh' ? '連結網址 (URL / DOI)' : 'URL / DOI'}
                          </label>
                          <input 
                            type="text"
                            placeholder="e.g. https://..."
                            value={helperUrl}
                            onChange={(e) => setHelperUrl(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Preview & Apply */}
                    <div className="mt-4 pt-3.5 border-t border-slate-100 bg-slate-50/50 p-3 rounded-xl space-y-3 shrink-0">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {language === 'zh' ? 'APA 格式即時預覽：' : 'APA Live Preview:'}
                      </span>
                      <p className="text-xs font-bold text-slate-700 bg-white border border-slate-100 p-2.5 rounded-xl leading-relaxed select-all">
                        {helperPreview}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleApplyHelper('zh')}
                          className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-100 transition-colors cursor-pointer"
                        >
                          {language === 'zh' ? '帶入中文' : 'Apply to Zh'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyHelper('en')}
                          className="flex-1 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          {language === 'zh' ? '帶入英文' : 'Apply to En'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FieldConfig {
  key: string;
  labelChi: string;
  labelEng: string;
  type: 'text' | 'number' | 'textarea' | 'select';
  readOnly?: boolean;
  options?: string[];
}

interface FieldGroup {
  id: string;
  nameChi: string;
  nameEng: string;
  icon: React.ReactNode;
  fields: FieldConfig[];
}

interface SpeciesDetailEditorProps {
  table: string;
  data: any;
  originalData?: any;
  publishedOriginal?: any;
  onSave: (updatedItem: any, affectedUpdates?: Record<string, string>) => void;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  saveButtonLabel?: string;
  hideHeader?: boolean;
  onRegisterSave?: (saveFn: () => void) => void;
  disableDirectDatabaseUpdate?: boolean;
}

// 1. 動物 (species) 欄位組配置
const faunaFieldGroups = (t: any): FieldGroup[] => [
  {
    id: 'basic',
    nameChi: '基本資訊',
    nameEng: 'Basic Info',
    icon: <FileText className="w-4 h-4" />,
    fields: [
      { key: 'taxa_id', labelChi: '物種 ID', labelEng: 'Taxa ID', type: 'text', readOnly: true },
      { key: 'inat_id', labelChi: 'iNaturalist ID', labelEng: 'iNaturalist ID', type: 'number' },
      { key: 'col_usage_id', labelChi: 'Catalogue of Life ID', labelEng: 'Catalogue of Life ID', type: 'text' },
      { key: 'ebird_species_code', labelChi: 'eBird Species Code', labelEng: 'eBird Species Code', type: 'text' },
      { key: 'taxa_group', labelChi: '物種分類群', labelEng: 'Taxa Group', type: 'text' },
      { key: 'informal_group_eng', labelChi: '非正式群組 (英)', labelEng: 'Informal Group (Eng)', type: 'text' },
      { key: 'informal_group_chi', labelChi: '非正式群組 (中)', labelEng: 'Informal Group (Chi)', type: 'text', readOnly: true },
      { key: 'common_name_chi', labelChi: '中文俗名', labelEng: 'Common Name (Chi)', type: 'text' },
      { key: 'common_name_eng', labelChi: '英文俗名', labelEng: 'Common Name (Eng)', type: 'text' },
      { key: 'scientific_name', labelChi: '學名', labelEng: 'Scientific Name', type: 'text' },
      { key: 'author', labelChi: '命名者', labelEng: 'Author', type: 'text' },
      { key: 'alias_scientific_name', labelChi: '學名別名', labelEng: 'Alias Scientific Name', type: 'text' },
      {key: 'alias_common_name_chi', labelChi: '中文俗名別名', labelEng: 'Alias Common Name (Chi)', type: 'text'},
      {key: 'alias_common_name_eng', labelChi: '英文俗名別名', labelEng: 'Alias Common Name (Eng)', type: 'text'},
    ]
  },
  {
    id: 'taxonomy',
    nameChi: '分類學資訊',
    nameEng: 'Taxonomy',
    icon: <Layers className="w-4 h-4" />,
    fields: [
      {key: 'phylum_eng', labelChi: '門 (英)', labelEng: 'Phylum (Eng)', type: 'text'},
      {key: 'phylum_chi', labelChi: '門 (中)', labelEng: 'Phylum (Chi)', type: 'text', readOnly: true},
      {key: 'class_eng', labelChi: '綱 (英)', labelEng: 'Class (Eng)', type: 'text'},
      {key: 'class_chi', labelChi: '綱 (中)', labelEng: 'Class (Chi)', type: 'text', readOnly: true},
      {key: 'order_eng', labelChi: '目 (英)', labelEng: 'Order (Eng)', type: 'text'},
      {key: 'order_chi', labelChi: '目 (中)', labelEng: 'Order (Chi)', type: 'text', readOnly: true},
      {key: 'family_eng', labelChi: '科 (英)', labelEng: 'Family (Eng)', type: 'text'},
      {key: 'family_chi', labelChi: '科 (中)', labelEng: 'Family (Chi)', type: 'text', readOnly: true},
      {key: 'genus_eng', labelChi: '屬 (英)', labelEng: 'Genus (Eng)', type: 'text'},
      {key: 'genus_chi', labelChi: '屬 (中)', labelEng: 'Genus (Chi)', type: 'text', readOnly: true},
      {key: 'species_eng', labelChi: '種 (英)', labelEng: 'Species (Eng)', type: 'text'},
      {key: 'sub_species_eng', labelChi: '亞種 (英)', labelEng: 'Sub-species (Eng)', type: 'text'},
    ]
  },
  {
    id: 'conservation',
    nameChi: '保護與生存狀態',
    nameEng: 'Conservation',
    icon: <ShieldAlert className="w-4 h-4" />,
    fields: [
      {key: 'iucn', labelChi: 'IUCN 評級', labelEng: 'IUCN Status', type: 'select', options: ['LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX','DD']},
      {key: 'cites', labelChi: 'CITES 評級', labelEng: 'CITES Status', type: 'text'},
      {key: 'afcd', labelChi: 'AFCD 評級', labelEng: 'AFCD Rating', type: 'text'},
      {key: 'hkbws_cat', labelChi: 'HKBWS 鳥種類別', labelEng: 'HKBWS Category', type: 'select', options: ['I', 'IIA', 'IIB', 'IIC', 'III']},
      {key: 'cap170', labelChi: '野生動物保護條例 (第170章)', labelEng: 'Wild Animal Protection Ordinance (Cap. 170)', type: 'select', options: ['Y', 'N']},
      {key: 'cap586', labelChi: '保護瀕危動植物物種條例 (第586章)', labelEng: 'Protection of Endangered Species Ordinance (Cap. 586)', type: 'select', options: ['Y', 'N']},
      {key: 'china_vertebrates_red_list', labelChi: '中國脊椎動物紅皮書', labelEng: 'China Vertebrates Red List', type: 'select', options: ['Least Concern', 'Near Threatened', 'Vulnerable', 'Endangered', 'Critically Endangered', 'Data Deficient']},
      {key: 'endemic', labelChi: '特有種', labelEng: 'Endemicity', type: 'text'},
      {key: 'native_status', labelChi: '原生概況', labelEng: 'Native Status', type: 'select', options: ['Native', 'Exotic', 'Vagrant', 'Reintroduced', 'Uncertain']},
      {key: 'restrictedness', labelChi: '受限度/稀有度', labelEng: 'Restrictedness', type: 'text'},
    ]
  },
  {
    id: 'descriptions',
    nameChi: '描述與分布',
    nameEng: 'Descriptions',
    icon: <MapPin className="w-4 h-4" />,
    fields: [
      {key: 'introduction_chi', labelChi: '物種簡介 (中)', labelEng: 'Introduction (Chi)', type: 'textarea'},
      {key: 'introduction_eng', labelChi: '物種簡介 (英)', labelEng: 'Introduction (Eng)', type: 'textarea'},
      {key: 'description_chi', labelChi: '形態特徵 (中)', labelEng: 'Description (Chi)', type: 'textarea'},
      {key: 'description_eng', labelChi: '形態特徵 (英)', labelEng: 'Description (Eng)', type: 'textarea'},
      {key: 'habitat_chi', labelChi: '棲息地 (中)', labelEng: 'Habitat (Chi)', type: 'textarea'},
      {key: 'habitat_eng', labelChi: '棲息地 (英)', labelEng: 'Habitat (Eng)', type: 'textarea'},
      {key: 'microhabitat_chi', labelChi: '微棲地 (中)', labelEng: 'Microhabitat (Chi)', type: 'textarea'},
      {key: 'microhabitat_eng', labelChi: '微棲地 (英)', labelEng: 'Microhabitat (Eng)', type: 'textarea'},
      {key: 'host_plants_chi', labelChi: '寄主植物 (中)', labelEng: 'Host Plants (Chi)', type: 'textarea'},
      {key: 'host_plants_eng', labelChi: '寄主植物 (英)', labelEng: 'Host Plants (Eng)', type: 'textarea'},
      {key: 'hk_distribution_chi', labelChi: '香港分布 (中)', labelEng: 'HK Distribution (Chi)', type: 'textarea'},
      {key: 'hk_distribution_eng', labelChi: '香港分布 (英)', labelEng: 'HK Distribution (Eng)', type: 'textarea'},
      {key: 'global_distribution_chi', labelChi: '全球分布 (中)', labelEng: 'Global Distribution (Chi)', type: 'textarea'},
      {key: 'global_distribution_eng', labelChi: '全球分布 (英)', labelEng: 'Global Distribution (Eng)', type: 'textarea'},
      {key: 'remarks_chi', labelChi: '備註 (中)', labelEng: 'Remarks (Chi)', type: 'textarea'},
      {key: 'remarks_eng', labelChi: '備註 (英)', labelEng: 'Remarks (Eng)', type: 'textarea'},
    ]
  }
];

// 2. 植物 (plant_species) 欄位組配置
const floraFieldGroups = (t: any): FieldGroup[] => [
  {
    id: 'basic',
    nameChi: '基本資訊',
    nameEng: 'Basic Info',
    icon: <FileText className="w-4 h-4" />,
    fields: [
      { key: 'taxa_id', labelChi: '物種 ID', labelEng: 'Taxa ID', type: 'text', readOnly: true },
      { key: 'oid', labelChi: 'OID', labelEng: 'OID', type: 'number', readOnly: true },
      { key: 'inat_id', labelChi: 'iNaturalist ID', labelEng: 'iNaturalist ID', type: 'number' },
      { key: 'col_usage_id', labelChi: 'Catalogue of Life ID', labelEng: 'Catalogue of Life ID', type: 'text' },
      { key: 'category_chi', labelChi: '植物類別 (中)', labelEng: 'Category (Chi)', type: 'text', readOnly: true },
      { key: 'category_eng', labelChi: '植物類別 (英)', labelEng: 'Category (Eng)', type: 'text' },
      { key: 'common_name_chi', labelChi: '中文俗名', labelEng: 'Common Name (Chi)', type: 'text' },
      { key: 'common_name_eng', labelChi: '英文俗名', labelEng: 'Common Name (Eng)', type: 'text' },
      { key: 'scientific_name', labelChi: '學名', labelEng: 'Scientific Name', type: 'text' },
      { key: 'author', labelChi: '命名者', labelEng: 'Author', type: 'text' },
      { key: 'origin', labelChi: '來源狀態', labelEng: 'Origin Status', type: 'text' },
      { key: 'alias_scientific_name', labelChi: '學名別名', labelEng: 'Alias Scientific Name', type: 'text' },
      { key: 'alias_common_name_chi', labelChi: '中文俗名別名', labelEng: 'Alias Common Name (Chi)', type: 'text' },
      { key: 'alias_common_name_eng', labelChi: '英文俗名別名', labelEng: 'Alias Common Name (Eng)', type: 'text' },
    ]
  },
  {
    id: 'taxonomy',
    nameChi: '分類學資訊',
    nameEng: 'Taxonomy',
    icon: <Layers className="w-4 h-4" />,
    fields: [
      { key: 'family_chi', labelChi: '科 (中)', labelEng: 'Family (Chi)', type: 'text', readOnly: true },
      { key: 'family_eng', labelChi: '科 (英)', labelEng: 'Family (Eng)', type: 'text' },
      { key: 'genus_chi', labelChi: '屬 (中)', labelEng: 'Genus (Chi)', type: 'text', readOnly: true },
      { key: 'genus_eng', labelChi: '屬 (英)', labelEng: 'Genus (Eng)', type: 'text' },
    ]
  },
  {
    id: 'conservation',
    nameChi: '保護與生存狀態',
    nameEng: 'Conservation',
    icon: <ShieldAlert className="w-4 h-4" />,
    fields: [
      { key: 'is_cap96', labelChi: '林務條例 (第96章)', labelEng: 'Cap. 96 Status', type: 'text' },
      { key: 'is_cap586', labelChi: '保護瀕危動植物物種條例 (第586章)', labelEng: 'Cap. 586 Status', type: 'text' },
      { key: 'hk_rare_precious_note', labelChi: '香港稀有及珍貴植物', labelEng: 'HK Rare & Precious', type: 'text' },
      { key: 'china_red_data_book_note', labelChi: '中國植物紅皮書', labelEng: 'China Plant Red Data Book', type: 'text' },
    ]
  },
  {
    id: 'descriptions',
    nameChi: '描述與分佈',
    nameEng: 'Descriptions',
    icon: <MapPin className="w-4 h-4" />,
    fields: [
      { key: 'description_chi', labelChi: '記述 (中)', labelEng: 'Description (Chi)', type: 'textarea' },
      { key: 'description_eng', labelChi: '記述 (英)', labelEng: 'Description (Eng)', type: 'textarea' },
      { key: 'locality_chi', labelChi: '產地 (中)', labelEng: 'Locality (Chi)', type: 'textarea' },
      { key: 'locality_eng', labelChi: '產地 (英)', labelEng: 'Locality (Eng)', type: 'textarea' },
      { key: 'distribution_chi', labelChi: '分佈 (中)', labelEng: 'Distribution (Chi)', type: 'textarea' },
      { key: 'distribution_eng', labelChi: '分佈 (英)', labelEng: 'Distribution (Eng)', type: 'textarea' },
      { key: 'habitat_chi', labelChi: '生境 (中)', labelEng: 'Habitat (Chi)', type: 'textarea' },
      { key: 'habitat_eng', labelChi: '生境 (英)', labelEng: 'Habitat (Eng)', type: 'textarea' },
      { key: 'usage_chi', labelChi: '用途 (中)', labelEng: 'Usage (Chi)', type: 'textarea' },
      { key: 'usage_eng', labelChi: '用途 (英)', labelEng: 'Usage (Eng)', type: 'textarea' },
      { key: 'remark_chi', labelChi: '備註 (中)', labelEng: 'Remarks (Chi)', type: 'textarea' },
      { key: 'remark_eng', labelChi: '備註 (英)', labelEng: 'Remarks (Eng)', type: 'textarea' },
      { key: 'flowering_period', labelChi: '花期 (文字描述)', labelEng: 'Flowering Period', type: 'text' },
      { key: 'fruiting_period', labelChi: '果期 (文字描述)', labelEng: 'Fruiting Period', type: 'text' },
    ]
  }
];

// 3. 真菌 (fungi_species) 欄位組配置 (排除 hkbws_cat, afcd, china_vertebrates_red_list, cites, ebird_species_code, cap170, cap586)
const fungiFieldGroups = (t: any): FieldGroup[] => [
  {
    id: 'basic',
    nameChi: '基本資訊',
    nameEng: 'Basic Info',
    icon: <FileText className="w-4 h-4" />,
    fields: [
      { key: 'taxa_id', labelChi: '物種 ID', labelEng: 'Taxa ID', type: 'text', readOnly: true },
      { key: 'inat_id', labelChi: 'iNaturalist ID', labelEng: 'iNaturalist ID', type: 'number' },
      { key: 'col_usage_id', labelChi: 'Catalogue of Life ID', labelEng: 'Catalogue of Life ID', type: 'text' },
      { key: 'taxa_group', labelChi: '物種分類群', labelEng: 'Taxa Group', type: 'text' },
      { key: 'informal_group_eng', labelChi: '非正式群組 (英)', labelEng: 'Informal Group (Eng)', type: 'text' },
      { key: 'common_name_chi', labelChi: '中文俗名', labelEng: 'Common Name (Chi)', type: 'text' },
      { key: 'common_name_eng', labelChi: '英文俗名', labelEng: 'Common Name (Eng)', type: 'text' },
      { key: 'scientific_name', labelChi: '學名', labelEng: 'Scientific Name', type: 'text' },
      { key: 'author', labelChi: '命名者', labelEng: 'Author', type: 'text' },
      { key: 'alias_scientific_name', labelChi: '學名別名', labelEng: 'Alias Scientific Name', type: 'text' },
      { key: 'alias_common_name_chi', labelChi: '中文俗名別名', labelEng: 'Alias Common Name (Chi)', type: 'text' },
      { key: 'alias_common_name_eng', labelChi: '英文俗名別名', labelEng: 'Alias Common Name (Eng)', type: 'text' },
    ]
  },
  {
    id: 'taxonomy',
    nameChi: '分類學資訊',
    nameEng: 'Taxonomy',
    icon: <Layers className="w-4 h-4" />,
    fields: [
      { key: 'phylum_eng', labelChi: '門 (英)', labelEng: 'Phylum (Eng)', type: 'text' },
      { key: 'phylum_chi', labelChi: '門 (中)', labelEng: 'Phylum (Chi)', type: 'text', readOnly: true },
      { key: 'class_eng', labelChi: '綱 (英)', labelEng: 'Class (Eng)', type: 'text' },
      { key: 'class_chi', labelChi: '綱 (中)', labelEng: 'Class (Chi)', type: 'text', readOnly: true },
      { key: 'order_eng', labelChi: '目 (英)', labelEng: 'Order (Eng)', type: 'text' },
      { key: 'order_chi', labelChi: '目 (中)', labelEng: 'Order (Chi)', type: 'text', readOnly: true },
      { key: 'family_eng', labelChi: '科 (英)', labelEng: 'Family (Eng)', type: 'text' },
      { key: 'family_chi', labelChi: '科 (中)', labelEng: 'Family (Chi)', type: 'text', readOnly: true },
      { key: 'genus_eng', labelChi: '屬 (英)', labelEng: 'Genus (Eng)', type: 'text' },
      { key: 'genus_chi', labelChi: '屬 (中)', labelEng: 'Genus (Chi)', type: 'text', readOnly: true },
      { key: 'species_eng', labelChi: '種 (英)', labelEng: 'Species (Eng)', type: 'text' },
      { key: 'sub_species_eng', labelChi: '亞種 (英)', labelEng: 'Sub-species (Eng)', type: 'text' },
    ]
  },
  {
    id: 'conservation',
    nameChi: '保護與生存狀態',
    nameEng: 'Conservation',
    icon: <ShieldAlert className="w-4 h-4" />,
    fields: [
      { key: 'iucn', labelChi: 'IUCN 評級', labelEng: 'IUCN Status', type: 'select', options: ['LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX', 'DD', 'NE'] },
      { key: 'endemic', labelChi: '特有種', labelEng: 'Endemicity', type: 'text' },
      { key: 'native_status', labelChi: '原生概況', labelEng: 'Native Status', type: 'select', options: ['Native', 'Exotic', 'Reintroduced', 'Uncertain'] },
      { key: 'restrictedness', labelChi: '受限度/稀有度', labelEng: 'Restrictedness', type: 'text' },
    ]
  },
  {
    id: 'descriptions',
    nameChi: '描述與分布',
    nameEng: 'Descriptions',
    icon: <MapPin className="w-4 h-4" />,
    fields: [
      { key: 'introduction_chi', labelChi: '物種簡介 (中)', labelEng: 'Introduction (Chi)', type: 'textarea' },
      { key: 'introduction_eng', labelChi: '物種簡介 (英)', labelEng: 'Introduction (Eng)', type: 'textarea' },
      { key: 'description_chi', labelChi: '形態特徵 (中)', labelEng: 'Description (Chi)', type: 'textarea' },
      { key: 'description_eng', labelChi: '形態特徵 (英)', labelEng: 'Description (Eng)', type: 'textarea' },
      { key: 'habitat_chi', labelChi: '生境 (中)', labelEng: 'Habitat (Chi)', type: 'textarea' },
      { key: 'habitat_eng', labelChi: '生境 (英)', labelEng: 'Habitat (Eng)', type: 'textarea' },
      { key: 'microhabitat_chi', labelChi: '微生境 (中)', labelEng: 'Microhabitat (Chi)', type: 'textarea' },
      { key: 'microhabitat_eng', labelChi: '微生境 (英)', labelEng: 'Microhabitat (Eng)', type: 'textarea' },
      { key: 'hk_distribution_chi', labelChi: '香港分布 (中)', labelEng: 'HK Distribution (Chi)', type: 'textarea' },
      { key: 'hk_distribution_eng', labelChi: '香港分布 (英)', labelEng: 'HK Distribution (Eng)', type: 'textarea' },
      { key: 'global_distribution_chi', labelChi: '全球分布 (中)', labelEng: 'Global Distribution (Chi)', type: 'textarea' },
      { key: 'global_distribution_eng', labelChi: '全球分布 (英)', labelEng: 'Global Distribution (Eng)', type: 'textarea' },
      { key: 'remarks_chi', labelChi: '備註 (中)', labelEng: 'Remarks (Chi)', type: 'textarea' },
      { key: 'remarks_eng', labelChi: '備註 (英)', labelEng: 'Remarks (Eng)', type: 'textarea' },
    ]
  }
];

export default function SpeciesDetailEditor({ table, data, originalData, publishedOriginal: propPublishedOriginal, onSave, onCancel, onDirtyChange, saveButtonLabel, hideHeader, onRegisterSave, disableDirectDatabaseUpdate }: SpeciesDetailEditorProps) {
  const { language, t } = useLanguage();
  const { profile } = useAuth();
  const { getTaxonomyChi } = useTaxonomy();
  const supabase = useMemo(() => createClient(), []);
  
  const [formValues, setFormValues] = useState<any>({});
  const [originalValues, setOriginalValues] = useState<any>({});
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [saving, setSaving] = useState(false);

  // 1. 初始化資料 (formValues 裝草稿/編輯中資料，publishedOriginal 裝純淨正本發布資料)
  useEffect(() => {
    if (data) {
      setFormValues({ ...data });
    }
  }, [data]);

  // 使用 useMemo 確保正本發布資料 (propPublishedOriginal / originalData) 不會因為 state 異步落後或被改動
  const publishedOriginal = useMemo(() => {
    const base = propPublishedOriginal || originalData;
    return base ? { ...base } : null;
  }, [propPublishedOriginal, originalData]);

  useEffect(() => {
    if (originalData) {
      setOriginalValues({ ...originalData });
    } else if (data) {
      setOriginalValues({ ...data });
    }
  }, [originalData, data]);

  // 2. 獲取當前資料表預定義的分組
  const baseGroups = useMemo(() => {
    return table === 'plant_species' 
      ? floraFieldGroups(t) 
      : table === 'fungi_species'
        ? fungiFieldGroups(t)
        : faunaFieldGroups(t);
  }, [table, t]);

  // 3. 收集所有未在預定義分組中列出的欄位 (Others Tab) -> 保證擴展性
  const finalGroups = useMemo(() => {
    if (!data) return baseGroups;

    const definedKeys = new Set(baseGroups.flatMap(g => g.fields.map(f => f.key)));
    
    // 排除系統內建主鍵與索引、時間欄位
    const ignoredKeys = ['id', 'taxa_id', 'fts', 'created_at', 'updated_at', 'flowering_months', 'fruiting_months'];
    if (table === 'plant_species') {
      ignoredKeys.push('ebird_species_code', 'species_eng');
    }
    if (table === 'fungi_species') {
      ignoredKeys.push('hkbws_cat', 'afcd', 'china_vertebrates_red_list', 'cites', 'ebird_species_code', 'cap170', 'cap586');
    }

    const otherLabelMap: Record<string, { labelChi: string; labelEng: string }> = {
      profile_picture: { labelChi: '頭像圖片路徑', labelEng: 'Profile Picture' },
      similar_species: { labelChi: '相似物種 (taxa_id清單)', labelEng: 'Similar Species (taxa_ids)' }
    };

    const otherFields = Object.keys(data)
      .filter(key => !definedKeys.has(key) && !ignoredKeys.includes(key))
      .map(key => {
        const val = data[key];
        const isNum = typeof val === 'number';
        const customLabel = otherLabelMap[key];
        return {
          key,
          labelChi: customLabel ? customLabel.labelChi : key,
          labelEng: customLabel ? customLabel.labelEng : key,
          type: isNum ? 'number' : 'text'
        } as FieldConfig;
      });

    let groups = [...baseGroups];
    if (otherFields.length > 0) {
      groups.push({
        id: 'others',
        nameChi: '其他屬性',
        nameEng: 'Others',
        icon: <Plus className="w-4 h-4" />,
        fields: otherFields
      });
    }

    // 無論如何，都在最後加上獨立的「參考文獻」分頁
    groups.push({
      id: 'references',
      nameChi: '參考文獻',
      nameEng: 'References',
      icon: <BookOpen className="w-4 h-4" />,
      fields: [
        { key: 'reference_codes', labelChi: '物種參考文獻 (APA 7th)', labelEng: 'Species References (APA 7th)', type: 'text' }
      ]
    });

    return groups;
  }, [baseGroups, data]);

  // 4. 偵測是否有欄位被修改
  const isDirty = useMemo(() => {
    return JSON.stringify(formValues) !== JSON.stringify(originalValues);
  }, [formValues, originalValues]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // 5. 處理欄位異動
  const handleFieldChange = (key: string, val: any, type: 'text' | 'number' | 'textarea' | 'select') => {
    let finalVal = val;
    if (type === 'number') {
      finalVal = val === '' ? null : Number(val);
    }
    setFormValues((prev: any) => ({ ...prev, [key]: finalVal }));
  };

  // 6. 恢復原狀
  const handleReset = () => {
    setFormValues({ ...originalValues });
  };

  // 7. 儲存變更
  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);

    try {
      // 過濾出僅有修改的欄位以提升性能
      const updatedFields: any = {};
      Object.keys(formValues).forEach(key => {
        if (formValues[key] !== originalValues[key]) {
          updatedFields[key] = formValues[key];
        }
      });

      const affectedUpdates: Record<string, string> = {};

      // 如果有傳入 originalData (即在 SpeciesEditModal 草稿審核模式)，
      // 絕對不可直接更新 Supabase 的正本 species / plant_species 表！
      const isDirectDbDisabled = disableDirectDatabaseUpdate || !!originalData;

      if (!isDirectDbDisabled) {
        const { error } = await supabase
          .from(table)
          .update(updatedFields)
          .eq('taxa_id', data.taxa_id);

        if (error) throw error;

        // 雙向同步相似物種邏輯 (Bidirectional similar species sync)
        if (Object.keys(updatedFields).includes('similar_species')) {
          const origList = (originalValues.similar_species || '').split(',').map((id: string) => id.trim()).filter(Boolean);
          const newList = (formValues.similar_species || '').split(',').map((id: string) => id.trim()).filter(Boolean);

          const added = newList.filter((id: string) => !origList.includes(id));
          const removed = origList.filter((id: string) => !newList.includes(id));
          const currentTaxaId = data.taxa_id;

          // 處理新增：把目前物種 A 加到被新增物種 B 的 similar_species 中
          for (const targetId of added) {
            const targetTable = targetId.startsWith('flora_') ? 'plant_species' : 'species';
            const { data: targetData } = await supabase
              .from(targetTable)
              .select('similar_species')
              .eq('taxa_id', targetId)
              .maybeSingle();

            const currentSim = (targetData?.similar_species || '').split(',').map((id: string) => id.trim()).filter(Boolean);
            if (!currentSim.includes(currentTaxaId)) {
              currentSim.push(currentTaxaId);
              const nextSimVal = currentSim.join(', ');
              await supabase
                .from(targetTable)
                .update({ similar_species: nextSimVal })
                .eq('taxa_id', targetId);

              affectedUpdates[targetId] = nextSimVal;
            }
          }

          // 處理移除：把目前物種 A 從被移除物種 C 的 similar_species 中刪除
          for (const targetId of removed) {
            const targetTable = targetId.startsWith('flora_') ? 'plant_species' : 'species';
            const { data: targetData } = await supabase
              .from(targetTable)
              .select('similar_species')
              .eq('taxa_id', targetId)
              .maybeSingle();

            if (targetData) {
              const currentSim = (targetData.similar_species || '').split(',').map((id: string) => id.trim()).filter(Boolean);
              if (currentSim.includes(currentTaxaId)) {
                const updatedSim = currentSim.filter((id: string) => id !== currentTaxaId);
                const nextSimVal = updatedSim.join(', ');
                await supabase
                  .from(targetTable)
                  .update({ similar_species: nextSimVal })
                  .eq('taxa_id', targetId);

                affectedUpdates[targetId] = nextSimVal;
              }
            }
          }
        }
      }

      const finalItem = { ...data, ...formValues };
      // 僅在非 Review 模式（沒有 originalData prop）時才重設 originalValues
      // 以免覆蓋掉 Curator/Admin 用於 Highlight 對比的正本基準
      if (!originalData) {
        setOriginalValues({ ...formValues });
      }
      onSave(finalItem, affectedUpdates);
    } catch (err) {
      console.error('Error saving species detail:', err);
      alert(language === 'zh' ? '儲存失敗，請重試。' : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  // 註冊保存觸發函式給外層元件
  useEffect(() => {
    if (onRegisterSave) {
      onRegisterSave(handleSave);
    }
  }, [onRegisterSave, handleSave]);

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-sm font-bold">
        {language === 'zh' ? '請從左側選擇一個物種進行編輯' : 'Select a species from the list to edit'}
      </div>
    );
  }

  const currentGroup = finalGroups.find(g => g.id === activeTab) || finalGroups[0];
  const commonName = language === 'zh' ? data.common_name_chi : data.common_name_eng;

  // 通用欄位異動檢查：
  // 優先與正本發布數據 (publishedOriginal) 比對，確保草稿修改欄位 100% 亮起 Highlight。
  const checkIsDirty = (key: string) => {
    const v1 = formValues[key];
    const comparisonBase = publishedOriginal || originalValues;
    if (!comparisonBase) return false;
    const v2 = comparisonBase[key];
    if (v1 === undefined && v2 === undefined) return false;
    const s1 = v1 === null || v1 === undefined ? '' : String(v1).trim();
    const s2 = v2 === null || v2 === undefined ? '' : String(v2).trim();
    return s1 !== s2;
  };

  return (
    <div className="h-full flex flex-col min-h-0 bg-white rounded-3xl overflow-hidden relative border border-slate-100">
      
      {/* 1. Header Area (Optionally hidden when embedded in modals) */}
      {!hideHeader && (
        <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between flex-shrink-0 bg-slate-50/50">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md">
                {data.taxa_id}
              </span>
              <h3 className="text-md font-black text-slate-800 truncate">
                {commonName || data.scientific_name}
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-serif italic truncate mt-1">
              {data.scientific_name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Reset Button */}
            {isDirty && (
              <button
                onClick={handleReset}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-100 hover:border-slate-300 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Reset changes"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{language === 'zh' ? '重設' : 'Reset'}</span>
              </button>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                isDirty 
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-100 hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-200 hover:scale-[1.02] active:scale-95' 
                  : 'bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{saveButtonLabel || (language === 'zh' ? '儲存變更' : 'Save Changes')}</span>
            </button>

            {/* Close Button */}
            <button 
              onClick={onCancel}
              className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all hover:scale-105 active:scale-95 border border-transparent hover:border-slate-100 cursor-pointer"
              title="Close Editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Body Area (Split into Left Tabs and Right Fields Scroll) */}
      <div className="flex-1 flex min-h-0">
        
        {/* Left Tabs Column */}
        <div className="w-1/4 min-w-[150px] border-r border-slate-50 py-4 flex flex-col gap-1.5 bg-slate-50/20">
          {finalGroups.map(group => {
            const hasGroupDirty = group.fields.some(f => checkIsDirty(f.key));
            return (
              <button
                key={group.id}
                onClick={() => setActiveTab(group.id)}
                className={`w-[calc(100%-16px)] mx-2 px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-between gap-2 transition-all text-left outline-none relative cursor-pointer ${
                  activeTab === group.id
                    ? 'bg-white text-emerald-700 shadow-sm border border-slate-100'
                    : 'text-slate-500 hover:bg-slate-100/60 hover:text-slate-700 border border-transparent active:scale-[0.98]'
                }`}
              >
                {activeTab === group.id && (
                  <motion.div 
                    layoutId="active-editor-tab-indicator"
                    className="absolute left-[-2px] top-2.5 bottom-2.5 w-0.5 bg-emerald-500 rounded-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={activeTab === group.id ? 'text-emerald-600' : 'text-slate-400 transition-colors group-hover:text-slate-600'}>
                    {group.icon}
                  </span>
                  <span className="truncate">
                    {language === 'zh' ? group.nameChi : group.nameEng}
                  </span>
                </div>

                {hasGroupDirty && (
                  <span 
                    className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-400 animate-pulse shrink-0" 
                    title={language === 'zh' ? '包含修訂欄位' : 'Contains modified fields'}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Right Fields Scroll Column */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            
            {currentGroup.fields.map(field => {
              let val = formValues[field.key] ?? '';
              
              // 動態計算分類學中文翻譯 (僅限門、綱、目、科、屬、非正式群組)
              const taxonomyChiKeys = ['phylum_chi', 'class_chi', 'order_chi', 'family_chi', 'genus_chi', 'informal_group_chi'];
              if (taxonomyChiKeys.includes(field.key)) {
                const rank = field.key.replace('_chi', '');
                const engKey = rank === 'informal_group' ? 'informal_group_eng' : `${rank}_eng`;
                const engVal = formValues[engKey];
                if (engVal) {
                  val = getTaxonomyChi(rank, table === 'plant_species' ? 'flora' : 'fauna', engVal) || '';
                }
              }

              const currentTaxaGroup = String(data?.taxa_group || '').trim().toUpperCase();
              const isBirdOnlyFieldDisabled = (field.key === 'ebird_species_code' || field.key === 'hkbws_cat') && currentTaxaGroup !== 'BIRD';
              const isReadOnly = field.readOnly || isBirdOnlyFieldDisabled;
              const isTextarea = field.type === 'textarea';
              const isSelect = field.type === 'select';
              const label = language === 'zh' ? field.labelChi : field.labelEng;
              const isFieldDirty = checkIsDirty(field.key);
              const isBilingualField = field.key.endsWith('_chi') || field.key.endsWith('_eng');
              const useFullWidth = (isTextarea && !isBilingualField) || field.key === 'similar_species' || field.key === 'reference_codes';

              return (
                <div 
                  key={field.key} 
                  className={`flex flex-col gap-1.5 p-2.5 rounded-2xl transition-all ${
                    isFieldDirty 
                      ? 'bg-emerald-50/30 border border-emerald-300/70 shadow-sm ring-1 ring-emerald-500/20' 
                      : 'border border-transparent'
                  } ${useFullWidth ? 'md:col-span-2' : ''}`}
                >
                  <label className="text-[10px] font-black uppercase tracking-wider flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      {isReadOnly && <Lock className="w-3 h-3 text-slate-300" />}
                      <span className={isFieldDirty ? 'text-emerald-700 font-black' : 'text-slate-400'}>{label}</span>
                      {profile?.role === 'admin' && (
                        <span className="text-[8px] font-mono opacity-50 lowercase">({field.key})</span>
                      )}
                    </div>

                    {isFieldDirty && (
                      <span 
                        className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[8px] font-black rounded-md uppercase tracking-wider ring-1 ring-emerald-200" 
                        title={language === 'zh' ? '已修改' : 'Modified'} 
                      >
                        {language === 'zh' ? '已修訂' : 'MODIFIED'}
                      </span>
                    )}
                  </label>

                  {isReadOnly ? (
                    <div 
                      className={`border rounded-xl px-4 py-2.5 text-xs font-semibold select-none flex items-center justify-between cursor-not-allowed group/readonly ${
                        isFieldDirty ? 'bg-emerald-100/50 border-emerald-300 text-emerald-900 font-bold' : 'bg-slate-50/80 border-slate-100 text-slate-400'
                      }`}
                      title={isBirdOnlyFieldDisabled ? 'Bird only' : (language === 'zh' ? '此為系統唯讀欄位' : 'This field is read-only')}
                    >
                      <span className="font-mono opacity-80">
                        {val !== null && val !== undefined ? String(val) : ''}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isBirdOnlyFieldDisabled && (
                          <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-sans font-bold">
                            Bird only
                          </span>
                        )}
                        <Lock className="w-3.5 h-3.5 text-slate-300 group-hover/readonly:text-slate-400 transition-colors" />
                      </div>
                    </div>
                  ) : isSelect ? (
                    <CustomSelect
                      value={String(val ?? '')}
                      onChange={(newVal) => handleFieldChange(field.key, newVal, field.type)}
                      options={field.options || []}
                      isFieldDirty={isFieldDirty}
                      language={language}
                    />
                  ) : isTextarea ? (
                    <div className="relative">
                      <textarea
                        value={String(val)}
                        onChange={(e) => handleFieldChange(field.key, e.target.value, field.type)}
                        rows={5}
                        className={`w-full focus:bg-white border rounded-xl px-4 py-3 text-xs font-semibold resize-y transition-[border-color,box-shadow] focus:outline-none focus:ring-1 custom-scrollbar leading-relaxed ${
                          isFieldDirty 
                            ? 'border-emerald-400 font-bold bg-white text-emerald-950 focus:border-emerald-500 focus:ring-emerald-500/20 shadow-xs' 
                            : 'bg-slate-50/50 hover:bg-slate-50 border-slate-100 hover:border-slate-200 focus:border-emerald-400 focus:ring-emerald-400'
                        }`}
                        placeholder={language === 'zh' ? `請輸入 ${label}...` : `Enter ${label}...`}
                      />
                      <div className="absolute right-2.5 bottom-2.5 pointer-events-none text-slate-400 opacity-60">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M8 2L2 8M8 5L5 8M8 8H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </div>
                    </div>
                  ) : field.key === 'similar_species' ? (
                    <SimilarSpeciesPicker
                      value={String(val)}
                      onChange={(newVal) => handleFieldChange(field.key, newVal, field.type)}
                      table={table}
                      supabase={supabase}
                      language={language}
                    />
                  ) : field.key === 'reference_codes' ? (
                    <ReferencePicker
                      value={String(val)}
                      onChange={(newVal) => handleFieldChange(field.key, newVal, field.type)}
                      supabase={supabase}
                      language={language}
                    />
                  ) : (
                    <div className="flex gap-2 w-full items-center">
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={String(val)}
                        onChange={(e) => handleFieldChange(field.key, e.target.value, field.type)}
                        className={`flex-1 min-w-0 focus:bg-white border rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors duration-200 focus:outline-none focus:ring-1 ${
                          isFieldDirty 
                            ? 'border-emerald-400 font-bold bg-white text-emerald-950 focus:border-emerald-500 focus:ring-emerald-500/20 shadow-xs' 
                            : 'bg-slate-50/50 hover:bg-slate-50 border-slate-100 hover:border-slate-200 focus:border-emerald-400 focus:ring-emerald-400'
                        }`}
                        placeholder={language === 'zh' ? `請輸入 ${label}...` : `Enter ${label}...`}
                      />
                      {(field.key === 'col_usage_id' || field.key === 'inat_id' || field.key === 'ebird_species_code') && (
                        <a
                          href={
                            val 
                              ? (field.key === 'col_usage_id'
                                  ? `https://www.catalogueoflife.org/data/taxon/${val}`
                                  : field.key === 'ebird_species_code'
                                  ? `https://ebird.org/species/${val}`
                                  : `https://www.inaturalist.org/taxa/${val}`)
                              : undefined
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center justify-center p-2.5 rounded-xl border transition-all shrink-0 select-none ${
                            val 
                              ? 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 hover:scale-[1.02] active:scale-95 cursor-pointer' 
                              : 'bg-slate-50/50 border-slate-100 text-slate-300 cursor-not-allowed'
                          }`}
                          onClick={(e) => {
                            if (!val) e.preventDefault();
                          }}
                          title={val ? (language === 'zh' ? '開啟外部連結' : 'Open external link') : (language === 'zh' ? '請先輸入 Code / ID' : 'Please enter Code / ID first')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  )}
                  {/* 8. 當欄位被修改 (isFieldDirty) 時，下方顯示標準 Publish Data 參考卡片 */}
                  {isFieldDirty && (() => {
                    const pubVal = publishedOriginal ? publishedOriginal[field.key] : originalValues[field.key];
                    const pubDisplayVal = pubVal === null || pubVal === undefined || String(pubVal).trim() === ''
                      ? (language === 'zh' ? '（原本為空 / 未設定）' : '(Empty / Not set originally)')
                      : String(pubVal);

                    return (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-1.5 p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs space-y-1 shadow-2xs"
                      >
                        <div className="flex items-center gap-1.5 font-bold text-amber-900">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          <span>{language === 'zh' ? 'Publish Data (發布正本參考)：' : 'Publish Data (Current Version):'}</span>
                        </div>
                        <div className="text-amber-950 font-medium whitespace-pre-wrap break-words leading-relaxed pl-2.5 font-sans selection:bg-amber-200">
                          {pubDisplayVal}
                        </div>
                      </motion.div>
                    );
                  })()}
                </div>
              );
            })}

          </div>
        </div>

      </div>
    </div>
  );
}

// Scoped style overrides for clean single gray resizer handle
if (typeof document !== 'undefined') {
  const styleId = 'species-detail-editor-custom-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.innerHTML = `
      textarea::-webkit-resizer {
        display: none !important;
        background: transparent !important;
      }
    `;
    document.head.appendChild(styleEl);
  }
}
