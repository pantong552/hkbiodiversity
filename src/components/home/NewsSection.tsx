'use client';

import { motion } from 'framer-motion';
import { Megaphone, Sparkles, ArrowRight, Calendar, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

interface NewsItem {
  id: string | number;
  title: string;
  date: string;
  type: 'announcement' | 'new_species';
  link: string;
  category?: string;
}

interface NewsSectionProps {
  latestSpecies: any[];
  news: any[];
}

export default function NewsSection({ latestSpecies, news }: NewsSectionProps) {
  const { language, t } = useLanguage();

  const announcements: NewsItem[] = news.map(n => ({
    id: n.id,
    title: language === 'zh' ? n.title_chi : n.title_eng,
    date: new Date(n.published_at).toISOString().split('T')[0],
    type: 'announcement',
    link: `/news?id=${n.id}`,
    category: language === 'zh' ? (
      n.category === 'System' ? '系統維護' :
      n.category === 'Community' ? '社群消息' :
      n.category === 'Taxonomy' ? '物種更新' :
      n.category === 'Notice' ? '公告' :
      n.category === 'Sales' ? '商品消息' : n.category
    ) : n.category
  }));

  const speciesNews: NewsItem[] = latestSpecies.map(s => ({
    id: s.taxa_id,
    title: (language === 'zh' ? (s.common_name_chi || s.scientific_name) : (s.common_name_eng || s.scientific_name)),
    date: new Date(s.created_at || Date.now()).toISOString().split('T')[0],
    type: 'new_species',
    link: `/database?species=${s.taxa_id}`,
    category: s.type === 'fauna' ? t('home.fauna') : t('home.flora')
  }));

  const getCategoryStyles = (cat: string | undefined, type: string) => {
    if (type === 'new_species') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    }
    const mapping: any = {
      'System': 'bg-slate-100 text-slate-600 border-slate-200',
      '系統維護': 'bg-slate-100 text-slate-600 border-slate-200',
      'Community': 'bg-blue-50 text-blue-700 border-blue-100',
      '社群消息': 'bg-blue-50 text-blue-700 border-blue-100',
      'Taxonomy': 'bg-amber-50 text-amber-700 border-amber-100',
      '物種更新': 'bg-amber-50 text-amber-700 border-amber-100',
      'Notice': 'bg-indigo-50 text-indigo-700 border-indigo-100',
      '公告': 'bg-indigo-50 text-indigo-700 border-indigo-100'
    };
    return mapping[cat || ''] || 'bg-slate-50 text-slate-500 border-slate-100';
  };

  return (
    <section className="py-24 bg-[#fcfdfd]">
      <div className="container mx-auto px-4 md:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          
          {/* Announcements */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-900/10">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{t('home.news_announcement')}</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">Announcements</p>
                </div>
              </div>
              <Link 
                href="/news"
                className="text-xs font-black text-slate-400 hover:text-slate-900 transition-colors flex items-center gap-1.5 uppercase tracking-widest group"
              >
                {t('home.view_more')} <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="space-y-3">
              {announcements.map((item) => (
                <Link 
                  key={`ann-${item.id}`} 
                  href={item.link}
                  className="flex items-center gap-4 p-3.5 bg-white rounded-2xl border border-slate-200/60 hover:border-slate-900/20 hover:shadow-xl hover:shadow-slate-900/5 transition-all duration-300 group overflow-hidden box-border"
                >
                   <div className="hidden md:flex flex-col items-center justify-center w-12 h-12 bg-slate-50 rounded-xl border border-slate-100 group-hover:bg-slate-900 group-hover:border-slate-900 transition-colors shrink-0">
                    <span className="text-[9px] font-black text-slate-400 group-hover:text-slate-300 uppercase tracking-tighter leading-none">
                      {new Date(item.date).toLocaleString('en-US', { month: 'short' })}
                    </span>
                    <span className="text-lg font-black text-slate-700 group-hover:text-white leading-none mt-0.5">
                      {new Date(item.date).getDate()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${getCategoryStyles(item.category, 'announcement')}`}>
                        {item.category}
                      </span>
                      <span className="md:hidden text-[10px] font-bold text-slate-400">
                        {item.date}
                      </span>
                    </div>
                    <h3 className="text-sm md:text-base font-black text-slate-800 group-hover:text-slate-900 transition-colors truncate">
                      {item.title}
                    </h3>
                  </div>
                  
                  <div className="shrink-0 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-slate-900 group-hover:text-white transition-all transform group-hover:translate-x-1">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* New Species */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-600/10">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{t('home.news_new_species')}</h2>
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] mt-0.5">Latest Discoveries</p>
                </div>
              </div>
              <Link 
                href="/database"
                className="text-xs font-black text-slate-400 hover:text-emerald-600 transition-colors flex items-center gap-1.5 uppercase tracking-widest group"
              >
                {t('home.enter_database')} <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="space-y-3">
              {speciesNews.map((item) => (
                <Link 
                  key={`species-${item.id}`} 
                  href={item.link}
                  className="flex items-center gap-4 p-3.5 bg-white rounded-2xl border border-slate-200/60 hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300 group overflow-hidden box-border"
                >
                  <div className="hidden md:flex flex-col items-center justify-center w-12 h-12 bg-emerald-50 rounded-xl border border-emerald-100 group-hover:bg-emerald-600 group-hover:border-emerald-600 transition-colors shrink-0">
                    <span className="text-[9px] font-black text-emerald-400 group-hover:text-emerald-100 uppercase tracking-tighter leading-none">
                      {new Date(item.date).toLocaleString('en-US', { month: 'short' })}
                    </span>
                    <span className="text-lg font-black text-emerald-700 group-hover:text-white leading-none mt-0.5">
                      {new Date(item.date).getDate()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${getCategoryStyles(item.category, 'new_species')}`}>
                        {item.category}
                      </span>
                      <span className="md:hidden text-[10px] font-bold text-slate-400">
                        {item.date}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">{t('home.added_species')}</span>
                      <h3 className="text-sm md:text-base font-black text-slate-800 group-hover:text-emerald-700 transition-colors truncate">
                        {item.title}
                      </h3>
                    </div>
                  </div>

                  <div className="shrink-0 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-emerald-600 group-hover:text-white transition-all transform group-hover:translate-x-1">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
