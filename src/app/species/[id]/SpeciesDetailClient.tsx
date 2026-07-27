'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Species } from '@/types/species';
import { SpeciesDraft } from '@/types/speciesDraft';
import { ArrowLeft, Loader2, Share2, Check, Sliders } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';
import SpeciesContent from '@/components/species/SpeciesContent';
import SpeciesEditModal from '@/components/species/SpeciesEditModal';
import AdminDraftReviewBanner from '@/components/species/AdminDraftReviewBanner';
import { useShare } from '@/hooks/useShare';

export default function SpeciesDetailClient({ 
  id, 
  initialSpecies 
}: { 
  id: string;
  initialSpecies: Species | null;
}) {
  const { language } = useLanguage();
  const { user, profile } = useAuth();
  const { isEditModalOpen, setIsEditModalOpen } = useSpeciesPanel();
  const [species, setSpecies] = useState<Species | null>(initialSpecies);
  const [isLoading, setIsLoading] = useState(!initialSpecies);
  const [reviewDraft, setReviewDraft] = useState<SpeciesDraft | null>(null);
  const { share, isCopied } = useShare();

  const isCanEdit = profile?.role === 'admin' || profile?.role === 'curator';

  const handleShare = () => {
    if (!species) return;
    const commonName = language === 'zh' ? species.common_name_chi : species.common_name_eng;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${baseUrl}/?species=${species.id}`;

    share({
      title: `${commonName} | HK Biodiversity`,
      text: `在香港生物多樣性圖鑑查看 ${commonName} (${species.scientific_name}) 的詳細資料`,
      url: shareUrl
    });
  };

  const [refreshKey, setRefreshKey] = useState(0);

  // 全面重新整理物種數據與草稿狀態 (用於 Admin Approve / Reject 及 Curator 提交草稿後自動更新)
  const reloadSpeciesAndDrafts = async () => {
    if (!species) return;
    const isPlant = species.taxa_group === 'FLORA' || (species as any).category_chi || String(species.taxa_id || '').startsWith('flora_');
    const targetTable = isPlant ? 'plant_species' : 'species';
    
    let query = supabase.from(targetTable).select('*');
    if (species.id) {
      query = query.eq('id', species.id);
    } else if (species.taxa_id) {
      query = query.eq('taxa_id', species.taxa_id);
    }
    const { data: updatedSpecies } = await query.maybeSingle();

    if (updatedSpecies) {
      setSpecies(updatedSpecies as Species);
    }
    setRefreshKey(prev => prev + 1);
  };

  const handleApproveDraft = async (draft: SpeciesDraft) => {
    if (!species || !user) return;
    const isPlant = species.taxa_group === 'FLORA' || (species as any).category_chi || String(species.taxa_id || '').startsWith('flora_');
    const targetTable = isPlant ? 'plant_species' : 'species';

    // 1. 更新正式物種表
    let query = supabase.from(targetTable).update(draft.draft_data);
    if (species.id) {
      query = query.eq('id', species.id);
    } else if (species.taxa_id) {
      query = query.eq('taxa_id', species.taxa_id);
    }
    const { error: updateError } = await query;
    if (updateError) throw updateError;

    // 2. 更新 species_drafts 狀態為 approved
    const { error: draftError } = await supabase
      .from('species_drafts')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_by_name: profile?.username || user.email?.split('@')[0],
        approved_at: new Date().toISOString()
      })
      .eq('id', draft.id);

    if (draftError) throw draftError;

    setReviewDraft(null);
    await reloadSpeciesAndDrafts();
  };

  const handleRejectDraft = async (draft: SpeciesDraft, reason: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('species_drafts')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        approved_by: user.id,
        approved_by_name: profile?.username || user.email?.split('@')[0],
        approved_at: new Date().toISOString()
      })
      .eq('id', draft.id);

    if (error) throw error;

    setReviewDraft(null);
    await reloadSpeciesAndDrafts();
  };

  useEffect(() => {
    async function fetchSpeciesDetail() {
      if (initialSpecies) return;
      if (!id) return;
      
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('species')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setSpecies(data as Species);
        }
      } catch (err: any) {
        console.error('fetchSpeciesDetail 發生錯誤:', err.message || err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSpeciesDetail();
  }, [id, initialSpecies]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-500 font-medium tracking-wide">
          {language === 'zh' ? '正在載入物種詳細資料...' : 'Loading species details...'}
        </p>
      </div>
    );
  }

  if (!species) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-slate-300">
          <ArrowLeft className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">
          {language === 'zh' ? '找不到該物種' : 'Species Not Found'}
        </h2>
        <p className="text-slate-500 mb-8 max-w-xs">
          {language === 'zh' ? '抱歉，我們無法找到您要查看的生物資料。' : "Sorry, we couldn't find the species information you are looking for."}
        </p>
        <Link href="/" className="px-8 py-3 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-200 hover:-translate-y-1 transition-all">
          {language === 'zh' ? '返回目錄' : 'Back to Directory'}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 relative">
      {/* Toast Notification */}
      <div className={`
        fixed top-20 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 pointer-events-none
        ${isCopied ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
      `}>
        <div className="bg-slate-900/90 backdrop-blur-xl text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Check className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold tracking-wide">
            {language === 'zh' ? '連結已複製到剪貼簿' : 'Link copied to clipboard'}
          </span>
        </div>
      </div>

      {/* Admin Draft Review Banner if there's pending curator edit */}
      {species && (
        <AdminDraftReviewBanner
          key={`review-banner-${refreshKey}`}
          speciesId={String(species.id || species.taxa_id || '')}
          tableName="species"
          onApproved={reloadSpeciesAndDrafts}
          refreshTrigger={refreshKey}
          onOpenReviewModal={(draft) => {
            setReviewDraft(draft);
            setIsEditModalOpen(true);
          }}
        />
      )}

      {/* Navigation Bar / Breadcrumb area */}
      <div className={`sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-slate-200/60 px-6 py-4 ${isEditModalOpen ? 'hidden' : ''}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="group inline-flex items-center gap-2 text-slate-600 font-bold hover:text-emerald-600 transition-all duration-300">
            <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-emerald-50 flex items-center justify-center transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span className="hidden sm:inline">{language === 'zh' ? '返回圖鑑' : 'Back to Directory'}</span>
          </Link>

          <div className="flex items-center gap-3">
            {/* EDIT SPECIES DETAIL Button for Admin / Curator */}
            {isCanEdit && species && (
              <button
                onClick={() => {
                  setReviewDraft(null);
                  setIsEditModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-200 hover:shadow-emerald-300 hover:-translate-y-0.5 active:scale-95 transition-all duration-300 cursor-pointer"
              >
                <Sliders className="w-4 h-4" />
                <span>{language === 'zh' ? '編輯物種詳情' : 'EDIT SPECIES DETAIL'}</span>
              </button>
            )}

            <button 
              onClick={handleShare}
              className="inline-flex items-center gap-2.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-sm shadow-md hover:-translate-y-0.5 active:scale-95 transition-all duration-300 group cursor-pointer"
            >
              <Share2 className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              <span>{language === 'zh' ? '分享此物種' : 'Share Species'}</span>
            </button>
          </div>
        </div>
      </div>

      <SpeciesContent key={`content-${refreshKey}`} species={species} showBreadcrumb={true} refreshTrigger={refreshKey} />

      {/* Edit Species Detail Modal */}
      {species && isCanEdit && (
        <SpeciesEditModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setReviewDraft(null);
          }}
          species={species}
          tableName="species"
          reviewDraft={reviewDraft}
          onApproveDraft={handleApproveDraft}
          onRejectDraft={handleRejectDraft}
          onSuccess={reloadSpeciesAndDrafts}
        />
      )}
    </div>
  );
}
