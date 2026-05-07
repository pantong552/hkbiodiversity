'use client';

import { motion } from 'framer-motion';
import { Megaphone, PlusCircle, ArrowRight, Calendar } from 'lucide-react';
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
    title: t('home.added_species') + (language === 'zh' ? (s.common_name_chi || s.scientific_name) : (s.common_name_eng || s.scientific_name)),
    date: new Date(s.created_at || Date.now()).toISOString().split('T')[0],
    type: 'new_species',
    link: `/database?species=${s.taxa_id}`,
    category: s.type === 'fauna' ? t('home.fauna') : t('home.flora')
  }));

  return (
    <section className="py-24 bg-slate-50">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16">
          
          {/* Announcements */}
          <div>
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500 rounded-2xl text-white shadow-lg shadow-blue-500/20">
                  <Megaphone className="w-6 h-6" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t('home.news_announcement')}</h2>
              </div>
              <Link 
                href="/news"
                className="text-sm font-bold text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1 group"
              >
                {t('home.view_more')} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="space-y-4">
              {announcements.map((item) => (
                <Link 
                  key={`ann-${item.id}`} 
                  href={item.link}
                  className="block p-6 bg-white rounded-[2rem] border border-slate-100 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-3 py-1 bg-blue-50 text-[10px] font-black text-blue-600 uppercase tracking-widest rounded-full">
                      {item.category}
                    </span>
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {item.date}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-800 group-hover:text-blue-700 transition-colors">
                    {item.title}
                  </h3>
                </Link>
              ))}
            </div>
          </div>

          {/* New Species */}
          <div>
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
                  <PlusCircle className="w-6 h-6" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t('home.news_new_species')}</h2>
              </div>
              <button className="text-sm font-bold text-slate-400 hover:text-emerald-600 transition-colors flex items-center gap-1 group">
                {t('home.enter_database')} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="space-y-4">
              {speciesNews.map((item) => (
                <Link 
                  key={`species-${item.id}`} 
                  href={item.link}
                  className="block p-6 bg-white rounded-[2rem] border border-slate-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-3 py-1 bg-emerald-50 text-[10px] font-black text-emerald-600 uppercase tracking-widest rounded-full">
                      {item.category}
                    </span>
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {item.date}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-800 group-hover:text-emerald-700 transition-colors">
                    {item.title}
                  </h3>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
