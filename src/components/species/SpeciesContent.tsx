'use client';

import React from 'react';
import Image from 'next/image';
import { Species } from '@/types/species';
import { useLanguage } from '@/context/LanguageContext';
import { Bookmark, Map, ExternalLink, Shield, Image as ImageIcon, Leaf } from 'lucide-react';
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

const SpeciesHeroBackground = ({ photos, defaultImage, isLoading }: { photos: InatGalleryPhoto[], defaultImage: string, isLoading: boolean }) => {
  const [index, setIndex] = React.useState(0);
  const [imgLoaded, setImgLoaded] = React.useState(false);
  const [isFullyReady, setIsFullyReady] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  
  // Use a ref to keep track of the last valid photos to prevent flickering during scope fallback
  const lastValidPhotosRef = useRef<InatGalleryPhoto[]>([]);
  
  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle seamless transition delay
  React.useEffect(() => {
    // If we have photos and the first one is loaded, or if we fell back to default image already
    if (imgLoaded || (!isLoading && photos.length === 0 && mounted)) {
      const timer = setTimeout(() => setIsFullyReady(true), 300);
      return () => clearTimeout(timer);
    }
  }, [imgLoaded, isLoading, photos.length, mounted]);

  
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

  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="absolute inset-0 z-0 bg-slate-950 overflow-hidden">
      {/* Background Image Layer */}
      <AnimatePresence mode="wait">
        <motion.div
          key={hasPhotos ? `hero-${displayPhotos[index].id}` : (isLoading ? 'loading-state' : 'default-bg')}
          initial={{ opacity: 0 }}
          animate={{ opacity: (imgLoaded || (!isLoading && !hasPhotos)) ? 1 : 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {/* Background Image */}
          {(hasPhotos || (!isLoading && !hasPhotos)) && (
            <Image 
              src={hasPhotos ? (isMobile ? (displayPhotos[index].medium_url || displayPhotos[index].url) : (displayPhotos[index].large_url || displayPhotos[index].url)) : defaultImage} 
              alt="Species background"
              fill
              sizes="100vw"
              onLoadingComplete={() => index === 0 && setImgLoaded(true)}
              unoptimized={hasPhotos ? (isMobile ? (displayPhotos[index].medium_url || displayPhotos[index].url) : (displayPhotos[index].large_url || displayPhotos[index].url)).includes('/api/image/transform') : defaultImage.includes('/api/image/transform')}
              className="object-cover opacity-70"
              priority={index === 0}
            />
          )}
          
          {/* Individual Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent z-10" />

          {/* Dynamic Photo Credit Layer (Inside AnimatePresence for individual photo fade) */}
          {hasPhotos && (
            <div 
              className="absolute top-6 md:top-auto right-6 md:right-8 md:bottom-6 z-30 flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 hover:bg-black/60 transition-colors group cursor-default pointer-events-auto"
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

      {/* Global Nature Loader Overlay (Seamless Transition, outside AnimatePresence to be persistent) */}
      {!isFullyReady && (
        <div className={`
          absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-50 overflow-hidden
          transition-all duration-700 ease-in-out
          ${imgLoaded ? 'opacity-0 scale-105 blur-lg' : 'opacity-100 scale-100 blur-0'}
        `}>
          {/* Spinning Rings */}
          <div className="relative w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 border-t-2 border-emerald-500/30 border-r-2 border-emerald-500/10 rounded-full animate-spin duration-[1500ms]"></div>
            <div className="absolute inset-4 border-b-2 border-emerald-500/40 border-l-2 border-emerald-500/5 rounded-full animate-spin-reverse duration-[2000ms]"></div>
            
            {/* Pulsing Leaf Center */}
            <div className="relative bg-slate-900 p-4 rounded-full shadow-2xl shadow-emerald-900/50 animate-pulse border border-emerald-500/20">
              <Leaf className="w-8 h-8 text-emerald-400 fill-emerald-500/20" />
            </div>
          </div>
          
          {/* Dot Animation */}
          <div className="mt-8 flex flex-col items-center gap-3">
            <span className="text-xs font-black uppercase tracking-[0.4em] text-emerald-400/30">Capturing Essence</span>
            <span className="flex gap-2">
              <span className="w-2 h-2 bg-emerald-500/60 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-2 h-2 bg-emerald-500/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-2 h-2 bg-emerald-500/60 rounded-full animate-bounce"></span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default function SpeciesContent({ species, showBreadcrumb = true }: SpeciesContentProps) {
  const { language } = useLanguage();
  const { photos, isLoading } = useInaturalistSpeciesPhotos(species.inat_id);
  const [currentProfilePic, setCurrentProfilePic] = React.useState(species.profile_picture);

  // 當傳入的 species 改變時重置狀態
  React.useEffect(() => {
    setCurrentProfilePic(species.profile_picture);
  }, [species.taxa_id, species.profile_picture]);

  const commonName = language === 'zh' ? species.common_name_chi : species.common_name_eng;
  const description = language === 'zh' ? species.description_chi : species.description_eng;
  const habitat = language === 'zh' ? species.habitat_chi : species.habitat_eng;
  const hostPlants = language === 'zh' ? species.host_plants_chi : species.host_plants_eng;
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
          defaultImage={'/images/placeholder/no-species-image.svg'} 
          isLoading={isLoading}
        />
        
        <div className="absolute bottom-0 left-0 w-full p-8 md:p-12 z-20 pointer-events-none">
          <div className="max-w-7xl mx-auto pointer-events-auto">
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
            <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <SpeciesPhotoGallery 
                taxaId={species.taxa_id || ''}
                inatId={species.inat_id || ''} 
                commonName={commonName || species.scientific_name} 
                profilePicture={currentProfilePic}
                onProfilePictureUpdate={setCurrentProfilePic}
              />
            </section>


            {/* Description */}
            {(description || habitat || hostPlants) && (
              <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 divide-y divide-slate-50">
                {description && (
                  <div className="pb-8">
                    <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                      <Bookmark className="w-6 h-6 text-emerald-500" />
                      {language === 'zh' ? '形態特徵' : 'Description'}
                    </h2>
                    <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed">
                      <p>{description}</p>
                    </div>
                  </div>
                )}

                {habitat && (
                  <div className="py-8">
                    <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                      <Map className="w-6 h-6 text-emerald-500" />
                      {language === 'zh' ? '棲息地' : 'Habitat'}
                    </h2>
                    <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed">
                      <p>{habitat}</p>
                    </div>
                  </div>
                )}

                {hostPlants && (
                  <div className="pt-8">
                    <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                      <Leaf className="w-6 h-6 text-emerald-500" />
                      {language === 'zh' ? '寄主植物' : 'Host Plants'}
                    </h2>
                    <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed">
                      <p>{hostPlants}</p>
                    </div>
                  </div>
                )}
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
              
              {species.inat_id ? (
                <SpeciesMap taxonId={species.inat_id} />
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
            
            <CommentSection taxaId={species.taxa_id || ''} />
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
