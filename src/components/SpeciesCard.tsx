'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { Species } from '../types/species';
import { useLanguage } from '../context/LanguageContext';

export default function SpeciesCard({ species }: { species: Species }) {
  const { language } = useLanguage();
  
  // Standard IUCN Categories and corresponding styles
  const iucnStyles: Record<string, { color: string, zh: string }> = {
    'Least Concern': { color: 'bg-emerald-500 border-emerald-600', zh: '無危' },
    'Near Threatened': { color: 'bg-amber-400 border-amber-500 text-amber-950', zh: '近危' },
    'Vulnerable': { color: 'bg-orange-500 border-orange-600', zh: '易危' },
    'Endangered': { color: 'bg-rose-500 border-rose-600', zh: '瀕危' },
    'Critically Endangered': { color: 'bg-red-600 border-red-700', zh: '極危' },
    'Data Deficient': { color: 'bg-slate-400 border-slate-500', zh: '數據缺乏' },
    'Not Evaluated': { color: 'bg-slate-300 border-slate-400 text-slate-700', zh: '未評估' },
  };

  const statusObj = iucnStyles[species.iucn] || { color: 'bg-slate-500 border-slate-600', zh: species.iucn };
  const badgeClass = statusObj.color.includes('text-') ? statusObj.color : `${statusObj.color} text-white`;
  const badgeText = language === 'zh' ? statusObj.zh : species.iucn;

  return (
    <div className="group relative bg-white rounded-[2.5rem] border border-slate-200/50 overflow-hidden shadow-card hover:shadow-card-hover hover:-translate-y-2 transition-all duration-500 flex flex-col">
      {/* Image Container with Overlay */}
      <div className="relative h-60 overflow-hidden bg-slate-100">
        <Image
          src={species.image_url}
          alt={language === 'zh' ? species.common_name : species.common_name_en}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* IUCN Badge Overlay */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10">
          <span className={`
            px-3 py-1 rounded-2xl text-[11px] font-black uppercase tracking-widest backdrop-blur-md shadow-lg border
            ${badgeClass}
          `}>
            {badgeText}
          </span>
          <button className="w-8 h-8 md:w-10 md:h-10 bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-white/50 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-white transition-all cursor-pointer">
            <Heart className="w-4 h-4 md:w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6 flex-1 flex flex-col">
        <div className="mb-4">
          <h3 className="text-xl font-black text-slate-900 mb-0.5 group-hover:text-emerald-600 transition-colors leading-tight">
            {language === 'zh' ? species.common_name : species.common_name_en}
          </h3>
          <p className="text-xs text-slate-500 font-serif tracking-wide truncate">
            <span className="italic font-medium">{species.scientific_name}</span> {species.author}
          </p>
        </div>

        {/* Taxonomy Tags */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {[
            language === 'zh' ? species.order_chi : species.order, 
            language === 'zh' ? species.family_chi : species.family
          ].map((tax, i) => (
            <span key={i} className="px-2.5 py-1 bg-slate-50 text-[11px] font-bold text-slate-500 rounded-lg border border-slate-100 group-hover:border-emerald-100 group-hover:bg-emerald-50/50 transition-all">
              {tax}
            </span>
          ))}
        </div>

        {/* Action Footer */}
        <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              {language === 'zh' ? species.informal_group_chi : species.informal_group}
            </span>
          </div>
          <Link href={`/species/${species.slug || species.id}`} className="flex items-center text-emerald-600 font-black text-[11px] uppercase tracking-widest hover:translate-x-1 transition-transform cursor-pointer">
            Details →
          </Link>
        </div>
      </div>
    </div>
  );
}
