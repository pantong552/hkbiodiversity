'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronUp, ChevronDown, Loader2, Share2, Check } from 'lucide-react';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabase';
import { Species } from '@/types/species';
import SpeciesContent from './SpeciesContent';
import { useShare } from '@/hooks/useShare';

export default function SpeciesFloatingPanel() {
  const { 
    openSpeciesIds, 
    activeSpeciesId, 
    isExpanded, 
    removeSpecies, 
    setActiveSpecies, 
    toggleExpand 
  } = useSpeciesPanel();
  
  const { language } = useLanguage();
  const [speciesData, setSpeciesData] = useState<Record<number, Species>>({});
  const [isLoading, setIsLoading] = useState<Record<number, boolean>>({});
  const [showHeaderSpace, setShowHeaderSpace] = useState(true);
  const lastScrollYRef = useRef(0);
  const { share, isCopied } = useShare();

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeSpeciesId || !speciesData[activeSpeciesId]) return;
    
    const species = speciesData[activeSpeciesId];
    const commonName = language === 'zh' ? species.common_name_chi : species.common_name_eng;
    
    // 生成物種首頁代參數連結，確保開啟完整環境
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${baseUrl}/?species=${activeSpeciesId}`;
    
    share({
      title: `${commonName} | HK Biodiversity`,
      text: `在香港生物多樣性圖鑑查看 ${commonName} (${species.scientific_name}) 的詳細資料`,
      url: shareUrl
    });
  };

  // 1. Fetch data for new IDs
  useEffect(() => {
    openSpeciesIds.forEach(async (id) => {
      if (!speciesData[id] && !isLoading[id]) {
        setIsLoading(prev => ({ ...prev, [id]: true }));
        try {
          const { data, error } = await supabase
            .from('species')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          
          if (data) {
            setSpeciesData(prev => ({ ...prev, [id]: data as Species }));
          }
        } catch (err) {
          console.error(`Failed to fetch species ${id}:`, err);
        } finally {
          setIsLoading(prev => ({ ...prev, [id]: false }));
        }
      }
    });
  }, [openSpeciesIds, speciesData, isLoading, supabase]);

  // 2. Prevent Background Scroll & Double Scrollbar
  useEffect(() => {
    if (isExpanded && activeSpeciesId) {
      // 獲取捲動軸寬度，防止 body 鎖定時頁面抖動
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [isExpanded, activeSpeciesId]);

  // 3. Sync Header Space with Scroll
  useEffect(() => {
    if (!isExpanded) {
      setShowHeaderSpace(true);
      return;
    }

    const handleScroll = () => {
      const container = document.getElementById('species-panel-scroll-container');
      if (!container) return;

      const currentScrollY = container.scrollTop;
      const deltaY = currentScrollY - lastScrollYRef.current;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;

      // 當接近頂部時，強制顯示
      if (currentScrollY <= 50) {
        setShowHeaderSpace(true);
      } 
      // 底部保護：防止快速滑到底部回彈時產生的抖動
      else if (currentScrollY + clientHeight >= scrollHeight - 30) {
        setShowHeaderSpace(false);
      }
      // 引入閾值 (Tolerance)：捲動超過 10px 才觸發狀態切換，減少高頻抖動
      else if (Math.abs(deltaY) > 10) {
        if (deltaY > 0 && currentScrollY > 100) {
          setShowHeaderSpace(false);
        } else if (deltaY < 0) {
          setShowHeaderSpace(true);
        }
        lastScrollYRef.current = currentScrollY;
      }
    };

    const container = document.getElementById('species-panel-scroll-container');
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
    }

    // 當重新進入或切換物種時，根據當前位置初始化
    handleScroll();

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, [isExpanded, activeSpeciesId]);

  if (openSpeciesIds.length === 0) return null;

  return (
    <motion.div 
      initial={false}
      animate={{ 
        height: isExpanded ? '100dvh' : '56px',
        y: 0
      }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed bottom-0 left-0 w-full z-50 bg-white border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col pointer-events-auto"
    >
      {/* Header Safe Area - Dynamically adjusts with scroll */}
      <AnimatePresence>
        {isExpanded && showHeaderSpace && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ 
              height: 'auto', 
              opacity: 1,
            }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="w-full shrink-0 bg-white/80 backdrop-blur-xl overflow-hidden"
          >
            <div className="h-24 md:h-28 lg:h-32 w-full" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control Bar / Tab Bar (Always at the top of the container) */}
      <div className="w-full h-14 shrink-0 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
          {openSpeciesIds.map((id) => {
            const species = speciesData[id];
            const isActive = activeSpeciesId === id;
            const loading = isLoading[id];
            
            return (
              <div 
                key={id}
                onClick={() => {
                  setActiveSpecies(id);
                  if (!isExpanded) toggleExpand(true);
                }}
                className={`
                  group flex items-center gap-3 px-4 py-2 rounded-xl border transition-all cursor-pointer whitespace-nowrap
                  ${isActive 
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-200' 
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}
                `}
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span className={`text-xs font-black ${species && !(language === 'zh' ? species.common_name_chi : species.common_name_eng) ? 'italic' : ''}`}>
                    {species ? (
                      (language === 'zh' ? species.common_name_chi : species.common_name_eng) || species.scientific_name
                    ) : `ID: ${id}`}
                  </span>
                )}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSpecies(id);
                  }}
                  className={`
                    p-1 rounded-md transition-colors
                    ${isActive ? 'hover:bg-white/20 text-white' : 'hover:bg-slate-200 text-slate-400'}
                  `}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-4 relative">
          {/* Toast Notification for Floating Panel */}
          <AnimatePresence>
            {isCopied && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="absolute bottom-full mb-4 right-0 z-[100] whitespace-nowrap bg-slate-900/90 backdrop-blur-xl text-white px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 border border-white/10"
              >
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Check className="w-3 h-3" />
                </div>
                <span className="text-[11px] font-bold tracking-wide">
                  {language === 'zh' ? '連結已複製' : 'Link copied'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Share Button */}
          <button 
            onClick={handleShare}
            title={language === 'zh' ? '分享此物種' : 'Share species'}
            className={`
              p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center
              ${activeSpeciesId 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 hover:-translate-y-0.5 active:scale-95' 
                : 'bg-slate-100 text-slate-300 cursor-not-allowed opacity-50'}
            `}
          >
            <Share2 className="w-5 h-5" />
          </button>

          <button 
            onClick={() => toggleExpand()}
            className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg hover:scale-105 transition-transform active:scale-95"
          >
            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Panel Content (Only visible when expanded) */}
      <div id="species-panel-scroll-container" className="flex-1 overflow-y-auto no-scrollbar bg-slate-50">
        <AnimatePresence mode="wait">
          {isExpanded && activeSpeciesId && (
            <motion.div
              key={activeSpeciesId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {speciesData[activeSpeciesId] ? (
                <SpeciesContent species={speciesData[activeSpeciesId]} showBreadcrumb={true} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center">
                  <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                    {language === 'zh' ? '正在載入物種詳情...' : 'Loading species details...'}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
