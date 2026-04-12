'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Heart, Info, ExternalLink, Leaf, Loader2 } from 'lucide-react';
import { Species } from '../types/species';
import { useLanguage } from '../context/LanguageContext';
import { useSpeciesPanel } from '../context/SpeciesPanelContext';
import { useAuth } from '../context/AuthContext';
import { useInaturalistPhoto } from '../hooks/useInaturalistPhoto';
import { getIUCNConfig } from '../constants/statusStyles';
import { createClient } from '@/utils/supabase/client';


export default function SpeciesCard({ 
  species, 
  mode = 'detail',
  priority = false 
}: { 
  species: Species, 
  mode?: 'detail' | 'photo',
  priority?: boolean
}) {
  const { language } = useLanguage();
  const { addSpecies } = useSpeciesPanel();
  const { user } = useAuth();
  const supabase = createClient();
  
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // 檢查是否已收藏
  useEffect(() => {
    const checkBookmark = async () => {
      if (!user) {
        setIsBookmarked(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('species_id', species.id)
          .maybeSingle();
        
        if (error) throw error;
        setIsBookmarked(!!data);
      } catch (err) {
        console.error('Error checking bookmark:', err);
      }
    };

    checkBookmark();
  }, [user, species.id, supabase]);

  const toggleFavorite = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user) {
      // 如果未登入，可以選擇顯示提示或不執行
      alert(language === 'zh' ? '請先登入以使用收藏功能' : 'Please log in to use bookmarks');
      return;
    }

    if (isUpdating) return;
    setIsUpdating(true);

    try {
      if (isBookmarked) {
        // 移除收藏
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('species_id', species.id);
        
        if (error) throw error;
        setIsBookmarked(false);
      } else {
        // 新增收藏
        const { error } = await supabase
          .from('user_favorites')
          .insert({
            user_id: user.id,
            species_id: species.id
          });
        
        if (error) throw error;
        setIsBookmarked(true);
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    } finally {
      setIsUpdating(false);
    }
  }, [user, species.id, isBookmarked, isUpdating, supabase, language]);

  // Fetch iNaturalist photo if local image_url is missing
  const { imageUrl: inatPhoto, isLoading: isInatLoading, attribution, nativePageUrl } = useInaturalistPhoto(
    !species.image_url ? species.species_id : undefined
  );

  const displayImage = species.image_url || inatPhoto || 'https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?q=80&w=1080&auto=format&fit=crop';
  
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
          src={displayImage}
          alt={(language === 'zh' ? species.common_name_chi : species.common_name_eng) || species.scientific_name || 'Species Image'}
          fill
          priority={priority}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          className={`object-cover transition-all duration-700 group-hover:scale-110 ${isInatLoading ? 'blur-sm grayscale' : 'blur-0 grayscale-0'}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Overlays */}
        <div className={`absolute left-4 right-4 flex justify-between items-start z-10 ${isPhoto ? 'top-3' : 'top-4'}`}>
          {!isPhoto && species.iucn && (
            <span className={`
              px-3 py-1 rounded-2xl text-[11px] font-black uppercase tracking-widest backdrop-blur-md shadow-lg border
              ${badgeClass}
            `}>
              {badgeText}
            </span>
          )}

          {/* iNaturalist Attribution (i) Button */}
          {attribution && (
            <div className="absolute top-0 right-0 z-20 group/info">
              <div className="p-1.5 bg-black/30 hover:bg-black/50 backdrop-blur-md border border-white/10 rounded-full text-white/80 hover:text-white transition-all duration-300 cursor-help">
                <Info className="w-3.5 h-3.5" />
              </div>
              
              {/* Tooltip Content */}
              <div className="absolute top-full right-0 mt-2 w-max min-w-[140px] max-w-[200px] bg-slate-900/95 backdrop-blur-xl p-3 rounded-xl shadow-2xl border border-white/10 opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all duration-300 -translate-y-2 group-hover/info:translate-y-0 z-30">
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
                  <p className="text-[11px] text-white font-bold leading-snug">
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
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className={`${isPhoto ? 'p-4' : 'p-6'} flex-1 flex flex-col relative`}>
        <div className={isPhoto ? 'mb-0' : 'mb-4 pr-8'}>
          <h3 className={`font-black text-slate-900 mb-0.5 group-hover:text-emerald-600 transition-colors leading-tight ${isPhoto ? 'text-base line-clamp-1' : 'text-xl'}`}>
            {language === 'zh' ? species.common_name_chi : species.common_name_eng}
          </h3>
          <p className="text-xs text-slate-500 font-serif tracking-wide truncate">
            <span className="italic font-medium">{species.scientific_name}</span>
          </p>
        </div>

        {!isPhoto ? (
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
              <button 
                onClick={toggleFavorite}
                disabled={isUpdating}
                className={`
                  w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer bg-white
                  ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}
                  ${isBookmarked 
                    ? 'text-rose-500 border-rose-200 bg-rose-50 shadow-sm' 
                    : 'text-slate-300 border-slate-100 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-100'
                  }
                `}
              >
                {isUpdating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Heart className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
                )}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
