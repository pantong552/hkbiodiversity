'use client';

import React from 'react';
import Image from 'next/image';
import { Species } from '@/types/species';
import { PlantSpecies } from '@/types/plants';
import { useLanguage } from '@/context/LanguageContext';
import { Bookmark, Map, ExternalLink, Leaf, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import TaxonomyDisplay from './TaxonomyDisplay';
import ConservationStatus from './ConservationStatus';
import CommentSection from '../comments/CommentSection';
import SpeciesPhotoGallery from './SpeciesPhotoGallery';
import { useInaturalistSpeciesPhotos, InatGalleryPhoto } from '@/hooks/useInaturalistSpeciesPhotos';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useRef } from 'react';
import SpeciesMap, { ObservationChart } from './SpeciesMap';
import GbifGlobalMap from './GbifGlobalMap';
import { formatScientificName, renderFormattedText } from '@/utils/formatters';
import CongenericExplorer from './CongenericExplorer';
import SimilarSpeciesExplorer from './SimilarSpeciesExplorer';
import BirdSoundCard from './BirdSoundCard';
import SpeciesContributionCard from './SpeciesContributionCard';
import HkbihSpeciesCard from './HkbihSpeciesCard';
import { useRouter } from 'next/navigation';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';
import { useTaxonomy } from '@/context/TaxonomyContext';



interface SpeciesContentProps {
  species: Species;
  showBreadcrumb?: boolean;
  refreshTrigger?: number;
  anatomyCard?: React.ReactNode;
}
type SpeciesWithPlantTaxonomy = Species & Partial<Pick<PlantSpecies, 'family_eng' | 'family_chi' | 'genus_eng' | 'genus_chi'>>;
type SpeciesReference = { code: string; zh: string | null; en: string | null; url: string | null };

const SpeciesHeroBackground = ({ photos, defaultImage, isLoading }: { photos: InatGalleryPhoto[], defaultImage: string, isLoading: boolean }) => {
  const [index, setIndex] = React.useState(0);
  const [imgLoaded, setImgLoaded] = React.useState(false);
  const [isFullyReady, setIsFullyReady] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(true);
  const photoSelectionSeed = React.useId();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [lastValidPhotos, setLastValidPhotos] = React.useState<InatGalleryPhoto[]>([]);

  // 1. 隨機挑選最多 5 張相片，固定留在 memory/disk cache 進行輪播
  const selectedPhotos = React.useMemo(() => {
    if (!photos || photos.length === 0) return [];
    if (photos.length <= 5) return photos;
    
    // 使用費雪-葉茲演算法亂數隨機洗牌，挑選前 5 張
    const getPhotoOrder = (photo: InatGalleryPhoto) => {
      const value = `${photoSelectionSeed}:${JSON.stringify(photo)}`;
      let hash = 2166136261;
      for (let i = 0; i < value.length; i++) {
        hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
      }
      return hash >>> 0;
    };
    return [...photos].sort((a, b) => getPhotoOrder(a) - getPhotoOrder(b)).slice(0, 5);
  }, [photos, photoSelectionSeed]);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // 2. 監聽 IntersectionObserver：只在 Hero Banner 在 viewport 可視範圍內才啟用切換計時器
  React.useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 } // 出現 10% 即視為在可視範圍
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Handle seamless transition delay
  React.useEffect(() => {
    if (imgLoaded || (!isLoading && photos.length === 0 && mounted)) {
      const timer = setTimeout(() => setIsFullyReady(true), 300);
      return () => clearTimeout(timer);
    }
  }, [imgLoaded, isLoading, photos.length, mounted]);

  if (selectedPhotos.length > 0 && selectedPhotos !== lastValidPhotos) {
    setLastValidPhotos(selectedPhotos);
  }

  const displayPhotos = selectedPhotos.length > 0 ? selectedPhotos : lastValidPhotos;
  const hasPhotos = displayPhotos.length > 0;

  // 3. 切換定時器：只有當 displayPhotos > 1 且 Hero Banner 在可視範圍內 (isVisible) 才倒數切換
  React.useEffect(() => {
    if (displayPhotos.length <= 1 || !isVisible) return;
    
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % displayPhotos.length);
    }, 20000);
    
    return () => clearInterval(timer);
  }, [displayPhotos.length, isVisible]);

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
    <div ref={containerRef} className="absolute inset-0 z-0 bg-slate-950 overflow-hidden">
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
              onLoad={() => index === 0 && setImgLoaded(true)}
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

