'use client';

import { useState, useEffect, use } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Species } from '@/types/species';
import { ArrowLeft, Map, ExternalLink, Bookmark, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function SpeciesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { language } = useLanguage();
  const [species, setSpecies] = useState<Species | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const unwrappedParams = use(params);
  
  useEffect(() => {
    async function fetchSpeciesDetail() {
      if (!unwrappedParams.id) return;
      
      setIsLoading(true);
      try {
        console.log('正在根據 ID 抓取物種詳情:', unwrappedParams.id);
        const { data, error } = await supabase
          .from('species')
          .select('*')
          .eq('id', unwrappedParams.id)
          .maybeSingle();

        if (error) {
          console.error('Supabase 詳情查詢失敗:', error);
          throw error;
        }
        if (data) {
          console.log('物種詳情載入成功:', data.common_name_chi);
          setSpecies(data as Species);
        } else {
          console.warn('未找到與此 ID 匹配的物種');
        }
      } catch (err: any) {
        console.error('fetchSpeciesDetail 發生錯誤:', err.message || err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSpeciesDetail();
  }, [unwrappedParams.id]);

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

  // Formatting strings
  const commonName = language === 'zh' ? species.common_name_chi : species.common_name_eng;
  const phylum = language === 'zh' ? species.phylum_chi : species.phylum_eng;
  const classTax = language === 'zh' ? species.class_chi : species.class_eng;
  const order = language === 'zh' ? species.order_chi : species.order_eng;
  const family = language === 'zh' ? species.family_chi : species.family_eng;
  
  const description = language === 'zh' ? species.description_chi : species.description_eng;
  const remarks = language === 'zh' ? species.remarks_chi : species.remarks_eng;
  const hkDist = language === 'zh' ? species.hk_distribution_chi : species.hk_distribution_eng;
  const globalDist = language === 'zh' ? species.global_distribution_chi : species.global_distribution_eng;
  const refs = language === 'zh' ? species.references_chi : species.references_eng;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Bar / Breadcrumb area */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-emerald-600 font-bold hover:text-emerald-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            {language === 'zh' ? '返回圖鑑' : 'Back to Directory'}
          </Link>
        </div>
      </div>

      <SpeciesContent species={species} showBreadcrumb={true} />
    </div>
  );
}

function StatusRow({ label, value, isPrimary = false }: { label: string, value?: string, isPrimary?: boolean }) {
  if (!value) return null;
  
  return (
    <div className="flex flex-col">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{label}</span>
      <span className={`
        text-sm font-semibold
        ${isPrimary ? 'px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 inline-block w-fit' : 'text-slate-700'}
      `}>
        {value}
      </span>
    </div>
  );
}
