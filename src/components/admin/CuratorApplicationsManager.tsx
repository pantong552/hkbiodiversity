'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Clock3, Loader2, Search, ShieldX, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { CuratorApplicationStatus, Profile } from '@/types/comments';

interface CuratorApplicationsManagerProps {
  onRequestConfirm: (onConfirm: () => void) => void;
  onApplicationReviewed: (profile: Profile) => void;
}

type ApplicationFilter = CuratorApplicationStatus | 'all';

export default function CuratorApplicationsManager({ onRequestConfirm, onApplicationReviewed }: CuratorApplicationsManagerProps) {
  const { language } = useLanguage();
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [reviewers, setReviewers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<ApplicationFilter>('pending');
  const [search, setSearch] = useState('');
  const [rejectingProfile, setRejectingProfile] = useState<Profile | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchApplications = async () => {
    setLoading(true);
    const [{ data, error: fetchError }, { data: reviewerData }] = await Promise.all([
      supabase
      .from('profiles')
      .select('*')
      .not('curator_application_status', 'is', null)
      .order('curator_application_submitted_at', { ascending: false }),
      supabase.from('profiles').select('id, username')
    ]);
    if (fetchError) setError(fetchError.message);
    setProfiles((data || []) as Profile[]);
    setReviewers((reviewerData || []) as Profile[]);
    setLoading(false);
  };

  useEffect(() => {
    // Initial data load is an external synchronization with Supabase.
    fetchApplications();
    // The fetch helper uses the stable Supabase singleton.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reviewerNames = useMemo(() => {
    const names = new Map<string, string>();
    reviewers.forEach((profile) => names.set(profile.id, profile.username || '—'));
    return names;
  }, [reviewers]);

  const visibleProfiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return profiles.filter((profile) => {
      const matchesFilter = filter === 'all' || profile.curator_application_status === filter;
      const matchesSearch = !query || [profile.username, profile.email, profile.curator_application_reason]
        .some((value) => value?.toLowerCase().includes(query));
      return matchesFilter && matchesSearch;
    });
  }, [filter, profiles, search]);

  const formatDate = (value: string | null | undefined) => value
    ? new Date(value).toLocaleString(language === 'zh' ? 'zh-TW' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

  const statusLabel = (status: CuratorApplicationStatus | null | undefined) => {
    if (language === 'zh') return status === 'pending' ? '批核中' : status === 'approved' ? '已批核' : '已拒絕';
    return status === 'pending' ? 'Pending' : status === 'approved' ? 'Approved' : 'Rejected';
  };

  const review = async (profile: Profile, decision: 'approved' | 'rejected', reason?: string) => {
    setActionLoading(profile.id);
    setError(null);
    const { data, error: reviewError } = await supabase.rpc('review_curator_application', {
      p_user_id: profile.id,
      p_decision: decision,
      p_rejection_reason: reason || null,
    });
    if (reviewError) {
      setError(reviewError.message);
    } else if (data) {
      const updatedProfile = { ...profile, ...(data as Profile) };
      setProfiles((current) => current.map((item) => item.id === profile.id ? updatedProfile : item));
      onApplicationReviewed(updatedProfile);
    }
    setActionLoading(null);
  };

  const approve = (profile: Profile) => {
    onRequestConfirm(() => review(profile, 'approved'));
  };

  const reject = async () => {
    if (!rejectingProfile || !rejectionReason.trim()) {
      setError(language === 'zh' ? '請輸入拒絕原因。' : 'Please enter a rejection reason.');
      return;
    }
    if (rejectionReason.trim().length > 500) {
      setError(language === 'zh' ? '拒絕原因不可超過 500 字。' : 'The rejection reason cannot exceed 500 characters.');
      return;
    }
    const profile = rejectingProfile;
    setRejectingProfile(null);
    await review(profile, 'rejected', rejectionReason.trim());
    setRejectionReason('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Curator application status">
          {(['pending', 'all', 'approved', 'rejected'] as ApplicationFilter[]).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={filter === item} onClick={() => setFilter(item)} className={`rounded-xl px-3 py-2 text-[10px] font-black transition-colors cursor-pointer ${filter === item ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'bg-white/70 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'}`}>
              {item === 'all' ? (language === 'zh' ? '全部' : 'All') : statusLabel(item)}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={language === 'zh' ? '搜尋申請…' : 'Search applications…'} className="w-full rounded-xl border border-white/80 bg-white/70 py-2.5 pl-9 pr-3 text-xs text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10" />
        </div>
      </div>

      {error && <p role="alert" className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600"><AlertCircle className="w-4 h-4" />{error}</p>}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400"><Loader2 className="mb-3 h-8 w-8 animate-spin text-emerald-500" /><span className="text-xs font-medium">{language === 'zh' ? '載入申請中…' : 'Loading applications…'}</span></div>
      ) : visibleProfiles.length === 0 ? (
        <div className="rounded-[1.5rem] border border-white bg-white/50 py-16 text-center text-sm font-bold text-slate-400">{language === 'zh' ? '沒有符合條件的申請' : 'No applications found'}</div>
      ) : (
        <div className="overflow-x-auto rounded-[1.5rem] border border-white bg-white/50 shadow-sm backdrop-blur-xl">
          <table className="w-full min-w-[920px] text-left border-collapse">
            <thead><tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'zh' ? '使用者' : 'User'}</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'zh' ? '申請原因' : 'Reason'}</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'zh' ? '提交時間' : 'Submitted'}</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'zh' ? 'Admin' : 'Reviewer'}</th>
              <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'zh' ? '操作' : 'Actions'}</th>
            </tr></thead>
            <tbody>
              {visibleProfiles.map((profile) => (
                <tr key={profile.id} className="border-b border-slate-100/80 align-top transition-colors hover:bg-emerald-50/40">
                  <td className="px-4 py-4"><div className="font-black text-sm text-slate-800">{profile.username || 'Anonymous'}</div><div className="mt-1 text-[11px] text-slate-400">{profile.email}</div></td>
                  <td className="max-w-[300px] px-4 py-4 text-xs leading-relaxed text-slate-600"><div className="whitespace-pre-wrap">{profile.curator_application_reason || '—'}</div>{profile.curator_application_rejection_reason && <div className="mt-2 rounded-lg bg-rose-50 p-2 text-rose-700"><strong>{language === 'zh' ? '拒絕原因：' : 'Rejection: '}</strong>{profile.curator_application_rejection_reason}</div>}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-xs font-medium text-slate-500">{formatDate(profile.curator_application_submitted_at)}</td>
                  <td className="px-4 py-4"><span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black ${profile.curator_application_status === 'pending' ? 'bg-amber-50 text-amber-700' : profile.curator_application_status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{profile.curator_application_status === 'pending' ? <Clock3 className="w-3 h-3" /> : profile.curator_application_status === 'approved' ? <CheckCircle2 className="w-3 h-3" /> : <ShieldX className="w-3 h-3" />}{statusLabel(profile.curator_application_status)}</span></td>
                  <td className="px-4 py-4 text-xs text-slate-500">{profile.curator_application_reviewed_by ? reviewerNames.get(profile.curator_application_reviewed_by) || '—' : '—'}</td>
                  <td className="px-4 py-4 text-right">{profile.curator_application_status === 'pending' && <div className="flex justify-end gap-2"><button type="button" disabled={actionLoading === profile.id} onClick={() => approve(profile)} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-black text-white transition-colors hover:bg-emerald-700 cursor-pointer disabled:opacity-50"><Check className="w-3.5 h-3.5" />{language === 'zh' ? '批核' : 'Approve'}</button><button type="button" disabled={actionLoading === profile.id} onClick={() => { setRejectingProfile(profile); setRejectionReason(''); setError(null); }} className="inline-flex items-center gap-1 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[10px] font-black text-rose-600 transition-colors hover:bg-rose-100 cursor-pointer disabled:opacity-50"><ShieldX className="w-3.5 h-3.5" />{language === 'zh' ? '拒絕' : 'Reject'}</button></div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectingProfile && <div className="fixed inset-0 z-[230] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="reject-title"><button type="button" aria-label="Close" onClick={() => setRejectingProfile(null)} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm cursor-pointer" /><div className="relative w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 id="reject-title" className="text-lg font-black text-slate-900">{language === 'zh' ? '拒絕 Curator 申請' : 'Reject curator application'}</h2><p className="mt-1 text-xs text-slate-500">{rejectingProfile.username || 'Anonymous'}</p></div><button type="button" onClick={() => setRejectingProfile(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 cursor-pointer"><X className="w-5 h-5" /></button></div><label htmlFor="reject-reason" className="mt-5 block text-xs font-black text-slate-500">{language === 'zh' ? '拒絕原因（必填）' : 'Rejection reason (required)'}</label><textarea id="reject-reason" autoFocus maxLength={500} rows={5} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-500/10" /><div className="mt-1 text-right text-[10px] font-bold text-slate-400">{rejectionReason.length}/500</div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setRejectingProfile(null)} className="rounded-xl px-4 py-2.5 text-xs font-black text-slate-500 hover:bg-slate-100 cursor-pointer">{language === 'zh' ? '取消' : 'Cancel'}</button><button type="button" onClick={reject} disabled={actionLoading === rejectingProfile.id} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white hover:bg-rose-700 cursor-pointer disabled:opacity-50">{actionLoading === rejectingProfile.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{language === 'zh' ? '確認拒絕' : 'Confirm reject'}</button></div></div></div>}
    </div>
  );
}
