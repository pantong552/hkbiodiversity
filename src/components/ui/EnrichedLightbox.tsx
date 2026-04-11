'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Download, 
  Play, 
  Pause, 
  Maximize,
  Minimize,
  Info,
  Calendar,
  ExternalLink,
  Loader2
} from 'lucide-react';
import Image from 'next/image';
import { InatGalleryPhoto } from '@/hooks/useInaturalistSpeciesPhotos';

interface EnrichedLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  photos: InatGalleryPhoto[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  commonName?: string;
  language?: 'zh' | 'en';
}

export default function EnrichedLightbox({
  isOpen,
  onClose,
  photos,
  currentIndex,
  onNavigate,
  commonName,
  language = 'zh'
}: EnrichedLightboxProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isAutoplay, setIsAutoplay] = useState(false);
  const [autoplayProgress, setAutoplayProgress] = useState(0);
  const [showUI, setShowUI] = useState(true);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const uiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  const currentPhoto = photos[currentIndex];

  // 重置縮放與位置
  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // 切換圖片時重置
  useEffect(() => {
    resetZoom();
    setIsImageLoading(true);
  }, [currentIndex, resetZoom]);

  // 控制導覽
  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1);
    } else {
      onNavigate(photos.length - 1); // 循環
    }
  }, [currentIndex, onNavigate, photos.length]);

  const handleNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      onNavigate(currentIndex + 1);
    } else {
      onNavigate(0); // 循環
    }
  }, [currentIndex, onNavigate, photos.length]);

  // 工具功能：縮放
  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.5, 5));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.5, 1));

  // 鍵盤支援
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': onClose(); break;
        case 'ArrowLeft': handlePrev(); break;
        case 'ArrowRight': handleNext(); break;
        case '+': case '=': handleZoomIn(); break;
        case '-': case '_': handleZoomOut(); break;
        case '0': resetZoom(); break;
        case ' ': 
          e.preventDefault();
          setIsAutoplay(prev => !prev); 
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext, resetZoom]);

  // 自動播放邏輯
  useEffect(() => {
    if (isAutoplay && isOpen) {
      const interval = 5000; // 5秒一跳
      const step = 100;
      const progressIncrement = (step / interval) * 100;

      autoplayTimerRef.current = setInterval(() => {
        setAutoplayProgress(prev => {
          if (prev >= 100) {
            handleNext();
            return 0;
          }
          return prev + progressIncrement;
        });
      }, step);
    } else {
      if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current);
      setAutoplayProgress(0);
    }

    return () => {
      if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current);
    };
  }, [isAutoplay, isOpen, handleNext]);

  // UI 自動隱藏邏輯
  const handleMouseMove = useCallback(() => {
    setShowUI(true);
    if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
    uiTimeoutRef.current = setTimeout(() => {
      if (scale === 1 && !isAutoplay) { // 只有在沒縮放且沒自動播放時才自動隱藏，或者您可以自定義規則
        // setShowUI(false); 
      }
    }, 3000);
  }, [scale, isAutoplay]);

  // 處理下載
  const handleDownload = () => {
    if (!currentPhoto?.original_url) return;
    const link = document.createElement('a');
    link.href = currentPhoto.original_url;
    link.download = `species-photo-${currentPhoto.id}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 處理全螢幕
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // 滾輪縮放邏輯
  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  // Pinch to Zoom (行動裝置)
  const touchStartDistRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(1);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      touchStartDistRef.current = dist;
      initialScaleRef.current = scale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const ratio = dist / touchStartDistRef.current;
      const newScale = Math.min(Math.max(initialScaleRef.current * ratio, 1), 5);
      setScale(newScale);
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseMove={handleMouseMove}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/98 backdrop-blur-2xl select-none overflow-hidden touch-none"
      >
        {/* 背景裝飾：模糊的當前圖片 */}
        <div className="absolute inset-0 opacity-20 blur-3xl scale-110 pointer-events-none">
          <Image 
            src={currentPhoto?.large_url || ''} 
            alt="" 
            fill 
            className="object-cover" 
          />
        </div>

        {/* 頂部工具列 */}
        <motion.div 
          animate={{ y: showUI ? 0 : -100, opacity: showUI ? 1 : 0 }}
          className="absolute top-0 left-0 right-0 z-[120] p-4 md:p-6 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
             <div className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl flex items-center gap-3">
                <span className="text-white/40 text-xs font-black tracking-tighter w-8">
                  {(currentIndex + 1).toString().padStart(2, '0')}
                </span>
                <div className="w-px h-3 bg-white/10" />
                <span className="text-white/40 text-xs font-black tracking-tighter w-8 text-right">
                  {photos.length.toString().padStart(2, '0')}
                </span>
             </div>
             {scale > 1 && (
               <motion.div 
                 initial={{ scale: 0.8, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 className="px-3 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-[10px] font-black tracking-widest uppercase"
               >
                 Zoom {Math.round(scale * 100)}%
               </motion.div>
             )}
          </div>

          <div className="flex items-center gap-2 md:gap-3 bg-black/20 backdrop-blur-xl p-1.5 rounded-[1.5rem] border border-white/5 shadow-2xl">
            <button 
              onClick={() => setIsAutoplay(!isAutoplay)}
              className={`p-2.5 rounded-xl transition-all relative overflow-hidden ${isAutoplay ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
              title="Autoplay"
            >
              {isAutoplay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              {isAutoplay && (
                <div className="absolute bottom-0 left-0 h-0.5 bg-white/40 transition-none" style={{ width: `${autoplayProgress}%` }} />
              )}
            </button>
            <div className="w-px h-4 bg-white/5" />
            <button onClick={handleZoomOut} className="p-2.5 text-white/70 hover:bg-white/10 hover:text-white rounded-xl transition-all"><ZoomOut className="w-4 h-4" /></button>
            <button onClick={handleZoomIn} className="p-2.5 text-white/70 hover:bg-white/10 hover:text-white rounded-xl transition-all"><ZoomIn className="w-4 h-4" /></button>
            <button onClick={resetZoom} className="p-2.5 text-white/70 hover:bg-white/10 hover:text-white rounded-xl transition-all" title="Reset"><RotateCcw className="w-4 h-4" /></button>
            <div className="w-px h-4 bg-white/5" />
            <button onClick={handleDownload} className="p-2.5 text-white/70 hover:bg-white/10 hover:text-white rounded-xl transition-all" title="Download Original"><Download className="w-4 h-4" /></button>
            <button onClick={toggleFullscreen} className="p-2.5 text-white/70 hover:bg-white/10 hover:text-white rounded-xl transition-all" title="Toggle Fullscreen">{isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}</button>
            <div className="w-px h-4 bg-white/5" />
            <button 
              onClick={onClose}
              className="p-2.5 text-white/70 hover:bg-red-500 hover:text-white rounded-xl transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* 主圖片顯示區 */}
        <div 
          className="relative w-full h-full flex items-center justify-center"
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {isImageLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin opacity-40" />
            </div>
          )}

          <motion.div
            key={currentIndex}
            drag={scale > 1}
            dragConstraints={scale > 1 ? undefined : { left: 0, right: 0, top: 0, bottom: 0 }}
            animate={{ 
              scale: scale,
              x: position.x,
              y: position.y
            }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onDragEnd={(_, info) => {
               // 這裡可以加入邊界檢查，防止圖片飛出去
               // 暫時保持靈活
            }}
            className="relative w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
            onDoubleClick={resetZoom}
          >
            <Image
              src={currentPhoto?.original_url || currentPhoto?.large_url || ''}
              alt={commonName || 'Observation'}
              fill
              priority
              className="object-contain pointer-events-none p-4 md:p-12 lg:p-20 transition-opacity duration-300"
              sizes="100vw"
              onLoad={() => setIsImageLoading(false)}
            />
          </motion.div>

          {/* 側邊導覽按鈕 */}
          {scale === 1 && (
            <>
              <motion.button 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: showUI ? 0 : -50, opacity: showUI ? 1 : 0 }}
                onClick={handlePrev}
                className="absolute left-4 md:left-8 p-4 md:p-6 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/5 rounded-full text-white/40 hover:text-white transition-all group z-[110]"
              >
                <ChevronLeft className="w-8 h-8 group-hover:-translate-x-1 transition-transform" />
              </motion.button>
              <motion.button 
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: showUI ? 0 : 50, opacity: showUI ? 1 : 0 }}
                onClick={handleNext}
                className="absolute right-4 md:right-8 p-4 md:p-6 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/5 rounded-full text-white/40 hover:text-white transition-all group z-[110]"
              >
                <ChevronRight className="w-8 h-8 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </>
          )}
        </div>

        {/* 底部資訊欄 */}
        <motion.div 
          animate={{ y: showUI ? 0 : 100, opacity: showUI ? 1 : 0 }}
          className="absolute bottom-0 left-0 right-0 z-[120] p-6 md:p-8 pointer-events-none"
        >
          <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
             <div className="flex flex-col items-center gap-1.5 p-5 bg-black/40 backdrop-blur-2xl rounded-[2rem] border border-white/10 pointer-events-auto shadow-2xl">
                <h3 className="text-white text-lg md:text-xl font-black tracking-tight flex items-center gap-3">
                  {commonName}
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] rounded-lg border border-emerald-500/20">Research Grade</span>
                </h3>
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-white/50 text-xs font-medium">
                  <span className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5" />
                    {currentPhoto?.attribution}
                  </span>
                  {currentPhoto?.observedOn && (
                    <span className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(currentPhoto.observedOn).toLocaleDateString(language === 'zh' ? 'zh-HK' : 'en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                  )}
                  {currentPhoto?.observationUrl && (
                    <a 
                      href={currentPhoto.observationUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      iNaturalist
                    </a>
                  )}
                </div>
             </div>
          </div>
        </motion.div>

        {/* 底部縮圖進度條 (可選，這裡用簡單的小點表示) */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-[130] pointer-events-none">
          {photos.length < 20 && photos.map((_, idx) => (
            <div 
              key={idx} 
              className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-6 bg-emerald-500' : 'w-1.5 bg-white/20'}`}
            />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
