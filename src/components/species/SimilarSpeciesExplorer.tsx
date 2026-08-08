'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { Species } from '@/types/species';
import { useLanguage } from '@/context/LanguageContext';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';
import { createClient } from '@/utils/supabase/client';
import { useInaturalistPhoto } from '@/hooks/useInaturalistPhoto';
import { formatScientificName, getSpeciesImageUrl } from '@/utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Leaf } from 'lucide-react';

interface SimilarSpeciesExplorerProps {
  species: Species;
}

// 橫向卡片 - 用於 Tablet 與 Desktop
const HorizontalSpeciesCard = ({ species, index }: { species: Species; index: number }) => {
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
          const displayImage = getSpeciesImageUrl(effectiveSpecies as any, 'square');
          const finalImage = displayImage || imageUrl || (isInatLoading ? '' : placeholderImage);
          
          if (!finalImage) return null;
          
          return (
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
          {commonName || species.scientific_name}
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

// 垂直卡片 - 用於 Mobile
const MiniSpeciesCard = ({ species, index }: { species: Species; index: number }) => {
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
        {/* Actual Image */}
        {shouldLoad && (() => {
          const taxaId = species.taxa_id || '';
          const globalProfilePic = taxaId ? profilePictureMap[taxaId] : undefined;
          const effectiveSpecies = globalProfilePic !== undefined ? { ...species, profile_picture: globalProfilePic } : species;
          const displayImage = getSpeciesImageUrl(effectiveSpecies as any, 'square');
          const finalImage = displayImage || imageUrl || (isInatLoading ? '' : placeholderImage);
          
          if (!finalImage) return null;
          
          return (
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
          );
        })()}

        {/* Nature Loader Overlay (Seamless Transition) */}
        {(!isFullyReady || !shouldLoad) && (
          <div className={`
            absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10 overflow-hidden
            transition-all duration-500 ease-in-out
            ${imgLoaded ? 'opacity-0 scale-105 blur-sm' : 'opacity-100 scale-100 blur-0'}
          `}>
            <div className="relative w-10 h-10 flex items-center justify-center scale-75">
              <div className="absolute inset-0 border-t border-emerald-500/40 border-r border-emerald-500/10 rounded-full animate-spin duration-[1500ms]"></div>
              <div className="absolute inset-1.5 border-b border-emerald-500/50 border-l border-emerald-500/5 rounded-full animate-spin-reverse duration-[2000ms]"></div>
              
              <div className="relative bg-white p-1.5 rounded-full shadow-lg shadow-emerald-900/20 animate-pulse">
                <Leaf className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/10" />
              </div>
            </div>
          </div>
        )}
        
        <div className="absolute inset-0 border border-black/5 rounded-xl pointer-events-none" />
      </div>
      
      <div className="flex flex-col min-w-0 flex-1 px-0.5">
        <h4 className="text-[13px] font-black text-slate-800 line-clamp-1 group-hover:text-emerald-700 transition-colors leading-snug">
          {commonName || species.scientific_name}
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

// 輔助函數：將植物資料映射為 Species 結構
function mapPlantToSpecies(plantData: any): Species {
  return {
    ...plantData,
    taxa_group: 'FLORA',
    common_name_chi: plantData.common_name_chi,
    common_name_eng: plantData.common_name_eng,
    scientific_name: plantData.scientific_name,
    family_eng: plantData.family_eng,
    genus_eng: plantData.genus_eng,
    class_eng: plantData.category_eng,
    order_eng: plantData.family_eng,
    habitat_chi: plantData.habitat_chi,
    habitat_eng: plantData.habitat_eng,
    description_chi: plantData.description_chi,
    description_eng: plantData.description_eng,
    remarks_chi: plantData.remark_chi,
    remarks_eng: plantData.remark_eng,
  } as unknown as Species;
}

export default function SimilarSpeciesExplorer({ species }: SimilarSpeciesExplorerProps) {
  const { language } = useLanguage();
  const supabase = useMemo(() => createClient(), []);
  
  const [similarSpecies, setSimilarSpecies] = useState<Species[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSimilar() {
      if (!species.similar_species) {
        setSimilarSpecies([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const taxaIds = species.similar_species
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean);

        if (taxaIds.length === 0) {
          setSimilarSpecies([]);
          setIsLoading(false);
          return;
        }

        const faunaIds = taxaIds.filter(id => id.startsWith('fauna_'));
        const floraIds = taxaIds.filter(id => id.startsWith('flora_'));

        let faunaData: any[] = [];
        if (faunaIds.length > 0) {
          const { data } = await supabase
            .from('species')
            .select('*')
            .in('taxa_id', faunaIds);
          faunaData = data || [];
        }

        let floraData: any[] = [];
        if (floraIds.length > 0) {
          const { data } = await supabase
            .from('plant_species')
            .select('*')
            .in('taxa_id', floraIds);
          floraData = (data || []).map(mapPlantToSpecies);
        }

        const allSimilar = [...faunaData, ...floraData];
        
        const orderedSimilar = taxaIds
          .map(id => allSimilar.find(s => s.taxa_id === id))
          .filter(Boolean) as Species[];

        setSimilarSpecies(orderedSimilar);
      } catch (err) {
        console.error('Error fetching similar species:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSimilar();
  }, [species.similar_species, supabase]);

  if (!isLoading && similarSpecies.length === 0) return null;

  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 w-full mb-12">
      {/* Tablet & Desktop Title (md以上) */}
      <div className="hidden md:flex items-center justify-between mb-8">
        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-emerald-500" />
          {language === 'zh' ? '相似物種' : 'Similar Species'}
        </h2>
        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full uppercase tracking-widest">
          Total {similarSpecies.length} Records
        </span>
      </div>

      {/* Mobile Title (md以下) - 保留使用之前 "Congeneric species" 般的2行顯示方式 */}
      <div className="flex md:hidden items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-xl shadow-sm border border-emerald-200/50 text-emerald-700">
            <Sparkles className="w-5 h-5" />
          </div>
          
          <div className="flex flex-col">
            <h3 className="text-sm md:text-md font-black text-slate-800 leading-tight">
              {language === 'zh' ? '相似物種' : 'Similar Species'}
            </h3>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Total {similarSpecies.length} Records
            </span>
          </div>
        </div>
      </div>

      <div>
        {isLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-48 h-56 rounded-3xl bg-slate-50 animate-pulse border border-slate-100 flex-shrink-0" />
            ))}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {/* Tablet & Desktop Layout - Horizontal scroll */}
            <motion.div 
              key="similar-desktop-layout"
              layout
              className="hidden md:flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200"
            >
              {similarSpecies.map((item, idx) => (
                <HorizontalSpeciesCard key={item.taxa_id || item.id} species={item} index={idx} />
              ))}
            </motion.div>

            {/* Mobile Layout - Vertical List */}
            <motion.div 
              key="similar-mobile-layout"
              layout
              className="flex md:hidden flex-col gap-2"
            >
              {similarSpecies.map((item, idx) => (
                <MiniSpeciesCard key={item.taxa_id || item.id} species={item} index={idx} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
