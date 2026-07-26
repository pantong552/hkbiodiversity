'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { SpeciesDraft } from '@/types/speciesDraft';
import { 
  ShieldCheck, 
  Check, 
  X, 
  AlertTriangle, 
  Clock, 
  UserCircle, 
  Loader2, 
  FileText,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AdminDraftReviewBannerProps {
  speciesId: string;
  tableName?: string;
  onApproved?: () => void;
  onOpenReviewModal?: (draft: SpeciesDraft) => void;
}

export default function AdminDraftReviewBanner({
  speciesId,
  tableName = 'species',
  onApproved,
  onOpenReviewModal
}: AdminDraftReviewBannerProps) {
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const supabase = createClient();

  const [pendingDraft, setPendingDraft] = useState<SpeciesDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const isAdmin = profile?.role === 'admin';

  const fetchPendingDraft = async () => {
    if (!isAdmin || !speciesId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('species_drafts')
        .select('*')
        .eq('species_id', speciesId)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setPendingDraft(data as SpeciesDraft);
      } else {
        setPendingDraft(null);
      }
    } catch (err) {
      console.error('Error fetching pending draft:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingDraft();
  }, [speciesId, isAdmin]);

  // 同意 Approve
  const handleApprove = async () => {
    if (!pendingDraft || !user || !profile) return;
    setActionLoading(true);

    try {
      const targetTable = tableName === 'plant_species' ? 'plant_species' : 'species';

      // 1. 更新正式物種表
      const { error: updateError } = await supabase
        .from(targetTable)
        .update(pendingDraft.draft_data)
        .eq('id', speciesId);

      if (updateError) throw updateError;

      // 2. 更新 species_drafts 狀態為 approved
      const { error: draftError } = await supabase
        .from('species_drafts')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_by_name: profile.username || user.email?.split('@')[0],
          approved_at: new Date().toISOString()
        })
        .eq('id', pendingDraft.id);

      if (draftError) throw draftError;

      setPendingDraft(null);
      setShowReviewModal(false);
      if (onApproved) onApproved();
    } catch (err) {
      console.error('Error approving draft:', err);
      alert(language === 'zh' ? '審核發布失敗，請重試' : 'Approval failed, please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // 退回 Reject
  const handleReject = async () => {
    if (!pendingDraft || !user) return;
    if (!rejectionReason.trim()) {
      alert(language === 'zh' ? '請填寫退回原因' : 'Please enter a rejection reason.');
      return;
    }
    setActionLoading(true);

    try {
      const { error } = await supabase
        .from('species_drafts')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          approved_by: user.id,
          approved_by_name: profile?.username || user.email?.split('@')[0],
          approved_at: new Date().toISOString()
        })
        .eq('id', pendingDraft.id);

      if (error) throw error;

      setPendingDraft(null);
      setShowRejectModal(false);
      setShowReviewModal(false);
      setRejectionReason('');
    } catch (err) {
      console.error('Error rejecting draft:', err);
      alert(language === 'zh' ? '退回草稿失敗' : 'Reject failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isAdmin || loading || !pendingDraft) return null;

  return (
    <>
      {/* Page Top Notification Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full bg-gradient-to-r from-amber-500 via-amber-600 to-emerald-600 text-white shadow-lg py-3 px-6"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-black">
                {language === 'zh' ? '【待管理員審核】' : '[Pending Review] '}
              </span>
              <span>
                {language === 'zh'
                  ? `Curator ${pendingDraft.curator_name || '館員'} 提交了此物種的修訂草稿`
                  : `Curator ${pendingDraft.curator_name || 'Curator'} submitted a revision for this species.`}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              if (onOpenReviewModal) {
                onOpenReviewModal(pendingDraft);
              } else {
                setShowReviewModal(true);
              }
            }}
            className="flex items-center gap-1.5 bg-white text-amber-800 hover:bg-amber-50 font-black px-4 py-2 rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
          >
            <span>{language === 'zh' ? '查看並審核修訂' : 'Review Revision'}</span>
            <ChevronRight className="w-4 h-4 text-amber-600" />
          </button>
        </div>
      </motion.div>

      {/* Review Modal */}
      <AnimatePresence>
        {showReviewModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-6 overflow-hidden space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-lg">
                      {language === 'zh' ? '審核物種修訂草稿' : 'Review Species Draft Revision'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Curator: {pendingDraft.curator_name} • {new Date(pendingDraft.submitted_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Summary of Modified Fields */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 max-h-60 overflow-y-auto text-xs space-y-2">
                <h4 className="font-black text-slate-700 uppercase tracking-wider text-[10px]">
                  {language === 'zh' ? '修訂草稿資料快照 (Draft Data Snapshot)' : 'Draft Data Snapshot'}
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-600 font-mono">
                  {Object.entries(pendingDraft.draft_data || {}).map(([key, val]) => (
                    val ? (
                      <div key={key} className="bg-white p-2 rounded-xl border border-slate-200/60 truncate">
                        <span className="font-bold text-slate-400 block text-[9px]">{key}</span>
                        <span className="text-slate-800 font-sans">{String(val)}</span>
                      </div>
                    ) : null
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-black rounded-xl transition-all text-xs flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  <span>{language === 'zh' ? '退回修訂 (Reject)' : 'Reject Revision'}</span>
                </button>

                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg shadow-emerald-200 transition-all text-xs flex items-center gap-1.5"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>{language === 'zh' ? '批准並發布至物種庫 (Approve)' : 'Approve & Publish'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reject Modal - Input Reason */}
      <AnimatePresence>
        {showRejectModal && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <AlertTriangle className="w-6 h-6" />
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
                  className="px-4 py-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  {language === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (language === 'zh' ? '確認退回' : 'Confirm Reject')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
