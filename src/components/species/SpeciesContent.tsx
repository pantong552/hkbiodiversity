'use client';

import React from 'react';
import Image from 'next/image';
import { Species } from '@/types/species';
import { useLanguage } from '@/context/LanguageContext';
import { Bookmark, Map, ExternalLink, Shield, Image as ImageIcon } from 'lucide-react';
import TaxonomyDisplay from './TaxonomyDisplay';
import ConservationStatus from './ConservationStatus';
import CommentSection from '../comments/CommentSection';
import SpeciesPhotoGallery from './SpeciesPhotoGallery';
import { useInaturalistSpeciesPhotos, InatGalleryPhoto } from '@/hooks/useInaturalistSpeciesPhotos';
import { motion, AnimatePresence } from 'framer-motion';
import { useRef } from 'react';
import SpeciesMap from './SpeciesMap';
import { formatScientificName } from '@/utils/formatters';
import CongenericExplorer from './CongenericExplorer';


interface SpeciesContentProps {
  species: Species;
  showBreadcrumb?: boolean;
}

const SpeciesHeroBackground = ({ photos, defaultImage }: { photos: InatGalleryPhoto[], defaultImage: string }) => {
  const [index, setIndex] = React.useState(0);
  
  // Use a ref to keep track of the last valid photos to prevent flickering during scope fallback
  const lastValidPhotosRef = useRef<InatGalleryPhoto[]>([]);
  
  if (photos.length > 0) {
    lastValidPhotosRef.current = photos;
  }

  const displayPhotos = photos.length > 0 ? photos : lastValidPhotosRef.current;
  const hasPhotos = displayPhotos.length > 0;

  React.useEffect(() => {
    if (displayPhotos.length <= 1) return;
    
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % displayPhotos.length);
    }, 10000);
    
    return () => clearInterval(timer);
  }, [displayPhotos.length]);

  return (
    <div className="absolute inset-0 z-0 bg-slate-950">
      <AnimatePresence mode="wait">
        <motion.div
          key={hasPhotos ? `hero-${displayPhotos[index].id}` : 'default-bg'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {/* Background Image */}
          <Image 
            src={hasPhotos ? (displayPhotos[index].large_url || displayPhotos[index].url) : defaultImage} 
            alt="Species background"
            fill
            sizes="100vw"
            className="object-cover opacity-70"
            priority={index === 0}
          />
          
          {/* Individual Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/20 to-transparent z-10" />

          {/* Dynamic Photo Credit */}
          {hasPhotos && (
            <div 
              className="absolute bottom-6 right-8 z-30 flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 hover:bg-black/60 transition-colors group cursor-default pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-[10px] font-medium text-white/90 tracking-wide drop-shadow-sm select-none">
                {displayPhotos[index].attribution}
              </span>
              {displayPhotos[index].observationUrl && (
                <a 
                  href={displayPhotos[index].observationUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white/60 hover:text-emerald-400 p-0.5 rounded transition-colors"
                  title="View on iNaturalist"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default function SpeciesContent({ species, showBreadcrumb = true }: SpeciesContentProps) {
  const { language } = useLanguage();
  const { photos } = useInaturalistSpeciesPhotos(species.species_id);

  const commonName = language === 'zh' ? species.common_name_chi : species.common_name_eng;
  const description = language === 'zh' ? species.description_chi : species.description_eng;
  const remarks = language === 'zh' ? species.remarks_chi : species.remarks_eng;
  const hkDist = language === 'zh' ? species.hk_distribution_chi : species.hk_distribution_eng;
  const globalDist = language === 'zh' ? species.global_distribution_chi : species.global_distribution_eng;
  const refs = language === 'zh' ? species.references_chi : species.references_eng;

  return (
    <div className="bg-slate-50 min-h-full">
      {/* Breadcrumb Area - Inside Content but below Tabs */}
      {showBreadcrumb && (
        <div className="bg-white/60 backdrop-blur-sm border-b border-slate-100 px-8 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span>{language === 'zh' ? species.phylum_chi : species.phylum_eng}</span>
            <span>/</span>
            <span>{language === 'zh' ? species.class_chi : species.class_eng}</span>
            <span>/</span>
            <span>{language === 'zh' ? species.order_chi : species.order_eng}</span>
            <span>/</span>
            <span className="text-emerald-600">{language === 'zh' ? species.family_chi : species.family_eng}</span>
          </div>
        </div>
      )}

      {/* Hero Header */}
      <div className="w-full h-[40vh] min-h-[400px] bg-slate-950 relative overflow-hidden">
        <SpeciesHeroBackground 
          photos={photos} 
          defaultImage={species.image_url || 'https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?q=80&w=1080&auto=format&fit=crop'} 
        />
        
        <div className="absolute bottom-0 left-0 w-full p-8 md:p-12 z-20 pointer-events-none">
          <div className="max-w-7xl mx-auto pointer-events-auto">
            <span className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-[10px] font-bold tracking-widest uppercase mb-4">
              {species.taxa_group} • ID: {species.species_id}
            </span>
            <div className="flex flex-col mb-2">
              <h1 className="text-4xl md:text-5xl font-black text-white leading-tight">
                {commonName}
              </h1>
              {language === 'zh' && species.common_name_eng && (
                <p className="text-xl text-emerald-200/60 font-medium tracking-wide">
                  {species.common_name_eng}
                </p>
              )}
            </div>
            <p className="text-lg md:text-xl text-emerald-50 font-serif tracking-wide">
              {formatScientificName(species.scientific_name)} <span className="text-emerald-200/60 text-sm ml-2">{species.author}</span>
            </p>
            </div>
          </div>
        </div>
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
          
          {/* Left Column */}
          <div className="xl:col-span-9 space-y-12">
            

            {/* Taxonomy Section - Always Card Style now */}
            <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <TaxonomyDisplay species={species} />
            </section>

            {/* iNaturalist Photo Gallery */}
            {species.species_id && (
              <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <SpeciesPhotoGallery 
                  taxonId={species.species_id} 
                  commonName={commonName || species.scientific_name} 
                />
              </section>
            )}


            {/* Description */}
            {description && (
              <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                  <Bookmark className="w-6 h-6 text-emerald-500" />
                  {language === 'zh' ? '形態特徵' : 'Description'}
                </h2>
                <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed">
                  <p>{description}</p>
                </div>
              </section>
            )}

            {/* Remarks */}
            {remarks && (
              <section className="bg-emerald-50/50 p-8 rounded-[2.5rem] border border-emerald-100/50">
                <h2 className="text-xl font-bold text-emerald-900 mb-4">
                  {language === 'zh' ? '備註' : 'Remarks'}
                </h2>
                <p className="text-emerald-800/80 leading-relaxed">
                  {remarks}
                </p>
              </section>
            )}

            {/* Distribution */}
            <section className="space-y-6">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <Map className="w-6 h-6 text-emerald-500" />
                {language === 'zh' ? '地理分布' : 'Distribution'}
              </h2>
              
              {species.species_id ? (
                <SpeciesMap taxonId={species.species_id} />
              ) : (
                <div className="w-full h-[300px] bg-slate-200 rounded-[2.5rem] flex items-center justify-center text-slate-500">
                  <p>{language === 'zh' ? '無 iNaturalist ID' : 'No iNaturalist ID available'}</p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <h3 className="font-black text-slate-800 mb-2">{language === 'zh' ? '香港分布' : 'HK Distribution'}</h3>
                  <p className="text-slate-600 text-sm">{hkDist || '-'}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <h3 className="font-black text-slate-800 mb-2">{language === 'zh' ? '全球分布' : 'Global Distribution'}</h3>
                  <p className="text-slate-600 text-sm">{globalDist || '-'}</p>
                </div>
              </div>
            </section>

            {/* Conservation Status - Back to original place */}
            <ConservationStatus species={species} />

            {/* References */}
            {refs && (
              <section className="bg-slate-900 text-slate-300 p-8 rounded-[2.5rem]">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <ExternalLink className="w-5 h-5 text-emerald-400" />
                  {language === 'zh' ? '參考文獻' : 'References'}
                </h2>
                <ul className="space-y-4 text-xs leading-relaxed opacity-80 list-disc pl-5">
                  {refs.split('。/').map((ref, idx) => (
                    <li key={idx}>{ref.trim()}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* 社群討論系統 */}
            <div className="xl:hidden">
              <CongenericExplorer species={species} isMobile={true} />
            </div>
            
            <CommentSection speciesId={species.id} />
          </div>

          {/* Right Column - Sticky Sidebar */}
          <div className="xl:col-span-3 hidden xl:block">
            <div className="sticky top-8 space-y-8">
              {/* Same-Genus Explorer */}
              <CongenericExplorer species={species} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
