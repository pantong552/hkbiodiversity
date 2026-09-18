'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Clock3, Loader2, Send, ShieldCheck, User, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { CuratorApplicationStatus, Profile } from '@/types/comments';

interface CuratorApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
}

const statusLabel = (status: CuratorApplicationStatus | null | undefined, language: string) => {
  if (language === 'zh') {
    return status === 'pending' ? '批核中' : status === 'approved' ? '已批核' : status === 'rejected' ? '已拒絕' : '未提交';
  }
  return status === 'pending' ? 'Pending' : status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Not submitted';
};

export default function CuratorApplicationModal({ isOpen, onClose, profile }: CuratorApplicationModalProps) {
  const { refreshProfile, user } = useAuth();
  const { language } = useLanguage();
  const supabase = createClient();
  const [reason, setReason] = useState('');
  const [reviewerName, setReviewerName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applicationStatus = profile?.curator_application_status;
  const isNewApplication = !applicationStatus || applicationStatus === 'rejected';
  const displayName = user?.user_metadata?.full_name || profile?.username || (language === 'zh' ? '未命名使用者' : 'Unnamed user');

  useEffect(() => {
    if (!isOpen) return;
    // Reset form state when the modal opens or the current application changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReason(profile?.curator_application_reason || '');
    setError(null);
  }, [isOpen, profile?.curator_application_reason]);

  useEffect(() => {
    if (!isOpen || !profile?.curator_application_reviewed_by) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReviewerName(null);
      return;
    }

    let cancelled = false;
    const loadReviewer = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', profile.curator_application_reviewed_by)
        .maybeSingle();
      if (!cancelled) setReviewerName(data?.username || null);
    };
    loadReviewer();
    return () => { cancelled = true; };
  }, [isOpen, profile?.curator_application_reviewed_by, supabase]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  const formatDate = useMemo(() => (value: string | null | undefined) => {
    if (!value) return language === 'zh' ? '—' : '—';
    return new Date(value).toLocaleString(language === 'zh' ? 'zh-TW' : 'en-US', {
      dateStyle: 'medium', timeStyle: 'short'
    });
  }, [language]);

  const submit = async () => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError(language === 'zh' ? '請填寫申請原因。' : 'Please provide a reason for your application.');
      return;
    }
    if (trimmedReason.length > 500) {
      setError(language === 'zh' ? '申請原因不可超過 500 字。' : 'The reason cannot exceed 500 characters.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const { error: submitError } = await supabase.rpc('submit_curator_application', { p_reason: trimmedReason });
    if (submitError) {
      setError(language === 'zh' ? '提交失敗，請稍後再試。' : 'Submission failed. Please try again.');
      setIsSubmitting(false);
      return;
    }
    await refreshProfile();
    setIsSubmitting(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="curator-application-title">
          <motion.button
            type="button"
            aria-label={language === 'zh' ? '關閉' : 'Close'}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm cursor-pointer"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => !isSubmitting && onClose()}
          />
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[2rem] bg-white shadow-2xl border border-slate-100"
          >
            <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="curator-application-title" className="text-lg font-black text-slate-900">
                    {language === 'zh' ? '申請 Curator' : 'Apply to become a Curator'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {language === 'zh' ? '請提供你希望協助維護生物多樣性資料的原因。' : 'Tell us why you would like to help curate biodiversity data.'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={onClose} disabled={isSubmitting} className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50" aria-label={language === 'zh' ? '關閉' : 'Close'}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoItem icon={<User className="w-4 h-4" />} label={language === 'zh' ? 'User Name' : 'User Name'} value={displayName} />
                <InfoItem icon={<Clock3 className="w-4 h-4" />} label={language === 'zh' ? '提交時間' : 'Submitted'} value={formatDate(profile?.curator_application_submitted_at)} />
                <InfoItem icon={<CheckCircle2 className="w-4 h-4" />} label={language === 'zh' ? '批核 Status' : 'Status'} value={statusLabel(applicationStatus, language)} />
                <InfoItem icon={<ShieldCheck className="w-4 h-4" />} label={language === 'zh' ? '批核 Admin' : 'Reviewed by'} value={reviewerName || (language === 'zh' ? '尚未批核' : 'Not reviewed')} />
              </div>

              <div>
                <label htmlFor="curator-reason" className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                  {language === 'zh' ? '想成為 Curator 的原因' : 'Why would you like to become a Curator?'}
                </label>
                <textarea
                  id="curator-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  readOnly={!isNewApplication || isSubmitting}
                  autoFocus={isNewApplication}
                  rows={5}
                  className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 read-only:cursor-default read-only:bg-slate-50"
                  placeholder={language === 'zh' ? '請輸入 500 字內的申請原因…' : 'Write your reason in 500 characters or fewer…'}
                />
                <div className="mt-1 text-right text-[10px] font-bold text-slate-400">{reason.length}/500</div>
              </div>

              {applicationStatus === 'rejected' && profile?.curator_application_rejection_reason && (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-black text-rose-700"><AlertCircle className="w-4 h-4" /> {language === 'zh' ? 'Admin 拒絕原因' : 'Admin rejection reason'}</div>
                  <p className="mt-2 text-sm leading-relaxed text-rose-800">{profile.curator_application_rejection_reason}</p>
                </div>
              )}

              {error && <p role="alert" className="flex items-center gap-2 text-xs font-bold text-rose-600"><AlertCircle className="w-4 h-4 shrink-0" />{error}</p>}

              {isNewApplication && (
                <button type="button" onClick={submit} disabled={isSubmitting} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {isSubmitting ? (language === 'zh' ? '提交中…' : 'Submitting…') : (language === 'zh' ? '提交申請' : 'Submit application')}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400">{icon}{label}</div>
      <p className="mt-1 truncate text-sm font-bold text-slate-700">{value}</p>
    </div>
  );
}
