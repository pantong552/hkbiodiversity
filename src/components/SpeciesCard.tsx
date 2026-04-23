'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { Heart, Info, ExternalLink, Leaf, Loader2, X, Calendar } from 'lucide-react';
import { Species } from '../types/species';
import { PlantSpecies } from '../types/plants';
import { useLanguage } from '../context/LanguageContext';
import { useSpeciesPanel } from '../context/SpeciesPanelContext';
import { useAuth } from '../context/AuthContext';
import { useInaturalistPhoto } from '../hooks/useInaturalistPhoto';
import { getIUCNConfig } from '../constants/statusStyles';
import { supabase as supabaseSingleton } from '@/lib/supabase';
import { createPortal } from 'react-dom';
import { formatScientificName } from '../utils/formatters';

interface SpeciesCardProps {
  species: any; // Species | PlantSpecies
  isPlant?: boolean;
  mode?: 'detail' | 'photo';
  priority?: boolean;
}

export default function SpeciesCard({ 
  species, 
  isPlant = false,
  mode = 'detail',
  priority = false 
}: SpeciesCardProps) {
  const { language } = useLanguage();
  const { addSpecies } = useSpeciesPanel();
  const { user } = useAuth();
  
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Normalize data for consistent rendering
  const normalized = useMemo(() => {
    if (isPlant) {
      const p = species as PlantSpecies;
      return {
        id: p.id,
        species_id: p.species_id,
        common_name_chi: p.common_name_zh,
        common_name_eng: p.common_name_en,
        scientific_name: p.scientific_name,
        author: p.author,
        taxa_group: p.category_zh,
        order: null, // Plants don't typically display order in this UI
        family: p.family_zh,
        iucn: null, 
        image_url: null, 
        origin: p.origin,
        months: p.flowering_months?.length > 0 ? p.flowering_months : p.fruiting_months
      };
    } else {
      const s = species as Species;
      return {
        id: s.id,
        species_id: s.species_id,
        common_name_chi: s.common_name_chi,
        common_name_eng: s.common_name_eng,
        scientific_name: s.scientific_name,
        author: s.author,
        taxa_group: language === 'zh' ? s.informal_group_chi : s.informal_group_eng,
        order: language === 'zh' ? s.order_chi : s.order_eng,
        family: language === 'zh' ? s.family_chi : s.family_eng,
        iucn: s.iucn,
        image_url: s.image_url,
        origin: null,
        months: null
      };
    }
  }, [species, isPlant, language]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Check bookmark status
  useEffect(() => {
    let isMounted = true;
    const checkBookmark = async () => {
      if (!user || !normalized.id) {
        if (isMounted) setIsBookmarked(false);
        return;
      }
      try {
        const { data } = await supabaseSingleton
          .from('user_favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq(isPlant ? 'plant_id' : 'species_id', normalized.id)
          .maybeSingle();
        if (isMounted) setIsBookmarked(!!data);
      } catch (err) {
        console.error('Bookmark error:', err);
      }
    };
    checkBookmark();
    return () => { isMounted = false; };
  }, [user?.id, normalized.id, isPlant]);

  const toggleFavorite = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { alert(language === 'zh' ? '請先登入' : 'Login required'); return; }
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      if (isBookmarked) {
        await supabaseSingleton.from('user_favorites').delete().eq('user_id', user.id).eq(isPlant ? 'plant_id' : 'species_id', normalized.id);
        setIsBookmarked(false);
      } else {
        await supabaseSingleton.from('user_favorites').insert({ user_id: user.id, [isPlant ? 'plant_id' : 'species_id']: normalized.id });
        setIsBookmarked(true);
      }
    } catch (err) { console.error('Favorite error:', err); } finally { setIsUpdating(false); }
  }, [user, normalized.id, isBookmarked, isUpdating, language, isPlant]);

  const { imageUrl: inatPhoto, isLoading: isInatLoading, attribution, nativePageUrl } = useInaturalistPhoto(
    !normalized.image_url ? normalized.species_id : undefined
  );

  const displayImage = normalized.image_url || inatPhoto || 'https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?q=80&w=1080&auto=format&fit=crop';
  
  const iucnConfig = !isPlant && normalized.iucn ? getIUCNConfig(normalized.iucn) : null;
  const isPhoto = mode === 'photo';

  const toggleTooltip = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTooltip(!showTooltip);
  };

  return (
    <div 
      onClick={() => addSpecies(normalized.species_id)} 
      className={`
        group relative bg-white border border-slate-200/50 overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.06)]
        hover:shadow-[0_10px_30px_rgba(0,0,0,0.12)] hover:-translate-y-1.5 transition-all duration-500 flex flex-col cursor-pointer
        ${isPhoto ? 'rounded-2xl' : 'rounded-[1.5rem]'}
      `}
    >
      {/* Image Container with Overlay */}
      <div className={`relative overflow-hidden bg-slate-100 ${isPhoto ? 'h-40 sm:h-48' : 'h-48'}`}>
        <Image
          src={displayImage}
          alt={normalized.common_name_chi || normalized.scientific_name || 'Species Image'}
          fill
          priority={priority}
          unoptimized={displayImage.includes('/api/image/transform')}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          className={`object-cover transition-all duration-700 group-hover:scale-110 ${isInatLoading ? 'blur-sm grayscale' : 'blur-0 grayscale-0'}`}
        />
        
        {/* Bottom Title Overlay for Detail Mode */}
        {!isPhoto && (
          <div className="absolute inset-x-0 bottom-0 p-4 pt-12 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10">
            <h3 className="text-white text-xl font-black tracking-tight leading-tight drop-shadow-md">
              {language === 'zh' ? normalized.common_name_chi : normalized.common_name_eng}
            </h3>
            <p className="text-white/80 text-xs drop-shadow-sm font-serif mt-1">
              {formatScientificName(normalized.scientific_name)}
            </p>
          </div>
        )}

        {/* Top Overlay Controls */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-20 pointer-events-none">
          {/* Badges - left side */}
          <div className="flex flex-col gap-1.5">
            {!isPhoto && iucnConfig && (
              <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-lg border pointer-events-auto ${iucnConfig.styles}`}>
                {language === 'zh' ? iucnConfig.label.zh : iucnConfig.label.en}
              </span>
            )}
            {isPlant && normalized.origin && (
              <span className={`
                px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1.5 pointer-events-auto w-max
                ${(normalized.origin.toLowerCase() === 'native' || normalized.origin === '原生')
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-indigo-500 text-white'}
              `}>
                <Leaf className="w-3 h-3" /> 
                {language === 'zh' 
                  ? (normalized.origin.toLowerCase() === 'native' || normalized.origin === '原生' ? '原生' : '外來')
                  : (normalized.origin.toLowerCase() === 'native' || normalized.origin === '原生' ? 'Native' : 'Exotic')
                }
              </span>
            )}
          </div>

          {/* Action Buttons - right side */}
          <div className="flex flex-col gap-2 items-end pointer-events-auto ml-auto">
            {/* Heart Button */}
            {!isPhoto && (
              <button 
                onClick={toggleFavorite}
                disabled={isUpdating}
                className={`
                  w-7 h-7 rounded-full backdrop-blur-md border flex items-center justify-center transition-all cursor-pointer
                  ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}
                  ${isBookmarked 
                    ? 'text-rose-500 border-rose-200 bg-rose-50/90 shadow-sm' 
                    : 'text-white/90 border-white/20 bg-black/20 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 shadow-sm'
                  }
                `}
              >
                {isUpdating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Heart className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
                )}
              </button>
            )}
            
            {/* attribution tooltip */}
            {attribution && (
              <div className="group/info relative">
                {/* Info Button Trigger */}
                <button 
                  onClick={toggleTooltip}
                  className="w-7 h-7 bg-black/20 hover:bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-white/80 hover:text-white transition-all duration-300 cursor-help flex items-center justify-center"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                
                {/* Desktop Tooltip (Stay Local) */}
                <div className={`
                  hidden md:block absolute top-0 right-full mr-3 w-max min-w-[140px] max-w-[calc(180px)] bg-slate-900/95 backdrop-blur-xl p-3 rounded-xl shadow-2xl border border-white/10 opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all duration-300 translate-x-2 group-hover/info:translate-x-0 z-30
                `}>
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
                    <div className="relative w-4 h-4">
                      <Image 
                        src="/INaturalist_logo.svg" 
                        alt="iNaturalist" 
                        fill
                        className="object-contain"
                      />
                    </div>
                    <span className="text-[10px] text-white/50 uppercase font-black tracking-widest">iNaturalist</span>
                  </div>

                  <div className="space-y-2.5">
                    <p className="text-[11px] text-white font-bold leading-snug break-words">
                      © {attribution}
                    </p>
                    
                    {nativePageUrl && (
                      <a 
                        href={nativePageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors font-black uppercase tracking-wider group/link"
                      >
                        View Source
                        <ExternalLink className="w-2.5 h-2.5 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Mobile Portal */}
                {mounted && showTooltip && createPortal(
                  <div 
                    className="md:hidden fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm transition-all duration-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTooltip(false);
                    }}
                  >
                    <div 
                      className="w-full max-w-sm bg-slate-900/95 border border-white/10 rounded-3xl shadow-2xl p-5 overflow-hidden animate-in fade-in zoom-in duration-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                        <div className="flex items-center gap-2.5">
                          <div className="relative w-5 h-5">
                            <Image src="/INaturalist_logo.svg" alt="iNaturalist" fill className="object-contain" />
                          </div>
                          <span className="text-xs text-white/60 font-black uppercase tracking-widest">iNaturalist Photo</span>
                        </div>
                        <button 
                          onClick={() => setShowTooltip(false)}
                          className="p-1.5 hover:bg-white/10 rounded-full text-white/40 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="space-y-5">
                        <div className="space-y-1.5">
                          <span className="text-[10px] text-white/30 font-black uppercase tracking-tighter">Photo Credit</span>
                          <p className="text-sm text-white font-bold leading-relaxed">
                            {attribution}
                          </p>
                        </div>

                        {nativePageUrl && (
                          <a 
                            href={nativePageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-emerald-400 font-black text-xs uppercase tracking-widest transition-all"
                          >
                            Visit iNaturalist Source
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>,
                  document.body
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Bottom Shade Fade */}
        {isPhoto && <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />}
      </div>

      {/* Content Area - Taxonomy tags like the old UI */}
      {!isPhoto ? (
        <div className="p-3 bg-white flex flex-col gap-2">
          {/* Taxonomy Tags - Ultra Compact */}
          <div className="flex flex-wrap gap-1.5 items-center">
            {[normalized.order, normalized.family, normalized.taxa_group].filter(Boolean).map((tax, i) => (
              <span key={i} className="px-2.5 py-1 bg-slate-50 text-[11px] font-bold text-slate-500 rounded-lg border border-slate-100 group-hover:border-emerald-100 group-hover:bg-emerald-50/50 transition-all uppercase tracking-tight">
                {tax}
              </span>
            ))}

          </div>
        </div>
      ) : (
        <div className="absolute bottom-0 inset-x-0 p-3 pt-6 pointer-events-none z-10">
          <div className="mb-0">
            <h3 className="font-black tracking-tight leading-tight group-hover:text-emerald-500 transition-colors text-white text-sm line-clamp-1 drop-shadow-md">
              {language === 'zh' ? normalized.common_name_chi : normalized.common_name_eng}
            </h3>
            <div className="text-[10px] tracking-wide truncate text-white/80 drop-shadow-sm">
              {formatScientificName(normalized.scientific_name)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
