'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Species } from '@/types/species';
import { useLanguage } from '@/context/LanguageContext';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';
import { createClient } from '@/utils/supabase/client';
import { useInaturalistPhoto } from '@/hooks/useInaturalistPhoto';
import { formatScientificName, getSpeciesImageUrl } from '@/utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, Leaf } from 'lucide-react';

interface CongenericExplorerProps {
  species: Species;
  isMobile?: boolean;
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

const MiniSpeciesCard = ({ species }: { species: Species }) => {
  const { language } = useLanguage();
  const { addSpecies, profilePictureMap } = useSpeciesPanel();
  const { imageUrl, isLoading: isInatLoading } = useInaturalistPhoto(species.inat_id);
  
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isFullyReady, setIsFullyReady] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const placeholderImage = '/images/placeholder/no-species-image.svg';
  // displayImage should be: profile_picture > iNaturalist URL > (Optional) Placeholder
  const displayImage = getSpeciesImageUrl(species, 'square');
  const isUsingInat = !!species.inat_id;
  const commonName = language === 'zh' ? species.common_name_chi : species.common_name_eng;

  // Handle seamless transition delay
  useEffect(() => {
    if (imgLoaded || (!isUsingInat && mounted)) {
      const timer = setTimeout(() => setIsFullyReady(true), 250);
      return () => clearTimeout(timer);
    }
  }, [imgLoaded, isUsingInat, mounted]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onClick={() => species.taxa_id && addSpecies(species.taxa_id)}
      className="group relative flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50/50 hover:bg-emerald-50 border border-slate-100/60 hover:border-emerald-100 hover:shadow-lg hover:shadow-emerald-900/5 transition-all duration-300 cursor-pointer overflow-hidden shrink-0"
    >
      <div className="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-white shadow-inner flex items-center justify-center">
        {/* Actual Image */}
        {(() => {
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
              onLoadingComplete={() => setImgLoaded(true)}
              unoptimized={finalImage.includes('/api/image/transform')}
              className={`
                object-cover transition-all duration-700 group-hover:scale-115
                ${!isFullyReady ? 'opacity-0 scale-110 blur-md' : 'opacity-100 scale-100 blur-0'}
              `}
            />
          );
        })()}

        {/* Nature Loader Overlay (Seamless Transition) */}
        {!isFullyReady && (
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

export default function CongenericExplorer({ species, isMobile = false }: CongenericExplorerProps) {
  const { language } = useLanguage();
  const supabase = useMemo(() => createClient(), []);
  
  const [congenericSpecies, setCongenericSpecies] = useState<Species[]>([]);
  const [discoveryLevel, setDiscoveryLevel] = useState<'genus' | 'subfamily' | 'family' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

            setCongenericSpecies([...mappedData].sort(() => Math.random() - 0.5));
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


            setCongenericSpecies([...mappedData].sort(() => Math.random() - 0.5));
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
    // 使用 JSON.stringify 確保深度比較，或列出可能的分類欄位
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

  return (
    <div className={`p-6 rounded-[2.5rem] bg-white border border-slate-100 shadow-sm ${isMobile ? 'mt-12 mb-8' : ''}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-xl shadow-sm border border-emerald-200/50 text-emerald-700">
            <Sparkles className="w-5 h-5" />
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
            <motion.div 
              layout
              className={`
                ${isMobile ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[480px]' : 'flex flex-col gap-2 h-[460px]'} 
                overflow-y-auto pr-1.5 custom-scrollbar
              `}
            >
              {congenericSpecies.map((item) => (
                <MiniSpeciesCard key={item.id} species={item} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
