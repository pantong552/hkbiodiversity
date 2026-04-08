'use client';

import Image from 'next/image';
import { Heart } from 'lucide-react';
import { Species } from '../types/species';
import { useLanguage } from '../context/LanguageContext';

export default function SpeciesCard({ species }: { species: Species }) {
  const { language } = useLanguage();
  // Determine badge color based on rarity
  const rarityColors: Record<string, string> = {
    '極危': 'bg-rose-500 text-white border-rose-600',
    '瀕危': 'bg-orange-500 text-white border-orange-600',
    '易危': 'bg-amber-500 text-white border-amber-600',
    '常見': 'bg-emerald-500 text-white border-emerald-600',
    '近危': 'bg-indigo-500 text-white border-indigo-600',
  };
  const rarityClass = rarityColors[species.rarity] || 'bg-slate-500 text-white border-slate-600';

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
        
        {/* Rarity & Save Badges Overlay */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10">
          <span className={`
            px-3 py-1 rounded-2xl text-[11px] font-black uppercase tracking-widest backdrop-blur-md shadow-lg border
            ${rarityClass}
          `}>
            {language === 'zh' ? species.rarity : species.rarity_en}
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
          <p className="text-xs italic font-medium text-slate-400 font-serif tracking-wide">
            {species.scientific_name}
          </p>
        </div>

        {/* Taxonomy Tags - Refined to Order, Family */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {[species.order, species.family].map((tax, i) => (
            <span key={i} className="px-2.5 py-1 bg-slate-50 text-[11px] font-bold text-slate-500 rounded-lg border border-slate-100 group-hover:border-emerald-100 group-hover:bg-emerald-50/50 transition-all">
              {language === 'en' ? (tax.match(/\(([^)]+)\)/)?.[1] || tax.split(' ')[0]) : tax.split(' ')[0]}
            </span>
          ))}
        </div>

        {/* Action Footer */}
        <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
              {language === 'zh' ? species.conservation_status : species.conservation_status_en}
            </span>
          </div>
          <button className="text-emerald-600 font-black text-[11px] uppercase tracking-widest hover:translate-x-1 transition-transform cursor-pointer">
            Details →
          </button>
        </div>
      </div>
    </div>
  );
}
