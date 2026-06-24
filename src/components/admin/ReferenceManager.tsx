'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2, 
  BookOpen, 
  Copy, 
  Check, 
  Sparkles, 
  X, 
  Info,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Reference {
  id: string;
  code: string;
  zh: string;
  en: string;
  url?: string;
  created_at: string;
}

// APA 7 生成器型態
type SourceType = 'journal' | 'book' | 'web';

export default function ReferenceManager() {
  const { language, t } = useLanguage();
  const supabase = createClient();
  
  const [references, setReferences] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  // 分頁與排序
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // 新增 / 編輯 Modal 狀態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRef, setEditingRef] = useState<Reference | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formZh, setFormZh] = useState('');
  const [formEn, setFormEn] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // 刪除確認狀態
  const [deleteTarget, setDeleteTarget] = useState<Reference | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    fetchReferences();
  }, []);

  const fetchReferences = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('references')
        .select('*')
        .order('code', { ascending: true });
        
      if (error) throw error;
      setReferences(data || []);
    } catch (err) {
      console.error('Error fetching references:', err);
    } finally {
      setLoading(false);
    }
  };

  // 搜尋與過濾文獻
  const filteredReferences = useMemo(() => {
    if (!searchQuery.trim()) return references;
    const q = searchQuery.toLowerCase();
    return references.filter(ref => 
      ref.code.toLowerCase().includes(q) ||
      ref.zh.toLowerCase().includes(q) ||
      ref.en.toLowerCase().includes(q)
    );
  }, [references, searchQuery]);

  // 分頁後顯示的資料
  const paginatedReferences = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredReferences.slice(start, start + itemsPerPage);
  }, [filteredReferences, currentPage]);

  const totalPages = Math.ceil(filteredReferences.length / itemsPerPage);

  // 當搜尋條件改變時重設頁數
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleOpenAddModal = () => {
    setEditingRef(null);
    
    // 自動計算最小未使用的 ref_N 代碼 (包括重用空置代碼)
    const numbers = references
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
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ref: Reference) => {
    setEditingRef(ref);
    setFormCode(ref.code);
    setFormZh(ref.zh);
    setFormEn(ref.en);
    setFormUrl(ref.url || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formZh.trim() || !formEn.trim()) {
      setFormError(language === 'zh' ? '請填寫所有必要欄位' : 'Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      if (editingRef) {
        // 更新
        const { error } = await supabase
          .from('references')
          .update({
            code: formCode.trim(),
            zh: formZh.trim(),
            en: formEn.trim(),
            url: formUrl.trim() || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingRef.id);

        if (error) throw error;
        
        setReferences(references.map(r => r.id === editingRef.id ? { 
          ...r, 
          code: formCode.trim(), 
          zh: formZh.trim(), 
          en: formEn.trim(),
          url: formUrl.trim() || undefined
        } : r));
      } else {
        // 新增
        const { data, error } = await supabase
          .from('references')
          .insert({
            code: formCode.trim(),
            zh: formZh.trim(),
            en: formEn.trim(),
            url: formUrl.trim() || null
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
          setReferences([...references, data].sort((a, b) => a.code.localeCompare(b.code)));
        }
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving reference:', err);
      setFormError(err.message || (language === 'zh' ? '儲存失敗，請重試' : 'Failed to save reference. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('references')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;
      setReferences(references.filter(r => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error('Error deleting reference:', err);
      alert(language === 'zh' ? '刪除失敗' : 'Failed to delete reference');
    } finally {
      setDeleting(false);
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
    // 移除 markdown 斜體記號以保持資料庫乾淨，或者保留（在 markdown 中斜體很常見，這裡保留 markdown 格式）
    if (lang === 'zh') {
      setFormZh(helperPreview);
    } else {
      setFormEn(helperPreview);
    }
    // 重設 helper
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
    <div className="h-full flex flex-col min-h-0 bg-white/20 backdrop-blur-xl rounded-[2.5rem] p-4 relative border border-white/40">
      
      {/* 頂部操作欄 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 shrink-0">
        <div className="relative group w-full max-w-md">
          <div className="absolute inset-0 bg-emerald-500/5 blur-xl rounded-2xl transition-all group-focus-within:bg-emerald-500/10" />
          <div className="relative flex items-center bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl px-4 py-2.5 transition-all focus-within:border-emerald-400">
            <Search className="w-4 h-4 text-slate-400 mr-2.5" />
            <input 
              type="text" 
              placeholder={language === 'zh' ? '搜尋文獻編碼、內容...' : 'Search reference code, content...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-slate-700 text-xs font-semibold placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-2 bg-white/50 border border-white rounded-xl text-[10px] font-black text-slate-500 shadow-sm">
            Total: <span className="text-emerald-600 ml-0.5">{filteredReferences.length}</span>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{language === 'zh' ? '新增文獻' : 'Add Reference'}</span>
          </button>
        </div>
      </div>

      {/* 資料展示區 */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
          <p className="text-slate-400 text-xs font-bold animate-pulse">Loading Reference Database...</p>
        </div>
      ) : filteredReferences.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 border border-dashed border-slate-200 rounded-[2rem] bg-white/20">
          <BookOpen className="w-12 h-12 text-slate-300 mb-2" />
          <p className="text-slate-400 text-xs font-bold">
            {language === 'zh' ? '沒有找到任何參考文獻資料' : 'No references found'}
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Table Container */}
          <div className="flex-1 overflow-y-auto custom-scrollbar rounded-2xl border border-white bg-white/30 backdrop-blur-xl shadow-sm mb-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100/80 sticky top-0 z-10">
                  <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest w-1/6">
                    {language === 'zh' ? '文獻編碼 (Code)' : 'Code'}
                  </th>
                  <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest w-5/12">
                    {language === 'zh' ? '中文 APA 7 格式' : 'Chinese APA 7th'}
                  </th>
                  <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest w-5/12">
                    {language === 'zh' ? '英文 APA 7 格式' : 'English APA 7th'}
                  </th>
                  <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right w-[100px]">
                    {language === 'zh' ? '操作' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50">
                {paginatedReferences.map((ref) => (
                  <tr 
                    key={ref.id}
                    className="hover:bg-emerald-50/30 transition-colors duration-200 group"
                  >
                    <td className="px-5 py-3 text-xs font-bold text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-0.5 select-all">
                          {ref.code}
                        </span>
                        <button
                          onClick={() => handleCopyCode(ref.code)}
                          className="p-1 text-slate-400 hover:text-emerald-600 rounded-md transition-colors"
                          title="Copy Code"
                        >
                          {copiedCode === ref.code ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600 leading-relaxed font-semibold">
                      {ref.zh}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600 leading-relaxed font-semibold">
                      {ref.en}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => handleOpenEditModal(ref)}
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all active:scale-95 cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => setDeleteTarget(ref)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-95 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 分頁控制頁碼 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between shrink-0 bg-white/40 border border-white/60 rounded-2xl px-4 py-2.5 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-7 h-7 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      currentPage === i + 1 
                        ? 'bg-emerald-600 text-white shadow-sm' 
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 1. 新增 / 編輯 Modal */}
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
              className="relative w-full max-w-4xl bg-white/95 backdrop-blur-2xl border border-slate-100 rounded-[2.5rem] shadow-2xl p-6 md:p-8 flex flex-col md:flex-row gap-6 max-h-[90vh] overflow-hidden"
            >
              {/* 左側：表單編輯區域 */}
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar pr-1">
                <div className="flex items-center gap-2 mb-4 shrink-0">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <h3 className="text-md font-black text-slate-800">
                    {editingRef ? (language === 'zh' ? '編輯參考文獻' : 'Edit Reference') : (language === 'zh' ? '新增參考文獻' : 'Add Reference')}
                  </h3>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4">
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
                        language === 'zh' ? '儲存' : 'Save'
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
                          onClick={() => setShowHelper(false)}
                          className="p-1 hover:bg-slate-50 rounded-lg text-slate-400"
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

      {/* 2. 刪除確認 Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteTarget(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white border border-slate-100 rounded-3xl shadow-2xl p-6"
            >
              <h3 className="text-md font-black text-slate-800 mb-2">
                {language === 'zh' ? '確定刪除參考文獻？' : 'Delete Reference?'}
              </h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed mb-6">
                {language === 'zh' ? (
                  <>確定要刪除文獻編碼為 <span className="font-mono text-rose-600 font-bold bg-rose-50 px-1 py-0.5 rounded">{deleteTarget.code}</span> 的文獻嗎？此操作將會移除所有與該文獻關聯的物種連結！</>
                ) : (
                  <>Are you sure you want to delete reference <span className="font-mono text-rose-600 font-bold bg-rose-50 px-1 py-0.5 rounded">{deleteTarget.code}</span>? This will break association links on all species pages.</>
                )}
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                >
                  {language === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-rose-100"
                >
                  {deleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    language === 'zh' ? '刪除' : 'Delete'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.3);
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.5);
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
}
