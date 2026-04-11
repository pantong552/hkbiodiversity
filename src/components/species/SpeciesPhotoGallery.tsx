'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  X, 
  ImageIcon, 
  Loader2,
  Plus,
  ExternalLink,
  Calendar
} from 'lucide-react';
import { useInaturalistSpeciesPhotos, InatGalleryPhoto } from '@/hooks/useInaturalistSpeciesPhotos';
import { useLanguage } from '@/context/LanguageContext';
import EnrichedLightbox from '../ui/EnrichedLightbox';


interface SpeciesPhotoGalleryProps {
  taxonId: number | string;
  commonName?: string;
}

export default function SpeciesPhotoGallery({ 
  taxonId, 
  commonName
}: SpeciesPhotoGalleryProps) {
  const { language } = useLanguage();
  const { photos: fetchedPhotos, isLoading, hasMore, loadMore, dataScope, setScope, hasHkPhotos } = useInaturalistSpeciesPhotos(taxonId);
  
  const handleScopeToggle = () => {
    if (!hasHkPhotos && dataScope === 'global') return;
    setScope(dataScope === 'hongkong' ? 'global' : 'hongkong');
  };
  
  const [photos, setPhotos] = useState<InatGalleryPhoto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const thumbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoading && fetchedPhotos.length === 0) {
      setPhotos([]);
      setCurrentIndex(0);
      return;
    }

    if (fetchedPhotos.length > 0) {
      setPhotos(fetchedPhotos);
    }
  }, [fetchedPhotos, isLoading]);

  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkArrows = () => {
    if (thumbRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = thumbRef.current;
      setShowLeftArrow(scrollLeft > 20);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 20);
    }
  };

  useEffect(() => {
    checkArrows();
    const currentThumbRef = thumbRef.current;
    if (currentThumbRef) {
      currentThumbRef.addEventListener('scroll', checkArrows);

      const handleWheelScroll = (e: WheelEvent) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          currentThumbRef.scrollLeft += e.deltaY;
        }
      };

      currentThumbRef.addEventListener('wheel', handleWheelScroll, { passive: false });
      window.addEventListener('resize', checkArrows);
      
      return () => {
        if (currentThumbRef) {
          currentThumbRef.removeEventListener('scroll', checkArrows);
          currentThumbRef.removeEventListener('wheel', handleWheelScroll);
        }
        window.removeEventListener('resize', checkArrows);
      };
    }
  }, [photos]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!thumbRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - thumbRef.current.offsetLeft);
    setScrollLeft(thumbRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !thumbRef.current) return;
    e.preventDefault();
    const x = e.pageX - thumbRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    thumbRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const scrollByAmount = (amount: number) => {
    if (thumbRef.current) {
      thumbRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const currentPhoto = photos[currentIndex];

  const handleNext = () => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  useEffect(() => {
    if (thumbRef.current && !isDragging) {
      const activeThumb = thumbRef.current.children[currentIndex] as HTMLElement;
      if (activeThumb) {
        const containerWidth = thumbRef.current.offsetWidth;
        const thumbOffset = activeThumb.offsetLeft;
        const thumbWidth = activeThumb.offsetWidth;
        
        thumbRef.current.scrollTo({
          left: thumbOffset - (containerWidth / 2) + (thumbWidth / 2),
          behavior: 'smooth'
        });
      }
    }
  }, [currentIndex]);

  if (isLoading && photos.length === 0) {
    return (
      <div className="w-full h-[500px] flex items-center justify-center bg-slate-100 rounded-[2.5rem] border border-slate-200">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (photos.length === 0 && !isLoading) {
    return (
      <div className="w-full p-12 flex flex-col items-center justify-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 text-slate-400">
        <ImageIcon className="w-12 h-12 mb-4 opacity-20" />
        <p className="font-medium">
          {language === 'zh' ? '暫無野外觀察照片' : 'No field observations found'}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
          <ImageIcon className="w-6 h-6 text-emerald-500" />
          {language === 'zh' ? '野外觀察相片' : 'Field Observations'}
        </h2>
        <div className="relative">
          <button 
            onClick={handleScopeToggle}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            disabled={isLoading || (!hasHkPhotos && dataScope === 'global')}
            className={`flex items-center gap-2 bg-white/50 backdrop-blur-sm border ${dataScope === 'global' ? (hasHkPhotos ? 'border-blue-200 hover:border-blue-300' : 'border-slate-200 opacity-70') : 'border-emerald-200 hover:border-emerald-300'} pl-2 pr-3 py-1.5 rounded-2xl shadow-sm hover:shadow-md transition-all group cursor-pointer disabled:cursor-not-allowed`}
          >
            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm overflow-hidden relative group-hover:scale-105 transition-transform">
              <Image 
                src="/INaturalist_logo.svg" 
                alt="iNaturalist" 
                fill 
                className="object-contain p-1"
              />
            </div>
            <div className="flex flex-col items-start pr-1">
              <span className="text-[10px] font-black text-slate-700 tracking-wider leading-none">iNaturalist</span>
              <span className={`text-[8px] font-bold tracking-tight leading-none mt-1 uppercase transition-colors duration-500 flex items-center gap-1 ${dataScope === 'global' ? 'text-blue-600' : 'text-emerald-600'}`}>
                {dataScope === 'global' ? 'Global • Research Grade' : 'Hong Kong • Research Grade'}
                <span className={`inline-block w-1 h-1 rounded-full ${dataScope === 'global' ? 'bg-blue-600/50' : 'bg-emerald-600/50'} animate-pulse`}></span>
              </span>
            </div>
          </button>

          <AnimatePresence>
            {showTooltip && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 w-48 p-3 bg-slate-900 text-white rounded-xl shadow-xl z-50 pointer-events-none"
              >
                <div className="text-[11px] leading-relaxed font-medium">
                  {!hasHkPhotos && dataScope === 'global' ? (
                    <span className="text-amber-400 flex items-center gap-1.5">
                      {language === 'zh' 
                        ? '此物種目前在香港暫無紀錄，已自動切換至全球模式。' 
                        : 'No records in HK yet. Auto-switched to Global mode.'}
                    </span>
                  ) : (
                    <span>
                      {language === 'zh' 
                        ? `點擊以切換 ${dataScope === 'hongkong' ? '全球探索' : '香港本土'} 模式`
                        : `Click to switch to ${dataScope === 'hongkong' ? 'Global' : 'Local HK'} mode`}
                    </span>
                  )}
                </div>
                <div className="absolute -top-1 right-6 w-2 h-2 bg-slate-900 rotate-45" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        <div className="relative aspect-[16/10] bg-slate-900 rounded-[2.5rem] overflow-hidden group shadow-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPhoto?.id}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0"
            >
              <Image
                src={currentPhoto?.large_url}
                alt={commonName || 'Species observation'}
                fill
                className="object-cover"
                sizes="(max-w-1280px) 100vw, 1280px"
              />
            </motion.div>
          </AnimatePresence>

          <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
            <div className="flex items-end justify-between">
              <div className="flex flex-col items-start gap-1">
                {/* (2) Observation Date Above Credit */}
                {currentPhoto?.observedOn && (
                  <p className="text-white/70 text-[10px] drop-shadow-md flex items-center gap-1.5 tracking-wider uppercase font-medium">
                    <Calendar className="w-3 h-3" />
                    {new Date(currentPhoto.observedOn).toLocaleDateString(language === 'zh' ? 'zh-HK' : 'en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <p className="text-white font-medium text-sm drop-shadow-md">
                    {currentPhoto?.attribution}
                  </p>
                  {currentPhoto?.observationUrl && (
                    <a 
                      href={currentPhoto.observationUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-1.5 bg-white/10 hover:bg-emerald-500 rounded-lg text-white transition-all backdrop-blur-md border border-white/20 active:scale-95"
                      title="View on iNaturalist"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setIsLightboxOpen(true)}
                className="p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white hover:bg-emerald-500 transition-all group-hover:scale-110 active:scale-95 shadow-lg"
              >
                <Maximize2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          <button 
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className={`absolute left-4 top-1/2 -translate-y-1/2 p-4 rounded-full backdrop-blur-md border border-white/20 text-white transition-all shadow-xl ${currentIndex === 0 ? 'opacity-0 scale-50 pointer-events-none' : 'opacity-80 hover:opacity-100 hover:bg-white/20 active:scale-90'}`}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button 
            onClick={handleNext}
            disabled={currentIndex === photos.length - 1}
            className={`absolute right-4 top-1/2 -translate-y-1/2 p-4 rounded-full backdrop-blur-md border border-white/20 text-white transition-all shadow-xl ${currentIndex === photos.length - 1 ? 'opacity-0 scale-50 pointer-events-none' : 'opacity-80 hover:opacity-100 hover:bg-white/20 active:scale-90'}`}
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          <div className="absolute top-6 right-6">
            <span className="px-4 py-2 bg-black/40 backdrop-blur-md border border-white/20 rounded-full text-white text-[10px] font-black tracking-widest">
              {currentIndex + 1} / {photos.length}
            </span>
          </div>
        </div>

        <div className="relative group/thumbs">
          <AnimatePresence>
            {showLeftArrow && (
              <motion.button
                key="left-arrow-btn"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onClick={() => scrollByAmount(-300)}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/80 backdrop-blur-md border border-slate-200 rounded-full shadow-lg text-slate-600 hover:text-emerald-500 transition-all -translate-x-1/2"
              >
                <ChevronLeft className="w-5 h-5" />
              </motion.button>
            )}
            {showRightArrow && (
              <motion.button
                key="right-arrow-btn"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onClick={() => scrollByAmount(300)}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/80 backdrop-blur-md border border-slate-200 rounded-full shadow-lg text-slate-600 hover:text-emerald-500 transition-all translate-x-1/2"
              >
                <ChevronRight className="w-5 h-5" />
              </motion.button>
            )}
          </AnimatePresence>

          <div className={`absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-slate-50 to-transparent z-[1] pointer-events-none transition-opacity duration-300 ${showLeftArrow ? 'opacity-100' : 'opacity-0'}`} />
          <div className={`absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-slate-50 to-transparent z-[1] pointer-events-none transition-opacity duration-300 ${showRightArrow ? 'opacity-100' : 'opacity-0'}`} />

          <div 
            ref={thumbRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`flex gap-4 overflow-x-auto pb-4 pt-4 no-scrollbar scroll-smooth px-2 items-center cursor-grab active:cursor-grabbing ${isDragging ? 'select-none' : ''}`}
          >
            {photos.map((photo, index) => (
              <button
                key={photo.id || `photo-idx-${index}`}
                onClick={() => !isDragging && setCurrentIndex(index)}
                className={`relative flex-shrink-0 w-24 aspect-square rounded-2xl overflow-hidden transition-all duration-300 ${index === currentIndex ? 'ring-4 ring-emerald-500 ring-offset-4 ring-offset-slate-50 scale-105 shadow-xl' : 'opacity-60 hover:opacity-100'}`}
              >
                <Image
                  src={photo.small_url || photo.url}
                  alt="Thumb"
                  fill
                  className="object-cover pointer-events-none"
                />
              </button>
            ))}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={isLoading}
                className="flex-shrink-0 w-24 aspect-square rounded-2xl bg-white border-2 border-dashed border-emerald-200 flex flex-col items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-all group active:scale-95 gap-1 shadow-sm"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    {/* (1) + 更多 Text */}
                    <span className="text-[10px] font-bold uppercase tracking-tight">
                      {language === 'zh' ? '更多' : 'More'}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <EnrichedLightbox 
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        photos={photos}
        currentIndex={currentIndex}
        onNavigate={(index) => setCurrentIndex(index)}
        commonName={commonName}
        language={language}
      />

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  );
}
