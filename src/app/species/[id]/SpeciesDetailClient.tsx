'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Species } from '@/types/species';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import SpeciesContent from '@/components/species/SpeciesContent';

export default function SpeciesDetailClient({ 
  id, 
  initialSpecies 
}: { 
  id: string;
  initialSpecies: Species | null;
}) {
  const { language } = useLanguage();
  const [species, setSpecies] = useState<Species | null>(initialSpecies);
  const [isLoading, setIsLoading] = useState(!initialSpecies);
  
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
