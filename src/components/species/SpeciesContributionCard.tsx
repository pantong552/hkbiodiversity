'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { SpeciesDraft } from '@/types/speciesDraft';
import { 
  Award, 
  UserCircle, 
  ShieldCheck, 
  Calendar, 
  Clock, 
  Sparkles, 
  History,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { zhTW, enUS } from 'date-fns/locale';

interface SpeciesContributionCardProps {
  speciesId: string;
}

export default function SpeciesContributionCard({ speciesId }: SpeciesContributionCardProps) {
  const { language } = useLanguage();
  const supabase = createClient();

  const [approvedRevisions, setApprovedRevisions] = useState<SpeciesDraft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!speciesId) {
      setLoading(false);
      return;
    }

    async function fetchApprovedRevisions() {
      try {
        const { data, error } = await supabase
          .from('species_drafts')
          .select('*')
          .eq('species_id', speciesId)
          .eq('status', 'approved')
          .order('approved_at', { ascending: true });

        if (!error && data) {
          setApprovedRevisions(data as SpeciesDraft[]);
        }
      } catch (err) {
        console.error('Error fetching approved revisions:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchApprovedRevisions();
  }, [speciesId]);

  if (loading || approvedRevisions.length === 0) {
    return null;
  }

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'yyyy/MM/dd HH:mm', {
        locale: language === 'zh' ? zhTW : enUS
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <section className="bg-gradient-to-br from-white via-slate-50/50 to-emerald-50/30 rounded-[2.5rem] p-6 md:p-8 border border-emerald-100/80 shadow-sm relative overflow-hidden my-8">
      {/* Background Decorative Sparkles */}
      <div className="absolute top-0 right-0 p-8 text-emerald-500/5 pointer-events-none">
        <Award className="w-36 h-36" />
      </div>

      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shadow-sm">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-lg md:text-xl flex items-center gap-2">
                <span>{language === 'zh' ? '特約館員修訂與貢獻表揚' : 'Curator Contributions & Revision History'}</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full">
                  {approvedRevisions.length} {language === 'zh' ? '修訂版本' : 'Revisions'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {language === 'zh' ? '感謝專業生態館員與管理審核團隊對本物種資料的編修貢獻' : 'Recognizing curators and admins for improving species documentation.'}
              </p>
            </div>
          </div>
        </div>

        {/* Revisions Grid / Timeline */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {approvedRevisions.map((draft, idx) => (
            <div
              key={draft.id}
              className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-slate-100 shadow-xs hover:shadow-md transition-all duration-300 flex items-start justify-between gap-3 group"
            >
              <div className="flex items-start gap-3 min-w-0">
                {/* Curator Avatar */}
                <div className="w-10 h-10 rounded-full overflow-hidden border border-emerald-200 bg-slate-100 shrink-0 shadow-inner mt-0.5">
                  {draft.curator_avatar ? (
                    <img src={draft.curator_avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle className="w-full h-full p-1 text-slate-300" />
                  )}
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md ring-1 ring-emerald-100">
                      v{idx + 1}.0
                    </span>
                    <h4 className="font-black text-slate-800 text-sm truncate">
                      {draft.curator_name || (language === 'zh' ? '熱心館員' : 'Curator')}
                    </h4>
                  </div>

                  {/* Submission & Approval Dates */}
                  <div className="text-[11px] text-slate-500 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{language === 'zh' ? '提交：' : 'Submitted: '}</span>
                      <span className="font-bold">{formatDate(draft.submitted_at)}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span>{language === 'zh' ? '通過：' : 'Approved: '}</span>
                      <span className="font-bold">{formatDate(draft.approved_at)}</span>
                      {draft.approved_by_name && (
                        <span className="text-[10px] text-slate-400 italic">({draft.approved_by_name})</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 pt-1">
                <span className="p-2 rounded-xl bg-slate-50 text-slate-300 group-hover:text-emerald-500 group-hover:bg-emerald-50 transition-colors inline-block">
                  <History className="w-4 h-4" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