export default function SpeciesContent({ species, showBreadcrumb = true, refreshTrigger = 0, anatomyCard }: SpeciesContentProps) {
  const shouldReduceMotion = useReducedMotion();
  const { language } = useLanguage();
  const { getTaxonomyChi } = useTaxonomy();
  const { isLightboxOpen, setPendingTaxonomyFilter, toggleExpand } = useSpeciesPanel();
  const router = useRouter();
  const { photos, isLoading } = useInaturalistSpeciesPhotos(species.inat_id);

  const handleBreadcrumbClick = (levelId: string, value: string, chiValue?: string) => {
    const plant = species as SpeciesWithPlantTaxonomy;
    const isPlantSpecies = species.taxa_group === 'FLORA' || (!species.phylum_eng && !!plant.family_chi);
    const searchValue = isPlantSpecies ? (chiValue || value) : value;
    if (!searchValue) return;

    setPendingTaxonomyFilter({ level: levelId, value: searchValue });
    toggleExpand(false);

    if (typeof window !== 'undefined' && window.location.pathname !== '/database') {
      router.push('/database');
    }
  };


  const [refsList, setRefsList] = React.useState<SpeciesReference[]>([]);
  const [refsLoading, setRefsLoading] = React.useState(false);

  // 載入關聯的參考文獻
  React.useEffect(() => {
    async function fetchReferences() {
      if (!species.reference_codes) {
        setRefsList([]);
        return;
      }
      setRefsLoading(true);
      try {
        const codes = species.reference_codes.split(',').map(c => c.trim()).filter(Boolean);
        if (codes.length === 0) {
          setRefsList([]);
          return;
        }

        const supabase = createClient();
        const { data, error } = await supabase
          .from('references')
          .select('code, zh, en, url')
          .in('code', codes);

        if (!error && data) {
          // 依照 codes 的順序排列文獻
          const sorted = codes.map(code => data.find((r: SpeciesReference) => r.code === code)).filter((item): item is SpeciesReference => Boolean(item));
          setRefsList(sorted);
        }
      } catch (err) {
        console.error('Error fetching references:', err);
      } finally {
        setRefsLoading(false);
      }
    }
    fetchReferences();
  }, [species.reference_codes]);

  const plant = species as SpeciesWithPlantTaxonomy;
  const isPlant = species.taxa_group === 'FLORA' || (!species.phylum_eng && !!plant.family_chi);
  const isFauna = !isPlant && String(species.taxa_group || '').trim().toUpperCase() !== 'FUNGI';
  const taxaType = isPlant ? 'flora' : 'fauna';

  const commonName = language === 'zh' ? species.common_name_chi : species.common_name_eng;
  const description = language === 'zh' ? species.description_chi : species.description_eng;
  const habitat = language === 'zh' ? species.habitat_chi : species.habitat_eng;
  const hostPlants = language === 'zh' ? species.host_plants_chi : species.host_plants_eng;
  const remarks = language === 'zh' ? species.remarks_chi : species.remarks_eng;
  const hkDist = language === 'zh' ? species.hk_distribution_chi : species.hk_distribution_eng;
  const globalDist = language === 'zh' ? species.global_distribution_chi : species.global_distribution_eng;
  const introduction = language === 'zh' ? species.introduction_chi : species.introduction_eng;
  const microhabitat = language === 'zh' ? species.microhabitat_chi : species.microhabitat_eng;
  const detailSections = [
    {
      title: language === 'zh' ? '物種簡介' : 'Introduction',
      content: introduction
    },
    {
      title: language === 'zh' ? '形態特徵' : 'Description',
      content: description
    },
    {
      title: language === 'zh' ? '棲息地' : 'Habitat',
      content: habitat
    },
    {
      title: language === 'zh' ? '微棲地' : 'Microhabitat',
      content: microhabitat
    },
    {
      title: language === 'zh' ? '寄主植物' : 'Host Plants',
      content: hostPlants
    },
    {
      title: language === 'zh' ? '備註' : 'Remarks',
      content: remarks
    }
  ].filter(section => Boolean(section.content?.trim()));
  const detailContentKey = `${species.id ?? species.taxa_id ?? species.scientific_name}`;
  const defaultDetailTab = detailSections.length > 0 ? 'supabase' : 'hkbih';
  const detailTabsId = React.useId();
  const [detailTabSelection, setDetailTabSelection] = React.useState<{
    contentKey: string;
    tab: 'supabase' | 'hkbih';
  }>({ contentKey: detailContentKey, tab: defaultDetailTab });
  const activeDetailTab = detailTabSelection.contentKey === detailContentKey
    ? detailTabSelection.tab
    : defaultDetailTab;

  return (
    <div className="bg-slate-50 min-h-full">
      {/* Breadcrumb Area - Inside Content but below Tabs */}
      {showBreadcrumb && (
        <div className="bg-white/60 backdrop-blur-sm border-b border-slate-100 px-8 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex-wrap">
            {isPlant ? (
              <>
                <span 
                  onClick={() => handleBreadcrumbClick('families', plant.family_eng || '', plant.family_chi)}
                  className="text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer transition-colors"
                >
                  {language === 'zh' ? getTaxonomyChi('family', taxaType, plant.family_eng || '') : plant.family_eng}
                </span>
                <span>/</span>
                <span 
                  onClick={() => handleBreadcrumbClick('genuses', plant.genus_eng || '', plant.genus_chi)}
                  className="hover:text-emerald-600 hover:underline cursor-pointer transition-colors"
                >
                  {language === 'zh' ? getTaxonomyChi('genus', taxaType, plant.genus_eng || '') : plant.genus_eng}
                </span>
              </>
            ) : (
              <>
                <span 
                  onClick={() => handleBreadcrumbClick('phylum_eng', species.phylum_eng)}
                  className="hover:text-emerald-600 hover:underline cursor-pointer transition-colors"
                >
                  {language === 'zh' ? getTaxonomyChi('phylum', taxaType, species.phylum_eng) : species.phylum_eng}
                </span>
                <span>/</span>
                <span 
                  onClick={() => handleBreadcrumbClick('class_eng', species.class_eng)}
                  className="hover:text-emerald-600 hover:underline cursor-pointer transition-colors"
                >
                  {language === 'zh' ? getTaxonomyChi('class', taxaType, species.class_eng) : species.class_eng}
                </span>
                <span>/</span>
                <span 
                  onClick={() => handleBreadcrumbClick('order_eng', species.order_eng)}
                  className="hover:text-emerald-600 hover:underline cursor-pointer transition-colors"
                >
                  {language === 'zh' ? getTaxonomyChi('order', taxaType, species.order_eng) : species.order_eng}
                </span>
                <span>/</span>
                <span 
                  onClick={() => handleBreadcrumbClick('family_eng', species.family_eng)}
                  className="text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer transition-colors"
                >
                  {language === 'zh' ? getTaxonomyChi('family', taxaType, species.family_eng) : species.family_eng}
                </span>
              </>
            )}
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
        
        <div className={`absolute bottom-0 left-0 w-full p-8 md:p-12 z-20 pointer-events-none transition-opacity duration-300 ${isLightboxOpen ? 'opacity-0' : 'opacity-100'}`}>
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
            <section className="rounded-[2rem] sm:rounded-[2.5rem] shadow-sm bg-white p-5 sm:p-8 border border-slate-100">
              <TaxonomyDisplay species={species} />
            </section>

            {/* iNaturalist Photo Gallery */}
            <section className="rounded-[2rem] sm:rounded-[2.5rem] shadow-sm bg-white p-8 border border-slate-100">
              <SpeciesPhotoGallery 
                taxaId={species.taxa_id || ''}
                inatId={species.inat_id || ''} 
                commonName={commonName} 
                scientificName={species.scientific_name}
                galleryImages={species.gallery_images || []}
                galleryImageCredits={species.gallery_image_credits || {}}
                galleryImageMetadata={species.gallery_image_metadata || {}}
              />
            </section>

            {anatomyCard}


            {(detailSections.length > 0 || isFauna) && (
              <section className="rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-100/50 bg-emerald-50 text-emerald-600">
                      <Bookmark className="h-4 w-4 text-emerald-600" />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 sm:text-2xl">
                      {language === 'zh' ? '詳細資料' : 'Species Details'}
                    </h2>
                  </div>
                  {isFauna && (
                    <div
                      className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
                      role="tablist"
                      aria-label={language === 'zh' ? '詳細資料來源' : 'Species detail sources'}
                    >
                      <button
                        id={`${detailTabsId}-supabase-tab`}
                        type="button"
                        role="tab"
                        aria-label={language === 'zh' ? 'HKBC 資料' : 'HKBC data'}
                        aria-selected={activeDetailTab === 'supabase'}
                        aria-controls={`${detailTabsId}-supabase-panel`}
                        onClick={() => setDetailTabSelection({ contentKey: detailContentKey, tab: 'supabase' })}
                        className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-bold transition-all sm:gap-2 sm:px-3 ${
                          activeDetailTab === 'supabase'
                            ? 'bg-white text-emerald-800 shadow-sm ring-1 ring-slate-200/80'
                            : 'text-slate-500 hover:bg-white/70 hover:text-slate-700'
                        }`}
                      >
                        <Image
                          src="/logo.svg"
                          alt=""
                          width={18}
                          height={18}
                          className="h-[18px] w-[18px] shrink-0 object-contain"
                        />
                        <span className="hidden sm:inline">HKBC</span>
                      </button>
                      <button
                        id={`${detailTabsId}-hkbih-tab`}
                        type="button"
                        role="tab"
                        aria-label="HKBIH"
                        aria-selected={activeDetailTab === 'hkbih'}
                        aria-controls={`${detailTabsId}-hkbih-panel`}
                        onClick={() => setDetailTabSelection({ contentKey: detailContentKey, tab: 'hkbih' })}
                        className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-bold transition-all sm:gap-2 sm:px-3 ${
                          activeDetailTab === 'hkbih'
                            ? 'bg-white text-emerald-800 shadow-sm ring-1 ring-slate-200/80'
                            : 'text-slate-500 hover:bg-white/70 hover:text-slate-700'
                        }`}
                      >
                        <Image
                          src="/images/partners/hkbih.webp"
                          alt=""
                          width={20}
                          height={20}
                          className="h-5 w-5 shrink-0 object-contain"
                        />
                        <span className="hidden sm:inline">HKBIH</span>
                      </button>
                    </div>
                  )}
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  {activeDetailTab === 'supabase' ? (
                    <motion.div
                      key="supabase-details"
                      id={`${detailTabsId}-supabase-panel`}
                      role={isFauna ? 'tabpanel' : undefined}
                      aria-labelledby={isFauna ? `${detailTabsId}-supabase-tab` : undefined}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -4 }}
                      transition={{ duration: shouldReduceMotion ? 0.12 : 0.24, ease: 'easeOut' }}
                      className="min-h-20"
                    >
                      {detailSections.length > 0 ? (
                        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                          {detailSections.map(section => (
                            <article key={section.title} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
                              <h3 className="mb-2 text-sm font-black text-slate-800">
                                {section.title}
                              </h3>
                              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                                {section.content}
                              </p>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                          {language === 'zh' ? '暫無本地詳細資料。' : 'No local details are available.'}
                        </p>
                      )}
                    </motion.div>
                  ) : isFauna ? (
                    <motion.div
                      key="hkbih-details"
                      id={`${detailTabsId}-hkbih-panel`}
                      role="tabpanel"
                      aria-labelledby={`${detailTabsId}-hkbih-tab`}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -4 }}
                      transition={{ duration: shouldReduceMotion ? 0.12 : 0.24, ease: 'easeOut' }}
                      className="min-h-20"
                    >
                      <HkbihSpeciesCard
                        scientificName={species.scientific_name}
                        hkbihScientificName={species.hkbih_scientific_name}
                        chineseName={species.common_name_chi}
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </section>
            )}

            {/* Distribution */}
            <section className="space-y-6">
              <h2 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-100/50 flex items-center justify-center text-emerald-600 shrink-0 shadow-xs">
                  <Map className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                </div>
                <span>{language === 'zh' ? '地理分布' : 'Distribution'}</span>
              </h2>
              
              {species.inat_id || species.scientific_name || species.hkbih_scientific_name || species.ebird_species_code ? (
                <SpeciesMap
                  taxonId={species.inat_id ?? 0}
                  scientificName={species.scientific_name}
                  hkbihScientificName={species.hkbih_scientific_name}
                  chineseName={species.common_name_chi}
                  taxaGroup={species.taxa_group}
                  ebirdSpeciesCode={species.ebird_species_code}
                  iucn={species.iucn}
                />
              ) : (
                <div className="rounded-[2rem] sm:rounded-[2.5rem] shadow-sm w-full h-[300px] bg-slate-200 flex items-center justify-center text-slate-500">
                  <p>{language === 'zh' ? '無 iNaturalist ID' : 'No iNaturalist ID available'}</p>
                </div>
              )}

              {/* GBIF 全球分布地圖 */}
              {species.scientific_name && (
                <GbifGlobalMap scientificName={species.scientific_name} />
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <div className="rounded-[2rem] sm:rounded-[2.5rem] shadow-sm bg-white p-6 border border-slate-100">
                  <h3 className="font-black text-slate-800 mb-2">{language === 'zh' ? '香港分布' : 'HK Distribution'}</h3>
                  <p className="text-slate-600 text-sm">{hkDist || '-'}</p>
                </div>
                <div className="rounded-[2rem] sm:rounded-[2.5rem] shadow-sm bg-white p-6 border border-slate-100">
                  <h3 className="font-black text-slate-800 mb-2">{language === 'zh' ? '全球分布' : 'Global Distribution'}</h3>
                  <p className="text-slate-600 text-sm">{globalDist || '-'}</p>
                </div>
              </div>

            </section>

            {/* Temporal Observation Trends Card - Placed above Conservation Status */}
            {(species.inat_id || species.scientific_name || species.hkbih_scientific_name || species.ebird_species_code) && (
              <ObservationChart
                taxonId={species.inat_id ?? 0}
                scientificName={species.scientific_name}
                hkbihScientificName={species.hkbih_scientific_name}
                chineseName={species.common_name_chi}
                ebirdSpeciesCode={species.ebird_species_code}
                isBirdGroup={String(species.taxa_group || '').trim().toUpperCase() === 'BIRD'}
                language={language === 'zh' ? 'zh' : 'en'}
              />
            )}

            {/* Conservation Status */}
            <ConservationStatus species={species} />

            {/* Bird Sound Recordings Card (Xeno-Canto) */}
            {String(species.taxa_group || '').trim().toUpperCase() === 'BIRD' && (
              <BirdSoundCard
                scientificName={species.scientific_name}
                commonName={language === 'zh' ? species.common_name_chi : species.common_name_eng}
              />
            )}

            {/* Similar Species Section */}
            <SimilarSpeciesExplorer species={species} />

            {/* References */}
            {species.reference_codes && (
              <section className="rounded-[2rem] sm:rounded-[2.5rem] shadow-sm bg-slate-900 text-slate-300 p-8">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <ExternalLink className="w-5 h-5 text-emerald-400" />
                  {language === 'zh' ? '參考文獻' : 'References'}
                </h2>
                {refsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>Loading references...</span>
                  </div>
                ) : refsList.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No references found for codes: {species.reference_codes}</p>
                ) : (
                  <ul className="space-y-4 text-xs leading-relaxed opacity-80 list-disc pl-5">
                    {refsList.map((ref, idx) => (
                      <li key={idx} className="leading-relaxed">
                        <span className="align-middle">{renderFormattedText(language === 'zh' ? ref.zh : ref.en)}</span>
                        {ref.url && (
                          <a
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-emerald-400 hover:text-emerald-300 transition-colors ml-1.5 align-middle p-0.5 hover:scale-105"
                            title={language === 'zh' ? '開啟連結' : 'Open Link'}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* 館員修訂歷史與貢獻者表揚卡片 */}
            <SpeciesContributionCard speciesId={String(species.id || species.taxa_id || '')} refreshTrigger={refreshTrigger} />

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
