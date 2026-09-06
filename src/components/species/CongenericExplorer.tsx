'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Species } from '@/types/species';
import { useLanguage } from '@/context/LanguageContext';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';
import { createClient } from '@/utils/supabase/client';
import { useInaturalistPhoto } from '@/hooks/useInaturalistPhoto';
import { formatScientificName, getSpeciesImageUrl } from '@/utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Leaf, ChevronDown, ChevronUp, Maximize2 } from 'lucide-react';
import EnrichedLightbox from '../ui/EnrichedLightbox';
import { InatGalleryPhoto } from '@/hooks/useInaturalistSpeciesPhotos';

interface CongenericExplorerProps {
  species: Species;
  isMobile?: boolean;
  onOpenLightbox?: (photo: { url: string; commonName: string; scientificName: string }) => void;
}

const SkeletonCard = () => (
  <div className="flex items-center gap-3 p-2 rounded-2xl bg-slate-50 animate-pulse border border-slate-100">
    <div className="w-16 h-16 rounded-xl bg-slate-200" />
    <div className="flex flex-col flex-1 gap-2">
      <div className="h-4 w-2/3 bg-slate-200 rounded" />
      <div className="h-3 w-1/2 bg-slate-100 rounded" />
    </div>
  </div>
);

// 橫向卡片 - 用於 Tablet mode
const HorizontalSpeciesCard = ({ species, index, onOpenLightbox }: { species: Species; index: number; onOpenLightbox?: (photo: { url: string; commonName: string; scientificName: string }) => void }) => {
  const { language } = useLanguage();
  const { addSpecies, profilePictureMap } = useSpeciesPanel();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(index < 5);

  useEffect(() => {
    if (index < 5 || shouldLoad) return;
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px 0px', threshold: 0.01 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [index, shouldLoad]);

  const { imageUrl, isLoading: isInatLoading } = useInaturalistPhoto(shouldLoad ? species.inat_id : undefined);
  
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isFullyReady, setIsFullyReady] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const placeholderImage = '/images/placeholder/no-species-image.svg';
  const commonName = language === 'zh' ? species.common_name_chi : species.common_name_eng;

  useEffect(() => {
    if (imgLoaded || (!species.inat_id && mounted)) {
      const timer = setTimeout(() => setIsFullyReady(true), 250);
      return () => clearTimeout(timer);
    }
  }, [imgLoaded, species.inat_id, mounted]);

  return (
    <motion.div 
      ref={containerRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onClick={() => species.taxa_id && addSpecies(species.taxa_id)}
      className="group relative flex flex-col w-48 shrink-0 p-3 rounded-3xl bg-slate-50/50 hover:bg-emerald-50 border border-slate-100/60 hover:border-emerald-100 hover:shadow-xl hover:shadow-emerald-950/5 transition-all duration-300 cursor-pointer overflow-hidden"
    >
      {/* Image Area */}
      <div className="relative w-full h-32 rounded-2xl overflow-hidden bg-white shadow-inner flex items-center justify-center mb-3">
        {shouldLoad && (() => {
          const taxaId = species.taxa_id || '';
          const globalProfilePic = taxaId ? profilePictureMap[taxaId] : undefined;
          const effectiveSpecies = globalProfilePic !== undefined ? { ...species, profile_picture: globalProfilePic } : species;
          const displayImage = getSpeciesImageUrl(effectiveSpecies as any, 'medium') || getSpeciesImageUrl(effectiveSpecies as any, 'square');
          const finalImage = displayImage || imageUrl || (isInatLoading ? '' : placeholderImage);
          
          if (!finalImage) return null;
          
          return (
            <div 
              className="relative w-full h-full group/thumb cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (finalImage && finalImage !== placeholderImage) {
                  onOpenLightbox?.({
                    url: finalImage,
                    commonName: commonName || species.scientific_name,
                    scientificName: species.scientific_name,
                  });
                }
              }}
              title={language === 'zh' ? '點擊放大檢視照片' : 'Click to enlarge photo'}
            >
              <Image
                src={finalImage}
                alt={commonName || species.scientific_name}
                fill
                sizes="(max-width: 768px) 192px, 192px"
                onLoad={() => setImgLoaded(true)}
                unoptimized={finalImage.includes('/api/image/transform')}
                className={`
                  object-cover transition-all duration-700 group-hover:scale-110
                  ${!isFullyReady ? 'opacity-0 scale-105 blur-md' : 'opacity-100 scale-100 blur-0'}
                `}
              />
              <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Maximize2 className="w-5 h-5 shadow-sm" />
              </div>
            </div>
          );
        })()}

        {(!isFullyReady || !shouldLoad) && (
          <div className={`
            absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10 overflow-hidden
            transition-all duration-500 ease-in-out
            ${imgLoaded ? 'opacity-0 scale-105 blur-sm' : 'opacity-100 scale-100 blur-0'}
          `}>
            <div className="relative w-8 h-8 flex items-center justify-center scale-75">
              <div className="absolute inset-0 border-t-2 border-emerald-500/40 border-r-2 border-emerald-500/10 rounded-full animate-spin duration-[1500ms]"></div>
              <div className="absolute inset-1 border-b-2 border-emerald-500/50 border-l-2 border-emerald-500/5 rounded-full animate-spin-reverse duration-[2000ms]"></div>
            </div>
          </div>
        )}
      </div>
      
      {/* Texts Area */}
      <div className="flex flex-col flex-1 min-w-0">
        <h4 className="text-[14px] font-black text-slate-800 line-clamp-1 group-hover:text-emerald-700 transition-colors leading-tight">
          {commonName || formatScientificName(species.scientific_name)}
        </h4>
        {language === 'zh' && species.common_name_eng && (
          <p className="text-[9px] text-slate-400 font-bold truncate uppercase tracking-wider mt-1">
            {species.common_name_eng}
          </p>
        )}
        <p className="text-[11px] text-slate-500 font-serif italic line-clamp-1 mt-1 leading-snug">
          {formatScientificName(species.scientific_name)}
        </p>
      </div>

      <div className="absolute right-2.5 bottom-2.5 w-1 h-1 rounded-full bg-emerald-500/0 group-hover:bg-emerald-500 transition-all duration-500 scale-0 group-hover:scale-110 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
    </motion.div>
  );
};

