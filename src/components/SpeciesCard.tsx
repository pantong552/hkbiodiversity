'use client';

import Image from 'next/image';
import { Heart, ArrowRight } from 'lucide-react';
import { Species } from '../types/species';
import { useLanguage } from '../context/LanguageContext';
import { useSpeciesPanel } from '../context/SpeciesPanelContext';
import { getIUCNConfig } from '../constants/statusStyles';


export default function SpeciesCard({ species, mode = 'detail' }: { species: Species, mode?: 'detail' | 'photo' }) {
  const { language } = useLanguage();
  const { addSpecies } = useSpeciesPanel();
  
  const config = getIUCNConfig(species.iucn);
  const badgeClass = config.styles;
  const badgeText = language === 'zh' ? config.label.zh : config.label.en;

  const isPhoto = mode === 'photo';

  return (
    <div 
      onClick={() => addSpecies(species.id)}
      className={`
        group relative bg-white border border-slate-200/50 overflow-hidden shadow-card 
        hover:shadow-card-hover hover:-translate-y-2 transition-all duration-500 flex flex-col cursor-pointer
        ${isPhoto ? 'rounded-[1.5rem]' : 'rounded-[2.5rem]'}
      `}
    >
      {/* Image Container with Overlay */}
      <div className={`relative overflow-hidden bg-slate-100 ${isPhoto ? 'h-52' : 'h-60'}`}>
        <Image
          src={species.image_url || 'https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?q=80&w=1080&auto=format&fit=crop'}
          alt={(language === 'zh' ? species.common_name_chi : species.common_name_eng) || species.scientific_name || 'Species Image'}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Overlays */}
        <div className={`absolute left-4 right-4 flex justify-between items-start z-10 ${isPhoto ? 'top-3' : 'top-4'}`}>
          {!isPhoto && (
            <span className={`
              px-3 py-1 rounded-2xl text-[11px] font-black uppercase tracking-widest backdrop-blur-md shadow-lg border
              ${badgeClass}
            `}>
              {badgeText}
            </span>
          )}
          {isPhoto && <div />} {/* Spacer if no badge */}
          
          <button 
            onClick={(e) => { e.stopPropagation(); /* 收藏邏輯預留 */ }}
            className={`
              bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-white/50 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-white transition-all cursor-pointer
              ${isPhoto ? 'w-7 h-7' : 'w-8 h-8 md:w-10 md:h-10'}
            `}
          >
            <Heart className={isPhoto ? 'w-3.5 h-3.5' : 'w-4 h-4 md:w-5 h-5'} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className={`${isPhoto ? 'p-4' : 'p-6'} flex-1 flex flex-col`}>
        <div className={isPhoto ? 'mb-0' : 'mb-4'}>
          <h3 className={`font-black text-slate-900 mb-0.5 group-hover:text-emerald-600 transition-colors leading-tight ${isPhoto ? 'text-base line-clamp-1' : 'text-xl'}`}>
            {language === 'zh' ? species.common_name_chi : species.common_name_eng}
          </h3>
          <p className="text-xs text-slate-500 font-serif tracking-wide truncate">
            <span className="italic font-medium">{species.scientific_name}</span>
          </p>
        </div>

        {!isPhoto && (
          <>
            {/* Taxonomy Tags */}
            <div className="flex flex-wrap gap-1.5 mb-6">
              {[
                language === 'zh' ? species.order_chi : species.order_eng, 
                language === 'zh' ? species.family_chi : species.family_eng
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
                  {language === 'zh' ? species.informal_group_chi : species.informal_group_eng}
                </span>
              </div>
              <div className="flex items-center gap-1 text-emerald-600 font-black text-[11px] uppercase tracking-widest hover:translate-x-1 transition-transform">
                Details <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
