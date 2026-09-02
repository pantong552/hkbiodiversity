'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { SpeciesDraft } from '@/types/speciesDraft';
import { Species } from '@/types/species';
import { fetchSpeciesOrPlantRow } from '@/utils/speciesQuery';
import SpeciesEditModal from '@/components/species/SpeciesEditModal';
import { 
  FileEdit, 
  Clock, 
  ShieldAlert, 
  CheckCircle2, 
  Loader2, 
  ChevronRight, 
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function CuratorDraftsSection() {
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const supabase = createClient();

  const [drafts, setDrafts] = useState<SpeciesDraft[]>([]);
  const [loading, setLoading] = useState(true);

  // SpeciesEditModal 控制狀態
  const [selectedDraft, setSelectedDraft] = useState<SpeciesDraft | null>(null);
  const [targetSpecies, setTargetSpecies] = useState<Species | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingSpecies, setLoadingSpecies] = useState(false);

  // 抓取屬於當前 Curator 的所有草稿紀錄
  const fetchMyDrafts = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('species_drafts')
        .select('*')
        .eq('curator_id', user.id)
        .order('submitted_at', { ascending: false });

      if (!error && data) {
        setDrafts(data as SpeciesDraft[]);
      }
    } catch (err) {
      console.error('Error fetching curator drafts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyDrafts();
  }, [user?.id]);

  // 點擊草稿 Row，拉取正本資料並開啟 SpeciesEditModal
  const handleOpenModal = async (draft: SpeciesDraft) => {
    setSelectedDraft(draft);
    setLoadingSpecies(true);

    try {
      const speciesData = await fetchSpeciesOrPlantRow(draft.species_id, draft.table_name);

      if (speciesData) {
        setTargetSpecies(speciesData as Species);
        setIsModalOpen(true);
      } else {
        // 若找不到資料庫正本，建立 fallback 物件供 modal 呈現草稿
        const fallbackSpecies: any = {
          id: draft.species_id,
          taxa_id: draft.species_id,
          ...draft.draft_data
        };
        setTargetSpecies(fallbackSpecies);
        setIsModalOpen(true);
      }
    } catch (err) {
      console.error('Error fetching species for draft modal:', err);
      alert(language === 'zh' ? '載入物種數據失敗' : 'Failed to load species details.');
    } finally {
      setLoadingSpecies(false);
    }
  };

  // 格式化時間
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-xs font-bold">{language === 'zh' ? '載入我的草稿列表中...' : 'Loading your drafts...'}</p>
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 space-y-3">
        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-300">
          <FileEdit className="w-6 h-6" />
        </div>
        <h4 className="font-extrabold text-slate-700 text-sm">
          {language === 'zh' ? '目前沒有修訂草稿' : 'No Draft Revisions Yet'}
        </h4>
        <p className="text-xs text-slate-400 max-w-xs mx-auto">
          {language === 'zh' ? '當您在物種詳情頁點擊「編輯物種詳情」並提交修改後，草稿將會顯示於此處。' : 'When you edit species details, your draft revisions will appear here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
          {language === 'zh' ? `我的修訂草稿紀錄 (${drafts.length})` : `My Draft Revisions (${drafts.length})`}
        </h4>

        <button
          onClick={fetchMyDrafts}
          className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors cursor-pointer"
          title={language === 'zh' ? '重新整理草稿' : 'Refresh Drafts'}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 草稿列表 */}
      <div className="space-y-3">
        {drafts.map((draft) => {
          const chiName = draft.draft_data?.common_name_chi || '未指定物種';
          const engName = draft.draft_data?.common_name_eng;
          const sciName = draft.draft_data?.scientific_name || draft.species_id;
          const isRejected = draft.status === 'rejected';
          const isPending = draft.status === 'pending';
          const isApproved = draft.status === 'approved';

          return (
            <motion.div
              key={draft.id}
              onClick={() => handleOpenModal(draft)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="p-4 bg-slate-50/80 hover:bg-slate-100/80 rounded-2xl border border-slate-100 transition-all cursor-pointer space-y-2 group"
            >
              <div className="flex items-start justify-between gap-3">
                {/* 左側物種名稱 */}
                <div>
                  <h5 className="font-extrabold text-slate-800 text-sm group-hover:text-emerald-600 transition-colors">
                    {chiName}
                    {engName && <span className="text-slate-400 font-normal text-xs ml-1.5">({engName})</span>}
                  </h5>
                  <p className="text-[11px] text-slate-400 font-serif italic mt-0.5">
                    {sciName}
                  </p>
                </div>

                {/* 右側 Status Badge */}
                <div className="shrink-0">
                  {isPending && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl font-black text-[10px]">
                      <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                      <span>{language === 'zh' ? '待審核 (Pending)' : 'Pending'}</span>
                    </span>
                  )}

                  {isRejected && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-black text-[10px]">
                      <ShieldAlert className="w-3 h-3 text-rose-600" />
                      <span>{language === 'zh' ? '已被退回 (Rejected)' : 'Rejected'}</span>
                    </span>
                  )}

                  {isApproved && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-black text-[10px]">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{language === 'zh' ? '已發布 (Approved)' : 'Approved'}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* 退回原因 (若被退回) */}
              {isRejected && (
                <div className="p-2.5 bg-rose-50/60 border border-rose-100 rounded-xl text-rose-800 text-xs font-medium space-y-0.5">
                  <span className="font-bold text-rose-900 block">
                    {language === 'zh' ? '退回原因：' : 'Rejection Reason: '}
                  </span>
                  <p className="text-[11px] italic">
                    "{draft.rejection_reason || (language === 'zh' ? '未提供理由' : 'No reason provided')}"
                  </p>
                </div>
              )}

              {/* 下方資訊：提交時間 & 按鈕引導 */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>
                  {language === 'zh' ? '提交時間：' : 'Submitted: '}
                  {formatDate(draft.submitted_at)}
                </span>

                <div className="flex items-center gap-1 font-bold text-slate-600 group-hover:text-emerald-600">
                  <span>
                    {isRejected 
                      ? (language === 'zh' ? '修改並重新提交' : 'Revise & Resubmit')
                      : (language === 'zh' ? '查看及編輯' : 'View & Edit')
                    }
                  </span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 開啟 SpeciesEditModal Modal 進行編輯/重新提交 */}
      {isModalOpen && targetSpecies && (
        <SpeciesEditModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedDraft(null);
            setTargetSpecies(null);
          }}
          species={targetSpecies}
          tableName={
            selectedDraft?.table_name || 
            (targetSpecies.taxa_group === 'FUNGI' || String(targetSpecies.taxa_id || '').startsWith('fungi_')
              ? 'fungi_species'
              : targetSpecies.taxa_group === 'FLORA'
                ? 'plant_species'
                : 'species')
          }
          reviewDraft={selectedDraft}
          onSuccess={() => {
            fetchMyDrafts();
          }}
        />
      )}

      {/* Loading Modal State */}
      {loadingSpecies && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/40 backdrop-blur-xs">
          <div className="bg-white p-5 rounded-3xl shadow-2xl flex items-center gap-3">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
            <span className="text-xs font-black text-slate-700">
              {language === 'zh' ? '正在載入草稿內容...' : 'Loading draft details...'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
