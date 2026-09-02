'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { fetchSpeciesOrPlantRow } from '@/utils/speciesQuery';
import { Species } from '@/types/species';
import { SpeciesDraft } from '@/types/speciesDraft';
import SpeciesDetailEditor from '@/components/admin/SpeciesDetailEditor';
import { 
  X, 
  Save, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Loader2, 
  ShieldAlert,
  Sparkles,
  Trash2,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SpeciesEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  species: any;
  tableName?: string; // 'species' | 'plant_species'
  onSuccess?: () => void;
  reviewDraft?: SpeciesDraft | null;
  onApproveDraft?: (draft: SpeciesDraft, updatedData?: any) => Promise<void>;
  onRejectDraft?: (draft: SpeciesDraft, reason: string) => Promise<void>;
}

export default function SpeciesEditModal({
  isOpen,
  onClose,
  species,
  tableName = 'species',
  onSuccess,
  reviewDraft,
  onApproveDraft,
  onRejectDraft
}: SpeciesEditModalProps) {
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const supabase = createClient();

  const [loadingDraft, setLoadingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [activeDraft, setActiveDraft] = useState<SpeciesDraft | null>(null);
  const [editorData, setEditorData] = useState<any>(species);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deletingDraft, setDeletingDraft] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const triggerSaveRef = React.useRef<(() => void) | null>(null);

  // 判斷角色與草稿擁有人權限
  const isAdmin = profile?.role === 'admin';
  const isCurator = profile?.role === 'curator';
  const speciesId = species?.id || species?.taxa_id;

  const currentDraft = reviewDraft || activeDraft;
  const isPending = currentDraft?.status === 'pending';
  const isDraftOwner = user?.id === currentDraft?.curator_id;
  // 獨佔鎖定判斷：非 Admin、草稿處於 pending 狀態、且草稿屬於其他 Curator
  const isLockedByOtherCurator = !isAdmin && isPending && !!currentDraft?.curator_id && !isDraftOwner;

  const [publishedSpecies, setPublishedSpecies] = useState<Species | null>(species);

  // 載入草稿資料與資料庫正本 (確保全站對比基準 100% 絕對一致)
  useEffect(() => {
    if (!isOpen || !speciesId) return;

    async function loadLatestDraftAndPublished() {
      setLoadingDraft(true);
      try {
        const isFungi = tableName === 'fungi_species' || species?.taxa_group === 'FUNGI' || String(species?.taxa_id || '').startsWith('fungi_') || String(speciesId || '').startsWith('fungi_');
        const isPlant = tableName === 'plant_species' || species?.taxa_group === 'FLORA' || (species as any)?.category_chi || String(species?.taxa_id || '').startsWith('flora_') || String(speciesId || '').startsWith('flora_');
        const targetTable = isFungi ? 'fungi_species' : (isPlant ? 'plant_species' : 'species');

        // 1. 調用強健查詢函數抓取 Supabase 正式資料庫中最純淨的正本行數據
        const pubData = await fetchSpeciesOrPlantRow(speciesId, targetTable);
        const basePub = pubData || species;
        setPublishedSpecies(basePub);

        // 2. 確定草稿資料 (若傳入 reviewDraft 優先使用，否則搜尋最新未完成草稿)
        let targetDraft: SpeciesDraft | null = reviewDraft || null;
        if (!targetDraft) {
          const { data: draftData } = await supabase
            .from('species_drafts')
            .select('*')
            .eq('species_id', speciesId)
            .in('status', ['pending', 'rejected'])
            .order('submitted_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (draftData) targetDraft = draftData as SpeciesDraft;
        }

        if (targetDraft) {
          setActiveDraft(targetDraft);
          setEditorData({
            ...basePub,
            ...targetDraft.draft_data
          });
        } else {
          setActiveDraft(null);
          setEditorData(basePub);
        }
      } catch (err) {
        console.error('Error loading species draft and published row:', err);
      } finally {
        setLoadingDraft(false);
      }
    }

    loadLatestDraftAndPublished();
  }, [isOpen, speciesId, reviewDraft]);

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return language === 'zh' ? '未知時間' : 'Unknown';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleString(language === 'zh' ? 'zh-HK' : 'en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (e) {
      return isoString;
    }
  };

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 刪除草稿邏輯 (Delete Draft)
  const handleDeleteDraft = async () => {
    const targetDraft = reviewDraft || activeDraft;
    if (!targetDraft) return;

    setDeletingDraft(true);
    try {
      // 1. 嘗試直接從資料庫刪除該筆草稿
      const { error } = await supabase
        .from('species_drafts')
        .delete()
        .eq('id', targetDraft.id);

      if (error) {
        console.warn('Direct delete error, trying status update fallback:', error);
        // 如果受限於 DB 權限， fallback 改為狀態撤回 (status = rejected/cancelled)
        const { error: updateError } = await supabase
          .from('species_drafts')
          .update({
            status: 'rejected',
            rejection_reason: 'Curator 手動撤回並取消草稿'
          })
          .eq('id', targetDraft.id);

        if (updateError) throw updateError;
      }

      showToast('success', language === 'zh' ? '草稿已成功刪除，該物種已解除鎖定！' : 'Draft deleted and species unlocked!');
      setActiveDraft(null);
      setShowDeleteConfirmModal(false);
      if (onSuccess) onSuccess();
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      console.error('Error deleting species draft:', err);
      showToast('error', err.message || (language === 'zh' ? '刪除草稿失敗，請檢查資料庫權限' : 'Failed to delete draft'));
    } finally {
      setDeletingDraft(false);
    }
  };

  // 處理提交/更新草稿 (Curator 打包提交草稿，Admin 也可直接 Save)
  const handleSave = async (updatedData: any) => {
    if (!user || !profile) {
      showToast('error', language === 'zh' ? '請先登入帳號' : 'Please sign in first');
      return;
    }

    if (isLockedByOtherCurator) {
      showToast('error', language === 'zh' ? '此物種已被其他 Curator 鎖定，暫無法編輯' : 'This species is locked by another curator');
      return;
    }

    setSubmitting(true);
    try {
      if (isApproving && onApproveDraft && currentDraft) {
        // Admin「批准並發布」模式：調用批准並帶入管理員最新編輯的 updatedData
        await onApproveDraft(currentDraft, updatedData);
        showToast('success', language === 'zh' ? '已成功批准修訂並發布！' : 'Draft approved and published!');
        if (onSuccess) onSuccess();
        setTimeout(() => onClose(), 1200);
        return;
      }

      const isFungi = tableName === 'fungi_species' || species?.taxa_group === 'FUNGI' || String(species?.taxa_id || '').startsWith('fungi_') || String(speciesId || '').startsWith('fungi_');
      const isPlant = tableName === 'plant_species' || species?.taxa_group === 'FLORA' || (species as any)?.category_chi || String(species?.taxa_id || '').startsWith('flora_') || String(speciesId || '').startsWith('flora_');
      const targetTable = isFungi ? 'fungi_species' : (isPlant ? 'plant_species' : 'species');

      if (isAdmin) {
        // Admin: 直接更新正本 species / plant_species / fungi_species 表
        let query = supabase.from(targetTable).update(updatedData);
        if (species.id) {
          query = query.eq('id', species.id);
        } else if (species.taxa_id) {
          query = query.eq('taxa_id', species.taxa_id);
        } else if (speciesId) {
          query = query.eq('taxa_id', speciesId);
        }

        const { error: updateError } = await query;
        if (updateError) throw updateError;

        // 同時將 any pending 草稿設為 approved (若原本有館員草稿，則標記批准)
        if (activeDraft) {
          await supabase
            .from('species_drafts')
            .update({
              status: 'approved',
              draft_data: updatedData,
              approved_by: user.id,
              approved_by_name: profile.username || user.email?.split('@')[0],
              approved_at: new Date().toISOString()
            })
            .eq('id', activeDraft.id);
        }

        showToast('success', language === 'zh' ? '物種資料已即時更新並發布！' : 'Species updated and published successfully!');
        if (onSuccess) onSuccess();
        setTimeout(() => onClose(), 1200);

      } else {
        // Curator: 提交/更新草稿待 Admin 審核
        const nowIso = new Date().toISOString();
        const isUpdateMode = !!(activeDraft && activeDraft.status !== 'approved');

        if (isUpdateMode) {
          const { error } = await supabase
            .from('species_drafts')
            .update({
              draft_data: updatedData,
              status: 'pending',
              rejection_reason: null,
              submitted_at: nowIso
            })
            .eq('id', activeDraft.id);

          if (error) throw error;

          setActiveDraft(prev => prev ? { ...prev, draft_data: updatedData, status: 'pending', submitted_at: nowIso, rejection_reason: null } : null);
          showToast('success', language === 'zh' ? '草稿已成功更新！提交時間已重新計算。' : 'Draft updated! Submission time refreshed.');
        } else {
          const { data: newDraft, error } = await supabase
            .from('species_drafts')
            .insert({
              species_id: speciesId,
              table_name: targetTable,
              curator_id: user.id,
              curator_name: profile.username || user.email?.split('@')[0],
              curator_avatar: profile.avatar_url,
              draft_data: updatedData,
              status: 'pending',
              submitted_at: nowIso
            })
            .select('*')
            .single();

          if (error) throw error;
          if (newDraft) setActiveDraft(newDraft as SpeciesDraft);

          showToast('success', language === 'zh' ? '草稿已成功提交！等待管理員審核。' : 'Draft submitted! Pending admin approval.');
        }

        if (onSuccess) onSuccess();
        setTimeout(() => onClose(), 1400);
      }
    } catch (err: any) {
      console.error('Error saving species detail:', err);
      showToast('error', err.message || (language === 'zh' ? '儲存失敗，請重試' : 'Save failed, please try again'));
    } finally {
      setSubmitting(false);
      setIsApproving(false);
    }
  };

  if (!isOpen) return null;

  const speciesName = language === 'zh' 
    ? (species.common_name_chi || species.common_name_eng || species.scientific_name)
    : (species.common_name_eng || species.common_name_chi || species.scientific_name);

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/85 backdrop-blur-xl p-2 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="relative w-full max-w-6xl max-h-[92vh] bg-white rounded-[2rem] shadow-2xl border border-white/80 overflow-hidden flex flex-col"
      >
        {/* Toast Notification inside modal */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`absolute top-4 left-1/2 -translate-x-1/2 z-[100000] px-6 py-2.5 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-black tracking-wide ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
                  : 'bg-rose-900 text-rose-100 border-rose-700'
              }`}
            >
              {toastMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>{toastMessage.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-black uppercase">
                  {tableName === 'plant_species' ? 'Flora' : 'Fauna'}
                </span>
                <h3 className="font-black text-slate-800 text-lg leading-tight">
                  {speciesName}
                </h3>
              </div>
              <p className="text-slate-400 text-xs font-serif italic mt-0.5">
                {species?.scientific_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* 情況 A：如果是被其他 Curator 獨佔鎖定中 */}
            {isLockedByOtherCurator ? (
              <span className="px-3.5 py-1.5 bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>{language === 'zh' ? '獨佔鎖定中' : 'Locked by Curator'}</span>
              </span>
            ) : isAdmin && onApproveDraft && isPending ? (
              <>
                {/* Admin Review Mode: Delete Button */}
                <button
                  type="button"
                  disabled={submitting || deletingDraft}
                  onClick={() => setShowDeleteConfirmModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                  title={language === 'zh' ? '刪除此草稿修訂' : 'Delete Draft'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{language === 'zh' ? '刪除草稿' : 'Delete'}</span>
                </button>

                {/* Admin Review Mode: Reject Button */}
                {onRejectDraft && (
                  <button
                    type="button"
                    disabled={submitting || deletingDraft}
                    onClick={() => setShowRejectModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    <span>{language === 'zh' ? '退回修訂' : 'Reject'}</span>
                  </button>
                )}

                {/* Admin Review Mode: Approve Button */}
                <button
                  type="button"
                  disabled={submitting || deletingDraft}
                  onClick={async () => {
                    if (onApproveDraft && currentDraft) {
                      setIsApproving(true);
                      if (triggerSaveRef.current) {
                        // 觸發編輯器儲存，會收集最新資料並呼叫 handleSave
                        triggerSaveRef.current();
                      } else {
                        // Fallback: 如果沒有編輯器，則直接批准
                        setSubmitting(true);
                        try {
                          await onApproveDraft(currentDraft);
                          showToast('success', language === 'zh' ? '已成功批准修訂並發布！' : 'Draft approved and published!');
                          if (onSuccess) onSuccess();
                          setTimeout(() => onClose(), 1200);
                        } catch (err) {
                          showToast('error', language === 'zh' ? '審核失敗' : 'Approval failed');
                        } finally {
                          setSubmitting(false);
                          setIsApproving(false);
                        }
                      }
                    }
                  }}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 border border-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-200 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{language === 'zh' ? '批准並發布 (Approve)' : 'Approve & Publish'}</span>
                </button>
              </>
            ) : (
              /* Regular Edit / Curator Update Mode */
              <>
                {/* 如果當前使用者是草稿擁有人/Admin 且有 pending/rejected 草稿，顯示刪除草稿按鈕 */}
                {(isDraftOwner || isAdmin) && !!currentDraft && (currentDraft.status === 'pending' || currentDraft.status === 'rejected') && (
                  <button
                    type="button"
                    disabled={submitting || deletingDraft}
                    onClick={() => setShowDeleteConfirmModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                    title={language === 'zh' ? '刪除此草稿' : 'Delete Draft'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{language === 'zh' ? '刪除草稿' : 'Delete'}</span>
                  </button>
                )}

                {/* Submit / Update Button */}
                <button
                  type="button"
                  disabled={submitting || deletingDraft}
                  onClick={() => {
                    if (triggerSaveRef.current) {
                      triggerSaveRef.current();
                    }
                  }}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border shadow-sm cursor-pointer ${
                    submitting
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-wait'
                      : 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-200 hover:bg-emerald-700 hover:scale-105 active:scale-95'
                  }`}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isAdmin 
                      ? (language === 'zh' ? '儲存變更' : 'Save Changes')
                      : (currentDraft?.status === 'rejected' && isDraftOwner
                          ? (language === 'zh' ? '重新提交草稿' : 'Resubmit Draft')
                          : (isPending && isDraftOwner
                              ? (language === 'zh' ? '更新草稿' : 'Update Draft')
                              : (language === 'zh' ? '提交草稿' : 'Submit Draft')
                            )
                        )
                    }
                  </span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              disabled={submitting || deletingDraft}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 獨佔鎖定警告 Alert Banner (當此物種正被其他 Curator 獨佔鎖定時) */}
        {isLockedByOtherCurator && (
          <div className="bg-amber-500 text-white px-6 py-3 flex items-center gap-3 text-xs font-bold shadow-inner border-b border-amber-600">
            <Lock className="w-5 h-5 text-amber-100 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-black text-sm">
                {language === 'zh' ? '【獨佔鎖定中】此物種已有待審核草稿' : '[Locked] Pending Draft Exists'}
              </p>
              <p className="opacity-95 font-medium mt-0.5 leading-relaxed">
                {language === 'zh'
                  ? `本物種目前已被 Curator (${currentDraft?.curator_name || '館員'}) 獨佔鎖定修訂中，提交時間為 ${formatDate(currentDraft?.submitted_at)}。在管理員審核發布或 Curator 刪除前，暫無法重複編輯。`
                  : `This species is locked by Curator (${currentDraft?.curator_name}) submitted at ${formatDate(currentDraft?.submitted_at)}. Only this curator or admins can edit or delete this draft.`}
              </p>
            </div>
          </div>
        )}

        {/* Admin Review Banner Info (當正在審核待審草稿時) */}
        {isAdmin && (reviewDraft || (onApproveDraft && activeDraft)) && isPending && (
          <div className="bg-amber-500 text-white px-6 py-2.5 flex items-center justify-between text-xs font-bold shadow-inner">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-200 shrink-0" />
              <span>
                {language === 'zh' 
                  ? `【草稿審核模式】目前正檢視 Curator (${currentDraft?.curator_name || '館員'}) 於 ${formatDate(currentDraft?.submitted_at)} 提交的修訂，已高亮顯示所有修改欄位。`
                  : `[Draft Review Mode] Reviewing revision by Curator (${currentDraft?.curator_name}) submitted at ${formatDate(currentDraft?.submitted_at)}.`}
              </span>
            </div>
          </div>
        )}

        {/* 退回通知 Alert Banner (若草稿 status 為 rejected) */}
        {currentDraft && currentDraft.status === 'rejected' && (
          <div className="bg-rose-50 border-b border-rose-100 px-6 py-3.5 flex items-start gap-3 text-rose-800 text-xs">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-sm text-rose-900">
                {language === 'zh' ? '此物種草稿已被退回 (Status: Rejected)' : 'Draft Revision Status: Rejected'}
              </p>
              <p className="text-rose-700 font-bold mt-1">
                {language === 'zh' ? '退回原因：' : 'Rejection Reason: '}
                <span className="italic">"{ currentDraft.rejection_reason || (language === 'zh' ? '未提供特定理由' : 'No specific reason provided') }"</span>
              </p>
              <p className="text-[11px] text-rose-500 mt-1">
                {language === 'zh' ? 'Curator 可根據退回原因重新修正內容後按右上角「重新提交草稿 (Resubmit Draft)」，或點擊右上角「刪除」撤回此草稿。' : 'Curator may update the fields to resubmit or click "Delete" at top right to remove this draft.'}
              </p>
            </div>
          </div>
        )}

        {/* Curator 自己的 Pending 草稿 Banner (顯示提交日期時間) */}
        {!isAdmin && isPending && isDraftOwner && (
          <div className="bg-amber-50 border-b border-amber-100 px-6 py-3 flex items-center justify-between text-amber-900 text-xs">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-black text-amber-950">
                  {language === 'zh' ? '待審草稿提交時間：' : 'Pending Draft Submitted At: '}
                  {formatDate(currentDraft?.submitted_at)}
                </span>
                <span className="ml-2 font-medium text-amber-800">
                  {language === 'zh' ? '（修改後點擊右上角「更新草稿 (Update Draft)」將重新計算提交時間）' : '(Click "Update Draft" to save changes and refresh submission time)'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Curator 已有 Pending 草稿 Alert Banner */}
        {!onApproveDraft && activeDraft && activeDraft.status === 'pending' && (
          <div className="bg-amber-50 border-b border-amber-100 px-6 py-3 flex items-center justify-between text-amber-900 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-bold">
                {language === 'zh'
                  ? '目前有一筆正在等待審核的草稿修訂，修改後按右上角「提交草稿」將更新該筆待審草稿。'
                  : 'You have a pending draft currently waiting for approval.'}
              </span>
            </div>
          </div>
        )}

        {/* Modal Main Body - SpeciesDetailEditor (with hideHeader=true) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          {loadingDraft ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
              <p className="text-xs font-bold">{language === 'zh' ? '載入編輯器與修訂草稿...' : 'Loading editor and draft...'}</p>
            </div>
          ) : (
            <SpeciesDetailEditor
              table={
                tableName === 'fungi_species' || species?.taxa_group === 'FUNGI' || String(species?.taxa_id || '').startsWith('fungi_') || String(speciesId || '').startsWith('fungi_')
                  ? 'fungi_species'
                  : tableName === 'plant_species' || species?.taxa_group === 'FLORA' || (species as any)?.category_chi || String(species?.taxa_id || '').startsWith('flora_') || String(speciesId || '').startsWith('flora_')
                    ? 'plant_species'
                    : 'species'
              }
              data={editorData}
              originalData={publishedSpecies || species}
              publishedOriginal={publishedSpecies || species}
              onSave={handleSave}
              onCancel={onClose}
              hideHeader={true}
              disableDirectDatabaseUpdate={true}
              onRegisterSave={(saveFn) => {
                triggerSaveRef.current = saveFn;
              }}
              onDirtyChange={(dirty) => setIsEditorDirty(dirty)}
            />
          )}
        </div>
      </motion.div>

      {/* Reject Modal in Review mode */}
      <AnimatePresence>
        {showRejectModal && (
          <div className="fixed inset-0 z-[100005] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <ShieldAlert className="w-6 h-6" />
                <h4 className="font-black text-slate-800 text-base">
                  {language === 'zh' ? '退回此草稿修訂' : 'Reject Draft Revision'}
                </h4>
              </div>

              <p className="text-xs text-slate-500">
                {language === 'zh'
                  ? '請輸入退回理由，Curator 將會看到此意見並可修正後重新提交：'
                  : 'Please enter the reason for rejection to guide the curator for re-submission:'}
              </p>

              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={language === 'zh' ? '例如：保護評級需補充參考文獻格式...' : 'Enter rejection reason...'}
                className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs outline-none focus:border-rose-400 font-medium"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  {language === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button
                  onClick={async () => {
                    if (!rejectionReason.trim()) {
                      alert(language === 'zh' ? '請填寫退回原因' : 'Please enter rejection reason');
                      return;
                    }
                    if (onRejectDraft && (reviewDraft || activeDraft)) {
                      setSubmitting(true);
                      try {
                        const targetDraft = reviewDraft || activeDraft;
                        await onRejectDraft(targetDraft!, rejectionReason);
                        if (targetDraft) {
                          setActiveDraft({
                            ...targetDraft,
                            status: 'rejected',
                            rejection_reason: rejectionReason
                          });
                        }
                        setShowRejectModal(false);
                        showToast('success', language === 'zh' ? '草稿已退回' : 'Draft rejected');
                        if (onSuccess) onSuccess();
                        setTimeout(() => onClose(), 1200);
                      } catch (err) {
                        showToast('error', language === 'zh' ? '退回草稿失敗' : 'Reject failed');
                      } finally {
                        setSubmitting(false);
                      }
                    }
                  }}
                  disabled={submitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (language === 'zh' ? '確認退回' : 'Confirm Reject')}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Draft Confirm Modal */}
        {showDeleteConfirmModal && (
          <div className="fixed inset-0 z-[100005] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <Trash2 className="w-6 h-6" />
                <h4 className="font-black text-slate-800 text-base">
                  {language === 'zh' ? '確認刪除草稿修訂？' : 'Delete Draft Revision?'}
                </h4>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                {language === 'zh'
                  ? '確定要刪除這筆草稿修訂嗎？刪除後將無法復原，且該物種的獨佔鎖定將會自動解除。'
                  : 'Are you sure you want to delete this draft revision? This action cannot be undone and will unlock this species.'}
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={deletingDraft}
                  onClick={() => setShowDeleteConfirmModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  {language === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={deletingDraft}
                  onClick={handleDeleteDraft}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  {deletingDraft ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>{language === 'zh' ? '確認刪除' : 'Confirm Delete'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
