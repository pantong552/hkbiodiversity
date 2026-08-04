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
    <section className="py-12 bg-white border-b border-slate-100">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8 gap-4 sm:gap-6">
          {stats.taxaStats.map((item, index) => {
            const Icon = iconMap[item.group] || iconMap.default;
            return (
              <motion.a
                key={item.group}
                href="/database"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                viewport={{ once: true }}
                className="group p-5 bg-slate-50/80 rounded-2xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer"
              >
                <div className="w-12 h-12 bg-white rounded-xl shadow-xs flex items-center justify-center mb-3 text-slate-400 group-hover:text-emerald-600 group-hover:scale-110 transition-all duration-300">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xs font-bold text-slate-700 group-hover:text-emerald-800 transition-colors line-clamp-1">
                  {t('taxa.' + item.group)}
                </h3>
              </motion.a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