// 垂直卡片 - 用於 Mobile 與 Desktop Sidebar
const MiniSpeciesCard = ({ species, index, onOpenLightbox }: { species: Species; index: number; onOpenLightbox?: (photo: { url: string; commonName: string; scientificName: string }) => void }) => {
  const { language } = useLanguage();
  const { addSpecies, profilePictureMap } = useSpeciesPanel();

  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(index < 5);

  useEffect(() => {
    if (index < 5 || shouldLoad) return;
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px 0px', threshold: 0.01 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [index, shouldLoad]);

  const { imageUrl, isLoading: isInatLoading } = useInaturalistPhoto(shouldLoad ? species.inat_id : undefined);
  
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isFullyReady, setIsFullyReady] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const placeholderImage = '/images/placeholder/no-species-image.svg';
  const commonName = language === 'zh' ? species.common_name_chi : species.common_name_eng;

  // Handle seamless transition delay
  useEffect(() => {
    if (imgLoaded || (!species.inat_id && mounted)) {
      const timer = setTimeout(() => setIsFullyReady(true), 250);
      return () => clearTimeout(timer);
    }
  }, [imgLoaded, species.inat_id, mounted]);

  return (
    <motion.div 
      ref={containerRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onClick={() => species.taxa_id && addSpecies(species.taxa_id)}
      className="group relative flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50/50 hover:bg-emerald-50 border border-slate-100/60 hover:border-emerald-100 hover:shadow-lg hover:shadow-emerald-900/5 transition-all duration-300 cursor-pointer overflow-hidden shrink-0"
    >
      <div className="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-white shadow-inner flex items-center justify-center">
        {/* Actual Image & Lightbox Trigger */}
        {shouldLoad && (() => {
          const taxaId = species.taxa_id || '';
          const globalProfilePic = taxaId ? profilePictureMap[taxaId] : undefined;
          const effectiveSpecies = globalProfilePic !== undefined ? { ...species, profile_picture: globalProfilePic } : species;
          const displayImage = getSpeciesImageUrl(effectiveSpecies as any, 'medium') || getSpeciesImageUrl(effectiveSpecies as any, 'square');
          const finalImage = displayImage || imageUrl || (isInatLoading ? '' : placeholderImage);
          
          if (!finalImage) return null;
          
          return (
            <div 
              className="relative w-full h-full group/thumb cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (finalImage && finalImage !== placeholderImage) {
                  onOpenLightbox?.({
                    url: finalImage,
                    commonName: commonName || species.scientific_name,
                    scientificName: species.scientific_name,
                  });
                }
              }}
              title={language === 'zh' ? '點擊放大檢視照片' : 'Click to enlarge photo'}
            >
              <Image
                src={finalImage}
                alt={commonName || species.scientific_name}
                fill
                sizes="64px"
                onLoad={() => setImgLoaded(true)}
                unoptimized={finalImage.includes('/api/image/transform')}
                className={`
                  object-cover transition-all duration-700 group-hover:scale-115
                  ${!isFullyReady ? 'opacity-0 scale-110 blur-md' : 'opacity-100 scale-100 blur-0'}
                `}
              />
              <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Maximize2 className="w-4 h-4 shadow-sm" />
              </div>
            </div>
          );
        })()}

        {/* Nature Loader Overlay (Seamless Transition) */}
        {(!isFullyReady || !shouldLoad) && (
          <div className={`
            absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10 overflow-hidden
            transition-all duration-500 ease-in-out
            ${imgLoaded ? 'opacity-0 scale-105 blur-sm' : 'opacity-100 scale-100 blur-0'}
          `}>
            {/* Spinning Rings - Scaled Down */}
            <div className="relative w-10 h-10 flex items-center justify-center scale-75">
              <div className="absolute inset-0 border-t border-emerald-500/40 border-r border-emerald-500/10 rounded-full animate-spin duration-[1500ms]"></div>
              <div className="absolute inset-1.5 border-b border-emerald-500/50 border-l border-emerald-500/5 rounded-full animate-spin-reverse duration-[2000ms]"></div>
              
              {/* Pulsing Leaf Center */}
              <div className="relative bg-white p-1.5 rounded-full shadow-lg shadow-emerald-900/20 animate-pulse">
                <Leaf className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/10" />
              </div>
            </div>
            
            {/* Tiny Dots */}
            <div className="mt-1.5 flex gap-1 animate-pulse">
              <span className="w-0.5 h-0.5 bg-emerald-500/40 rounded-full"></span>
              <span className="w-0.5 h-0.5 bg-emerald-500/40 rounded-full"></span>
            </div>
          </div>
        )}
        
        <div className="absolute inset-0 border border-black/5 rounded-xl pointer-events-none" />
      </div>
      
      <div className="flex flex-col min-w-0 flex-1 px-0.5">
        <h4 className="text-[13px] font-black text-slate-800 line-clamp-1 group-hover:text-emerald-700 transition-colors leading-snug">
          {commonName || formatScientificName(species.scientific_name)}
        </h4>
        {language === 'zh' && species.common_name_eng && (
          <p className="text-[9px] text-slate-400 font-bold truncate uppercase tracking-tight mt-0.5">
            {species.common_name_eng}
          </p>
        )}
        <p className="text-[10px] text-slate-500 font-serif italic line-clamp-1 mt-0.5 leading-tight">
          {formatScientificName(species.scientific_name)}
        </p>
      </div>

      <div className="absolute right-2.5 bottom-2.5 w-1 h-1 rounded-full bg-emerald-500/0 group-hover:bg-emerald-500 transition-all duration-500 scale-0 group-hover:scale-110 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
    </motion.div>
  );
};

