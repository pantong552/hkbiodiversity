'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Species } from '@/types/species';
import { useLanguage } from '@/context/LanguageContext';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';
import { createClient } from '@/utils/supabase/client';
import { useInaturalistPhoto } from '@/hooks/useInaturalistPhoto';
import { formatScientificName } from '@/utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Sparkles, Loader2 } from 'lucide-react';

interface CongenericExplorerProps {
  species: Species;
  isMobile?: boolean;
}

const MiniSpeciesCard = ({ species }: { species: Species }) => {
  const { language } = useLanguage();
  const { addSpecies } = useSpeciesPanel();
  const { imageUrl, isLoading } = useInaturalistPhoto(!species.image_url ? species.species_id : undefined);

  const displayImage = species.image_url || imageUrl || 'https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?q=80&w=1080&auto=format&fit=crop';
  const commonName = language === 'zh' ? species.common_name_chi : species.common_name_eng;

  return (
    <div 
      onClick={() => addSpecies(species.id)}
      className="group flex items-center gap-3 p-2 rounded-2xl hover:bg-emerald-50/50 transition-all duration-300 border border-transparent hover:border-emerald-100 cursor-pointer"
    >
      <div className="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/50">
        <Image
          src={displayImage}
          alt={commonName || species.scientific_name}
          fill
          sizes="64px"
          className={`object-cover transition-transform duration-500 group-hover:scale-110 ${isLoading ? 'blur-sm grayscale' : 'blur-0 grayscale-0'}`}
        />
      </div>
      
      <div className="flex flex-col min-w-0 flex-1">
        <h4 className="text-sm font-bold text-slate-800 line-clamp-1 group-hover:text-emerald-600 transition-colors">
          {commonName || species.scientific_name}
        </h4>
        {language === 'zh' && species.common_name_eng && (
          <p className="text-[10px] text-slate-400 font-medium truncate uppercase tracking-tight">
            {species.common_name_eng}
          </p>
        )}
        <p className="text-[11px] text-slate-500 font-serif italic line-clamp-1 mt-0.5">
          {formatScientificName(species.scientific_name)}
        </p>
      </div>
    </div>
  );
};

export default function CongenericExplorer({ species, isMobile = false }: CongenericExplorerProps) {
  const { language } = useLanguage();
  const supabase = useMemo(() => createClient(), []);
  
  const [congenericSpecies, setCongenericSpecies] = useState<Species[]>([]);
  const [discoveryLevel, setDiscoveryLevel] = useState<'genus' | 'subfamily' | 'family' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    async function fetchRelated() {
      setIsLoading(true);
      try {
        // 1. Try Genus
        if (species.genus_eng) {
          const { data } = await supabase
            .from('species')
            .select('*')
            .eq('genus_eng', species.genus_eng)
            .neq('id', species.id)
            .limit(20);
          
          if (data && data.length > 0) {
            setCongenericSpecies([...data].sort(() => Math.random() - 0.5));
            setDiscoveryLevel('genus');
            setIsLoading(false);
            return;
          }
        }

        // 2. Try Sub-family
        if (species.sub_family_eng) {
          const { data } = await supabase
            .from('species')
            .select('*')
            .eq('sub_family_eng', species.sub_family_eng)
            .neq('id', species.id)
            .limit(20);
          
          if (data && data.length > 0) {
            setCongenericSpecies([...data].sort(() => Math.random() - 0.5));
            setDiscoveryLevel('subfamily');
            setIsLoading(false);
            return;
          }
        }

        // 3. Try Family
        if (species.family_eng) {
          const { data } = await supabase
            .from('species')
            .select('*')
            .eq('family_eng', species.family_eng)
            .neq('id', species.id)
            .limit(20);
          
          if (data && data.length > 0) {
            setCongenericSpecies([...data].sort(() => Math.random() - 0.5));
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
  }, [species.genus_eng, species.sub_family_eng, species.family_eng, species.id, supabase]);

  const displayedSpecies = isExpanded ? congenericSpecies : congenericSpecies.slice(0, 5);
  const hasMore = congenericSpecies.length > 5;

  const getTitle = () => {
    if (language === 'zh') {
      switch (discoveryLevel) {
        case 'genus': return '探索同屬物種';
        case 'subfamily': return '探索同亞科物種';
        case 'family': return '探索同科物種';
        default: return '探索相關物種';
      }
    } else {
      switch (discoveryLevel) {
        case 'genus': return 'Congeneric Species';
        case 'subfamily': return 'Subfamily Relatives';
        case 'family': return 'Family Relatives';
        default: return 'Related Species';
      }
    }
  };

  if (!isLoading && congenericSpecies.length === 0) return null;

  return (
    <div className={`flex flex-col ${isMobile ? 'mt-12 mb-8' : ''}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-xl">
            <Sparkles className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="text-lg font-black text-slate-800">
            {getTitle()}
          </h3>
        </div>
        {congenericSpecies.length > 0 && (
          <span className="px-2 py-0.5 bg-slate-100 text-[10px] font-black text-slate-500 rounded-md border border-slate-200 uppercase tracking-widest">
            {congenericSpecies.length} {language === 'zh' ? '種' : 'Species'}
          </span>
        )}
      </div>

      <div className="space-y-1">
        {isLoading ? (
          <div className="flex flex-col items-center py-12 gap-4">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">
              {language === 'zh' ? '搜尋同屬物種中...' : 'Discovering related species...'}
            </span>
          </div>
        ) : (
          <>
            <AnimatePresence initial={false}>
              <motion.div 
                layout
                className={`
                  ${isMobile ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[480px]' : 'flex flex-col gap-1 max-h-[600px]'} 
                  overflow-y-auto pr-1 custom-scrollbar
                `}
              >
                {displayedSpecies.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <MiniSpeciesCard species={item} />
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>

            {!isExpanded && hasMore && (
              <motion.button
                layout
                onClick={() => setIsExpanded(true)}
                className="w-full mt-4 py-3 flex items-center justify-center gap-2 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-2xl transition-all duration-300 group shadow-sm hover:shadow-md active:scale-[0.98]"
              >
                <span className="text-xs font-black text-slate-500 group-hover:text-emerald-700 uppercase tracking-widest transition-colors">
                  + {language === 'zh' ? `更多 (還有 ${congenericSpecies.length - 5} 種)` : `More (${congenericSpecies.length - 5} others)`}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 group-hover:translate-y-0.5 transition-all" />
              </motion.button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
