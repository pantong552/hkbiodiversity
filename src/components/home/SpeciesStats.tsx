'use client';

import { motion } from 'framer-motion';
import { HomeStats } from '@/lib/home';
import { Bird, Bug, Waves, Trees, Turtle, Info } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface SpeciesStatsProps {
  stats: HomeStats;
}

const iconMap: Record<string, any> = {
  'Birds': Bird,
  'Butterflies': Bug,
  'Odonates': Bug,
  'Reptiles': Turtle,
  'Amphibians': Turtle,
  'Fish': Waves,
  'Plants': Trees,
  'Flora': Trees,
  'Mammals': Bird, // 暫代，之後可換
  'Ants': Bug,
  'Beetles': Bug,
  'Freshwater Fish': Waves,
  'Marine Fish': Waves,
  'default': Info
};

export default function SpeciesStats({ stats }: SpeciesStatsProps) {
  const { t } = useLanguage();

  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-8">
          <div>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter mb-4">
              {t('home.stats_title_part1')} <span className="text-emerald-600">{t('home.stats_title_part2')}</span>
            </h2>
            <p className="text-slate-500 font-medium max-w-xl">
              {t('home.stats_desc')
                .replace('{total}', stats.totalCount.toLocaleString())
                .replace('{fauna}', stats.faunaCount.toLocaleString())
                .replace('{flora}', stats.floraCount.toLocaleString())
              }
            </p>
          </div>
          
          <div className="bg-slate-50 px-8 py-6 rounded-[2.5rem] border border-slate-100 flex items-center gap-10">
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('home.total_taxa')}</p>
              <p className="text-4xl font-black text-slate-900">{stats.totalCount.toLocaleString()}</p>
            </div>
            <div className="w-px h-10 bg-slate-200" />
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('home.flora')}</p>
              <p className="text-4xl font-black text-emerald-600">{stats.floraCount.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-6">
          {stats.taxaStats.map((item, index) => {
            const Icon = iconMap[item.group] || iconMap.default;
            return (
              <motion.div
                key={item.group}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="group p-6 bg-slate-50 rounded-[2rem] border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all duration-500 text-center"
              >
                <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 text-slate-400 group-hover:text-emerald-500 group-hover:scale-110 transition-all duration-500">
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 group-hover:text-emerald-700 transition-colors line-clamp-1">
                  {t('taxa.' + item.group)}
                </h3>
                <p className="text-2xl font-black text-slate-900">
                  {item.count.toLocaleString()}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