export default function CongenericExplorer({ species, isMobile = false }: CongenericExplorerProps) {
  const { language } = useLanguage();
  const supabase = useMemo(() => createClient(), []);
  
  const { setLightboxOpen } = useSpeciesPanel();
  const [congenericSpecies, setCongenericSpecies] = useState<Species[]>([]);
  const [discoveryLevel, setDiscoveryLevel] = useState<'genus' | 'subfamily' | 'family' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeLightboxPhoto, setActiveLightboxPhoto] = useState<{ url: string; commonName: string; scientificName: string } | null>(null);

  const handleOpenLightbox = useCallback((photo: { url: string; commonName: string; scientificName: string }) => {
    setActiveLightboxPhoto(photo);
    setLightboxOpen(true);
  }, [setLightboxOpen]);

  const handleCloseLightbox = useCallback(() => {
    setActiveLightboxPhoto(null);
    setLightboxOpen(false);
  }, [setLightboxOpen]);

  useEffect(() => {
    async function fetchRelated() {
      setIsLoading(true);
      try {
        const isFlora = species.taxa_group === 'FLORA';
        const genusField = 'genus_eng';
        const familyField = 'family_eng';
        
        const genusValue = species.genus_eng;
        const familyValue = species.family_eng;

        // Step 1: Try Genus
        if (genusValue) {
          const { data, error } = await supabase
            .from(isFlora ? 'plant_species' : 'species')
            .select('*')
            .eq(genusField, genusValue)
            .neq('inat_id', species.inat_id)
            .order('scientific_name', { ascending: true })
            .limit(20);
          
          if (data && data.length > 0) {
            const mappedData = isFlora ? data.map((p: any) => ({
              ...p,
              id: p.inat_id,
              common_name_chi: p.common_name_chi,
              common_name_eng: p.common_name_eng,
              taxa_group: 'FLORA',
              family_eng: p.family_eng,
              genus_eng: p.genus_eng,
            })) : data;

            const sortedData = [...mappedData].sort((a, b) => 
              (a.scientific_name || '').localeCompare(b.scientific_name || '')
            );

            setCongenericSpecies(sortedData);
            setDiscoveryLevel('genus');
            setIsLoading(false);
            return;
          }
        }

        // Step 2: Try Family
        if (familyValue) {
          const { data, error } = await supabase
            .from(isFlora ? 'plant_species' : 'species')
            .select('*')
            .eq(familyField, familyValue)
            .neq('inat_id', species.inat_id)
            .order('scientific_name', { ascending: true })
            .limit(20);
          
          if (data && data.length > 0) {
            const mappedData = isFlora ? data.map((p: any) => ({
              ...p,
              id: p.inat_id,
              common_name_chi: p.common_name_chi,
              common_name_eng: p.common_name_eng,
              taxa_group: 'FLORA',
              family_chi: p.family_chi,
              family_eng: p.family_eng,
              genus_chi: p.genus_chi,
              genus_eng: p.genus_eng,
            })) : data;

            const sortedData = [...mappedData].sort((a, b) => 
              (a.scientific_name || '').localeCompare(b.scientific_name || '')
            );

            setCongenericSpecies(sortedData);
            setDiscoveryLevel('family');
            setIsLoading(false);
            return;
          }
        }

        setCongenericSpecies([]);
        setDiscoveryLevel(null);
      } catch (err) {
        console.error('Error fetching related species:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRelated();
  }, [species, supabase]);

  const getTitle = () => {
    if (language === 'zh') {
      switch (discoveryLevel) {
        case 'genus': return '探索同屬物種';
        case 'family': return '探索同科物種';
        default: return '探索相關物種';
      }
    } else {
      switch (discoveryLevel) {
        case 'genus': return 'Congeneric Species';
        case 'family': return 'Family Relatives';
        default: return 'Related Species';
      }
    }
  };

  if (!isLoading && congenericSpecies.length === 0) return null;

  const hasMoreThanFive = congenericSpecies.length > 5;

  const galleryPhotoFormat: InatGalleryPhoto[] = activeLightboxPhoto ? [{
    id: 1,
    url: activeLightboxPhoto.url,
    large_url: activeLightboxPhoto.url,
    medium_url: activeLightboxPhoto.url,
    small_url: activeLightboxPhoto.url,
    original_url: activeLightboxPhoto.url,
    attribution: activeLightboxPhoto.commonName,
    licenseCode: 'CC-BY',
    nativePageUrl: activeLightboxPhoto.url,
    observationUrl: '',
    observedOn: '',
  }] : [];

  return (
    <div className={`p-6 rounded-[2.5rem] bg-white border border-slate-100 shadow-sm ${isMobile ? 'mt-6 mb-8' : ''}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-100/50 flex items-center justify-center text-emerald-600 shrink-0 shadow-xs">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
          </div>
          
          <div className="flex flex-col">
            <h3 className="text-sm md:text-md font-black text-slate-800 leading-tight">
              {getTitle()}
            </h3>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Total {congenericSpecies.length} Records
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {/* Desktop Sidebar Layout - Always Vertical */}
            {!isMobile && (
              <motion.div 
                key="congeneric-desktop-vertical"
                layout
                className="flex flex-col gap-2 h-[460px] overflow-y-auto pr-1.5 custom-scrollbar"
              >
                {congenericSpecies.map((item, idx) => (
                  <MiniSpeciesCard 
                    key={item.taxa_id || item.id} 
                    species={item} 
                    index={idx} 
                    onOpenLightbox={handleOpenLightbox}
                  />
                ))}
              </motion.div>
            )}

            {/* In-page Layout (isMobile) */}
            {isMobile && (
              <React.Fragment key="congeneric-mobile-wrapper">
                {/* Tablet Mode - Horizontal scroll (hidden md:flex xl:hidden) */}
                <motion.div 
                  key="congeneric-tablet-horizontal"
                  layout
                  className="hidden md:flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200"
                >
                  {congenericSpecies.map((item, idx) => (
                    <HorizontalSpeciesCard 
                      key={item.taxa_id || item.id} 
                      species={item} 
                      index={idx} 
                      onOpenLightbox={handleOpenLightbox}
                    />
                  ))}
                </motion.div>

                {/* Mobile Mode - Vertical List (flex md:hidden) */}
                <div key="congeneric-mobile-vertical" className="flex md:hidden flex-col gap-2">
                  {/* 前 5 個永遠保持靜態無淡入淡出 */}
                  {congenericSpecies.slice(0, 5).map((item, idx) => (
                    <MiniSpeciesCard 
                      key={item.taxa_id || item.id} 
                      species={item} 
                      index={idx} 
                      onOpenLightbox={handleOpenLightbox}
                    />
                  ))}

                  {/* 第 6 個之後的物種：平滑捲簾式展開/收起 (保持 Mount 以免重複觸發 Request，完全重用 Disk/Memory Cache) */}
                  {hasMoreThanFive && (
                    <motion.div
                      initial={false}
                      animate={{
                        height: isExpanded ? 'auto' : 0,
                        opacity: isExpanded ? 1 : 0,
                        marginTop: isExpanded ? 0 : -8,
                      }}
                      transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
                      className="overflow-hidden flex flex-col gap-2 pointer-events-auto"
                    >
                      {congenericSpecies.slice(5).map((item, idx) => (
                        <MiniSpeciesCard 
                          key={item.taxa_id || item.id} 
                          species={item} 
                          index={idx + 5} 
                          onOpenLightbox={handleOpenLightbox}
                        />
                      ))}
                    </motion.div>
                  )}

                  {/* Show More / Show Less Toggle Button for Mobile Mode */}
                  {hasMoreThanFive && (
                    <button
                      type="button"
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="mt-2 w-full py-2.5 px-4 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-200 text-xs font-bold text-slate-700 hover:text-emerald-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.99]"
                    >
                      <span>
                        {isExpanded
                          ? (language === 'zh' ? '收起物種列表' : 'Show Less')
                          : (language === 'zh'
                            ? `顯示更多物種 (+${congenericSpecies.length - 5})`
                            : `Show All Species (+${congenericSpecies.length - 5})`)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-emerald-600" />
                      )}
                    </button>
                  )}
                </div>
              </React.Fragment>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Enriched Lightbox Modal (點擊卡片縮圖觸發直讀已下載圖片，無網絡發送) */}
      {activeLightboxPhoto && (
        <EnrichedLightbox
          isOpen={!!activeLightboxPhoto}
          onClose={handleCloseLightbox}
          photos={galleryPhotoFormat}
          currentIndex={0}
          onNavigate={() => {}}
          commonName={activeLightboxPhoto.commonName}
          scientificName={activeLightboxPhoto.scientificName}
        />
      )}
    </div>
  );
}
