'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { SpeciesDraft } from '@/types/speciesDraft';
import { Species } from '@/types/species';
import { fetchSpeciesOrPlantRow } from '@/utils/speciesQuery';
import SpeciesEditModal from '@/components/species/SpeciesEditModal';
import { 
  FileEdit, 
  Search, 
  Filter, 
  Clock, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  UserCircle, 
  ChevronRight, 
  Loader2, 
  RefreshCw,
  Sparkles,
  Layers,
  Leaf,
  Bug
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DraftManager() {
  const { language } = useLanguage();
  const { profile } = useAuth();
  const supabase = createClient();

  const [drafts, setDrafts] = useState<SpeciesDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 篩選狀態: 'all' | 'fauna' | 'flora'
  const [taxaTab, setTaxaTab] = useState<'all' | 'fauna' | 'flora'>('all');
  
  // 草稿狀態篩選: 'processing' (pending + rejected) | 'pending' | 'rejected' | 'approved' | 'all'
  const [statusFilter, setStatusFilter] = useState<'processing' | 'pending' | 'rejected' | 'approved' | 'all'>('processing');

  // SpeciesEditModal 相關狀態
  const [selectedDraft, setSelectedDraft] = useState<SpeciesDraft | null>(null);
  const [targetSpecies, setTargetSpecies] = useState<Species | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingSpecies, setLoadingSpecies] = useState(false);

  // 抓取所有草稿記錄
  const fetchDrafts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('species_drafts')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setDrafts(data as SpeciesDraft[]);
      }
    } catch (err) {
      console.error('Error fetching drafts in DraftManager:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, []);

  // 點擊草稿行或操作按鈕，開啟 SpeciesEditModal 進行審核
  const handleOpenDraftModal = async (draft: SpeciesDraft) => {
    setSelectedDraft(draft);
    setLoadingSpecies(true);
    
    try {
      const speciesData = await fetchSpeciesOrPlantRow(draft.species_id, draft.table_name);

      if (speciesData) {
        setTargetSpecies(speciesData as Species);
        setIsModalOpen(true);
      } else {
        // 若完全查無此紀錄，建立包含全量草稿鍵值的 fallback
        const fallbackSpecies: any = {
          id: draft.species_id,
          taxa_id: draft.species_id,
          ...draft.draft_data
        };
        setTargetSpecies(fallbackSpecies);
        setIsModalOpen(true);
      }
    } catch (err) {
      console.error('Error fetching target species for draft:', err);
      alert(language === 'zh' ? '拉取物種數據失敗' : 'Failed to load species details.');
    } finally {
      setLoadingSpecies(false);
    }
  };

  // 格式化時間輔助函數
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  };

  // 篩選出的草稿清單
  const filteredDrafts = drafts.filter(draft => {
    // 1. 分類群 Tab 篩選 (Fauna vs Flora)
    const isPlant = draft.table_name === 'plant_species' || String(draft.species_id || '').startsWith('flora_') || (draft.draft_data as any)?.category_chi;
    if (taxaTab === 'fauna' && isPlant) return false;
    if (taxaTab === 'flora' && !isPlant) return false;

    // 2. 狀態篩選
    if (statusFilter === 'processing' && !(draft.status === 'pending' || draft.status === 'rejected')) {
      return false;
    }
    if (statusFilter === 'pending' && draft.status !== 'pending') return false;
    if (statusFilter === 'rejected' && draft.status !== 'rejected') return false;
    if (statusFilter === 'approved' && draft.status !== 'approved') return false;

    // 3. 關鍵字搜尋 (物種中文名、英文名、學名、Curator 姓名)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const chi = (draft.draft_data?.common_name_chi || '').toLowerCase();
      const eng = (draft.draft_data?.common_name_eng || '').toLowerCase();
      const sci = (draft.draft_data?.scientific_name || draft.species_id || '').toLowerCase();
      const curator = (draft.curator_name || '').toLowerCase();
      return chi.includes(q) || eng.includes(q) || sci.includes(q) || curator.includes(q);
    }

    return true;
  });

  // 統計數量
  const pendingCount = drafts.filter(d => d.status === 'pending').length;
  const rejectedCount = drafts.filter(d => d.status === 'rejected').length;
  const approvedCount = drafts.filter(d => d.status === 'approved').length;

  return (
    <div className="space-y-6">
      {/* 頂部 Header & 統計資訊 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
                {language === 'zh' ? '草稿修訂管理員 (Draft Manager)' : 'Draft Manager Console'}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {language === 'zh' ? '管理並審核 Curator 提交的動物 (Fauna) 與植物 (Flora) 修訂草稿' : 'Review and manage Fauna & Flora draft revisions submitted by curators.'}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchDrafts}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-2xl transition-all cursor-pointer shrink-0 active:scale-95"
        >
          <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>{language === 'zh' ? '重新整理' : 'Refresh'}</span>
        </button>
      </div>

      {/* 篩選與 Tab 切換列 */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* 左側：Fauna / Flora 分頁切換 */}
        <div className="flex items-center p-1.5 bg-slate-200/60 rounded-2xl text-xs font-black">
          <button
            onClick={() => setTaxaTab('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer ${
              taxaTab === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{language === 'zh' ? '全部物種 (All)' : 'All Taxa'}</span>
          </button>

          <button
            onClick={() => setTaxaTab('fauna')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer ${
              taxaTab === 'fauna'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Bug className="w-3.5 h-3.5" />
            <span>{language === 'zh' ? '動物 (Fauna)' : 'Fauna'}</span>
          </button>

          <button
            onClick={() => setTaxaTab('flora')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer ${
              taxaTab === 'flora'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Leaf className="w-3.5 h-3.5" />
            <span>{language === 'zh' ? '植物 (Flora)' : 'Flora'}</span>
          </button>
        </div>

        {/* 右側：狀態篩選與搜尋框 */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* 草稿狀態下拉選單 */}
          <div className="relative w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full sm:w-auto appearance-none bg-white border border-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 pr-8 rounded-2xl shadow-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="processing">{language === 'zh' ? '進行中草稿 (Pending + Rejected)' : 'Processing (Pending + Rejected)'}</option>
              <option value="pending">{language === 'zh' ? `待審核 (${pendingCount})` : `Pending (${pendingCount})`}</option>
              <option value="rejected">{language === 'zh' ? `已退回 (${rejectedCount})` : `Rejected (${rejectedCount})`}</option>
              <option value="approved">{language === 'zh' ? `已發布 (${approvedCount})` : `Approved (${approvedCount})`}</option>
              <option value="all">{language === 'zh' ? '所有狀態草稿' : 'All Statuses'}</option>
            </select>
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* 搜尋框 */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={language === 'zh' ? '搜尋物種名或 Curator...' : 'Search species or curator...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 placeholder-slate-400 font-medium text-xs pl-9 pr-4 py-2.5 rounded-2xl shadow-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* 草稿數據 Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-3">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
            <p className="text-xs font-bold">{language === 'zh' ? '載入草稿列表中...' : 'Loading draft revisions...'}</p>
          </div>
        ) : filteredDrafts.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 text-center px-4">
            <FileEdit className="w-12 h-12 text-slate-300 mb-3" />
            <h3 className="text-base font-extrabold text-slate-700 mb-1">
              {language === 'zh' ? '沒有找到相符的草稿修訂' : 'No Draft Revisions Found'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm">
              {language === 'zh' ? '目前沒有任何滿足篩選條件的物種草稿。' : 'There are currently no draft revisions matching your search filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">{language === 'zh' ? '物種資料 (Species)' : 'Species'}</th>
                  <th className="py-4 px-6">{language === 'zh' ? '分類 (Taxa)' : 'Taxa'}</th>
                  <th className="py-4 px-6">{language === 'zh' ? '提交者 (Curator)' : 'Curator'}</th>
                  <th className="py-4 px-6">{language === 'zh' ? '草稿狀態 (Status)' : 'Status'}</th>
                  <th className="py-4 px-6">{language === 'zh' ? '提交時間 (Submission Date)' : 'Submitted At'}</th>
                  <th className="py-4 px-6 text-right">{language === 'zh' ? '操作 (Action)' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredDrafts.map((draft) => {
                  const isPlant = draft.table_name === 'plant_species' || String(draft.species_id || '').startsWith('flora_');
                  const chiName = draft.draft_data?.common_name_chi || '未有名稱';
                  const engName = draft.draft_data?.common_name_eng;
                  const sciName = draft.draft_data?.scientific_name || draft.species_id;

                  return (
                    <tr
                      key={draft.id}
                      onClick={() => handleOpenDraftModal(draft)}
                      className="hover:bg-slate-50/90 transition-colors cursor-pointer group"
                    >
                      {/* 物種資訊 */}
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-extrabold text-slate-800 text-sm group-hover:text-emerald-600 transition-colors">
                            {chiName}
                            {engName && <span className="text-slate-400 font-normal ml-1.5 text-xs">({engName})</span>}
                          </span>
                          <span className="text-slate-400 text-xs font-serif italic">
                            {sciName}
                          </span>
                        </div>
                      </td>

                      {/* 分類群 Badge */}
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                          isPlant ? 'bg-teal-50 text-teal-700 border border-teal-200/60' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        }`}>
                          {isPlant ? <Leaf className="w-3 h-3 text-teal-600" /> : <Bug className="w-3 h-3 text-emerald-600" />}
                          <span>{isPlant ? 'Flora' : 'Fauna'}</span>
                        </span>
                      </td>

                      {/* Curator 資訊 */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2.5">
                          {draft.curator_avatar ? (
                            <img src={draft.curator_avatar} alt={draft.curator_name || 'Curator'} className="w-6 h-6 rounded-full object-cover border border-slate-200" />
                          ) : (
                            <UserCircle className="w-6 h-6 text-slate-300" />
                          )}
                          <span className="font-bold text-slate-700">
                            {draft.curator_name || 'Curator'}
                          </span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-6">
                        {draft.status === 'pending' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl font-black text-[11px]">
                            <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                            <span>{language === 'zh' ? '待審核 (Pending)' : 'Pending Review'}</span>
                          </span>
                        )}

                        {draft.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-black text-[11px]">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                            <span>{language === 'zh' ? '已退回 (Rejected)' : 'Rejected'}</span>
                          </span>
                        )}

                        {draft.status === 'approved' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-black text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{language === 'zh' ? '已發布 (Approved)' : 'Approved'}</span>
                          </span>
                        )}
                      </td>

                      {/* 提交時間 */}
                      <td className="py-4 px-6 text-slate-500 font-medium">
                        {formatDate(draft.submitted_at)}
                      </td>

                      {/* 操作按鈕 */}
                      <td className="py-4 px-6 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDraftModal(draft);
                          }}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl text-xs font-black transition-all shadow-xs group-hover:scale-105 active:scale-95 cursor-pointer"
                        >
                          <span>{language === 'zh' ? '審核與管理' : 'Review Draft'}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 開啟 SpeciesEditModal Modal 進行 Approve / Reject / Delete 操作 */}
      {isModalOpen && targetSpecies && (
        <SpeciesEditModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedDraft(null);
            setTargetSpecies(null);
          }}
          species={targetSpecies}
          tableName={selectedDraft?.table_name || (targetSpecies.taxa_group === 'FLORA' ? 'plant_species' : 'species')}
          reviewDraft={selectedDraft}
          onApproveDraft={async (draft) => {
            if (!profile) return;
            const targetTable = draft.table_name || 'species';
            
            // 1. 更新正式物種表
            let query = supabase.from(targetTable).update(draft.draft_data);
            if (String(draft.species_id).includes('-')) {
              query = query.or(`id.eq.${draft.species_id},taxa_id.eq.${draft.species_id}`);
            } else {
              query = query.eq('taxa_id', draft.species_id);
            }
            await query;

            // 2. 更新草稿狀態為 approved
            await supabase
              .from('species_drafts')
              .update({
                status: 'approved',
                approved_by: profile.id,
                approved_by_name: profile.username || (profile.email ? profile.email.split('@')[0] : undefined),
                approved_at: new Date().toISOString()
              })
              .eq('id', draft.id);

            fetchDrafts();
          }}
          onRejectDraft={async (draft, reason) => {
            if (!profile) return;
            await supabase
              .from('species_drafts')
              .update({
                status: 'rejected',
                rejection_reason: reason,
                approved_by: profile.id,
                approved_by_name: profile.username || (profile.email ? profile.email.split('@')[0] : undefined),
                approved_at: new Date().toISOString()
              })
              .eq('id', draft.id);

            fetchDrafts();
          }}
          onSuccess={() => {
            fetchDrafts();
          }}
        />
      )}

      {/* Loading Modal State */}
      {loadingSpecies && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/40 backdrop-blur-xs">
          <div className="bg-white p-5 rounded-3xl shadow-2xl flex items-center gap-3">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
            <span className="text-xs font-black text-slate-700">
              {language === 'zh' ? '正在載入草稿物種資料...' : 'Loading draft species details...'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
