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
import { useInaturalistPhoto } from '@/hooks/useInaturalistPhoto';

// --- Subcomponent: Species Tab Preview (Tooltip) ---
function SpeciesTabPreview({ 
  id, 
  species, 
  language, 
  visible,
  xOffset = 0
}: { 
  id: string, 
  species: Species | null, 
  language: string, 
  visible: boolean,
  xOffset?: number
}) {
  const { imageUrl, isLoading } = useInaturalistPhoto(species?.inat_id || undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [shiftX, setShiftX] = useState(0);

  // 防溢邏輯：當 Tooltip 靠近邊緣時自動位移
  useEffect(() => {
    if (visible && typeof window !== 'undefined') {
      const timer = setTimeout(() => {
        const tooltipWidth = 224; // w-56 = 14rem = 224px
        const margin = 16; // 安全邊距
        
        // xOffset 是分頁中心點在容器內的位置
        // 我們預設是以 -translate-x-1/2 對齊中心
        const leftEdge = xOffset - (tooltipWidth / 2);
        const rightEdge = xOffset + (tooltipWidth / 2);
        
        let shift = 0;
        if (leftEdge < margin) {
          shift = margin - leftEdge;
        } else if (rightEdge > window.innerWidth - margin) {
          shift = (window.innerWidth - margin) - rightEdge;
        }
        setShiftX(shift);
      }, 0);
      return () => clearTimeout(timer);
    } else {
      setShiftX(0);
    }
  }, [visible, xOffset]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          style={{ 
            left: xOffset,
            x: `calc(-50% + ${shiftX}px)`
          }}
          className="hidden md:block absolute bottom-[calc(100%+16px)] z-[9999] pointer-events-none"
        >
          <div className="w-56 overflow-hidden rounded-3xl bg-white border border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.2)] ring-1 ring-black/5 flex flex-col">
            {/* Visual Header / Photo */}
            <div className="relative h-32 w-full bg-slate-100 overflow-hidden">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                </div>
              ) : imageUrl ? (
                <img 
                  src={imageUrl} 
                  alt={species?.common_name_chi || 'Species'} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                  <img 
                    src="/images/placeholder/no-species-image.svg" 
                    alt="No species image" 
                    className="w-full h-full object-cover opacity-80"
                  />
                </div>
              )}
              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              {/* Group Badge */}
              {species && (
                <div className="absolute bottom-3 left-3 px-2 py-0.5 bg-emerald-500 text-white rounded-lg text-[8px] font-black tracking-widest uppercase">
                  {species.taxa_group}
                </div>
              )}
            </div>

            {/* Info Area */}
            <div className="p-4 flex flex-col gap-1">
              <h4 className="text-sm font-black text-slate-900 leading-tight">
                {species ? (
                  (language === 'zh' ? species.common_name_chi : species.common_name_eng) || species.scientific_name
                ) : 'Loading...'}
              </h4>
              {species && (
                <p className="text-[10px] font-medium text-slate-500 italic leading-none whitespace-normal">
                  {species.scientific_name}
                </p>
              )}
              {species && (
                <div className="mt-2 flex items-center gap-1.5 opacity-60">
                   <div className="w-1 h-1 rounded-full bg-slate-400" />
                   <span className="text-[8px] font-bold uppercase tracking-widest">
                     {language === 'zh' ? species.family_chi : species.family_eng}
                   </span>
                </div>
              )}
            </div>
          </div>
          {/* Arrow - 指示位置需補償 shift 的位移以保持準確對齊 */}
          <div 
            className="absolute top-full left-1/2 -mt-1 border-8 border-transparent border-t-white transition-transform duration-200"
            style={{ transform: `translateX(calc(-50% - ${shiftX}px))` }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function SpeciesFloatingPanel() {
  const { 
    openSpeciesIds, 
    activeSpeciesId, 
    isExpanded, 
    removeSpecies, 
    setActiveSpecies, 
    toggleExpand,
    isFilterOpen
  } = useSpeciesPanel();
  
  const { language, t } = useLanguage();
  const [speciesData, setSpeciesData] = useState<Record<string, Species>>({});
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);
  const [tooltipX, setTooltipX] = useState<number>(0);
  const [showRightGradient, setShowRightGradient] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const lastScrollYRef = useRef(0);
  const { share, isCopied } = useShare();

  // Check if tabs are scrollable to show gradient
  useEffect(() => {
    const checkScroll = () => {
      if (tabsRef.current) {
        const { scrollWidth, clientWidth, scrollLeft } = tabsRef.current;
        // 只有當內容寬度大於容器寬度，且還沒滾動到底部時才顯示右側漸變
        setShowRightGradient(scrollWidth > clientWidth && (scrollLeft + clientWidth < scrollWidth - 1));
      }
    };

    const tabsEl = tabsRef.current;
    if (tabsEl) {
      checkScroll();
      tabsEl.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        tabsEl.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [openSpeciesIds]);

  // --- Keyboard & Browser Navigation Hijacking ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Backspace to collapse (if not in input)
      if (isExpanded && e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || 
                        target.tagName === 'TEXTAREA' || 
                        target.isContentEditable ||
                        target.closest('.prose');
        
        if (!isInput) {
          e.preventDefault();
          toggleExpand(false);
        }
      }
      
      // ESC key to collapse
      if (isExpanded && e.key === 'Escape') {
        toggleExpand(false);
      }
    };

    // --- Browser Back Hijacking ---
    const handlePopState = (event: PopStateEvent) => {
      // When user presses back button, the browser pops the state.
      // If our dummy state is gone but the panel is still open in UI, close the UI.
      if (isExpanded) {
        // Here we just update the UI state. 
        // We don't need history.back() because the browser ALREADY went back.
        toggleExpand(false);
      }
    };

    // Manage history stack based on expanded state
    // We only push a state if we don't already have ours on top
    if (isExpanded) {
      if (window.history.state?.panelOpen !== true) {
        window.history.pushState({ panelOpen: true }, '');
      }
      window.addEventListener('popstate', handlePopState);
    } 

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
      
      // If we are unmounting or closing via UI click, and our dummy state is still in history,
      // we don't handle it here to avoid race conditions during rapid clicks.
      // Instead, we let the NEXT render cycle or popstate handle it if possible.
    };
  }, [isExpanded, toggleExpand]);

  // Handle history cleanup when panel closes via UI
  useEffect(() => {
    if (!isExpanded && typeof window !== 'undefined' && window.history.state?.panelOpen === true) {
      // Small delay to ensure any pending navigations are settled
      const timer = setTimeout(() => {
        if (window.history.state?.panelOpen === true) {
          window.history.back();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  // --- Auto-scroll to active tab ---
  useEffect(() => {
    if (activeSpeciesId && tabsRef.current) {
      // 稍微延遲以確保 DOM 元素已渲染且佈局穩定 (特別是新增標籤時)
      const timer = setTimeout(() => {
        const activeTabEl = tabsRef.current?.querySelector(`[data-active="true"]`);
        if (activeTabEl) {
          activeTabEl.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
          });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeSpeciesId]);

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
    // 確保當前啟動的物種有資料
    const idsToFetch = [...openSpeciesIds];
    if (activeSpeciesId && !idsToFetch.includes(activeSpeciesId)) {
        idsToFetch.push(activeSpeciesId);
    }

    idsToFetch.forEach(async (id) => {
      // 增加 id 存在保護
      if (!id || typeof id !== 'string') return;
      
      if (!speciesData[id] && !isLoading[id]) {
        // 先設置 Loading 狀態，防止觸發無限更新，我們使用函數式更新並檢查
        setIsLoading(prev => {
           if (prev[id]) return prev;
           return { ...prev, [id]: true };
        });

        try {
          const isFauna = id.startsWith('fauna_');
          const isFlora = id.startsWith('flora_');
          
          let data: any = null;

          if (isFauna) {
            const { data: faunaData } = await supabase
                .from('species')
                .select('*')
                .eq('taxa_id', id)
                .maybeSingle();
            data = faunaData;
          } else if (isFlora) {
            const { data: plantData } = await supabase
                .from('plant_species')
                .select('*')
                .eq('taxa_id', id)
                .maybeSingle();
            
            if (plantData) {
                // 映射植物欄位到 Species 結構，使 SpeciesContent 能正確顯示
                data = {
                    ...plantData,
                    taxa_id: plantData.taxa_id,
                    inat_id: plantData.inat_id, 
                    common_name_chi: plantData.common_name_zh,
                    common_name_eng: plantData.common_name_en,
                    taxa_group: 'FLORA', 
                    family_chi: plantData.family_zh,
                    family_eng: plantData.family_en,
                    genus_chi: plantData.genus_zh,
                    genus_eng: plantData.genus_en,
                    phylum_chi: '維管植物', 
                    phylum_eng: 'Tracheophyta',
                    class_chi: plantData.category_zh,
                    class_eng: plantData.category_en,
                    order_chi: plantData.family_zh, 
                    order_eng: plantData.family_en,
                    description_chi: plantData.description_chi,
                    description_eng: plantData.description,
                    remarks_chi: plantData.remark_chi,
                    remarks_eng: plantData.remark,
                    hk_distribution_chi: plantData.locality_chi,
                    hk_distribution_eng: plantData.locality,
                    global_distribution_chi: plantData.distribution_chi,
                    global_distribution_eng: plantData.distribution,
                    is_cap96: plantData.is_cap96,
                    is_cap586: plantData.is_cap586,
                    hk_rare_precious_note: plantData.hk_rare_precious_note,
                    china_red_data_book_note: plantData.china_red_data_book_note,
                };
            }
          }
          
          if (data) {
            setSpeciesData(prev => ({ ...prev, [id]: data as Species }));
          }
        } catch (err) {
          console.error(`Failed to fetch species ${id}:`, err);
        } finally {
          setIsLoading(prev => {
            const newState = { ...prev };
            delete newState[id];
            return newState;
          });
        }
      }
    });
    // 去除 speciesData 與 isLoading 的依賴項，避免無限地歸觸發
    // 我們只在 ID 列表變動時檢查是否需要抓取
  }, [openSpeciesIds, activeSpeciesId, supabase]); 

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

  // 3. (Removed Sync Header Space logic as it was causing layout thrashing and scroll flicker)
  // Instead, we use a static spacer that naturally scrolls out of view.

  if (openSpeciesIds.length === 0) return null;

  return (
    <motion.div 
      initial={false}
      animate={{ 
        height: isExpanded ? '100dvh' : '82px',
        opacity: isFilterOpen ? 0 : 1,
        y: isFilterOpen ? 100 : 0
      }}
      transition={{ 
        height: isExpanded 
          ? { type: 'spring', stiffness: 120, damping: 20, mass: 0.8 }
          : { duration: 0.4, ease: [0.32, 0.72, 0, 1] }, // Smooth cubic for collapsing
        opacity: { duration: 0.2 },
        y: { duration: 0.3 }
      }}
      className={`fixed bottom-0 left-0 w-full z-50 flex flex-col ${isExpanded && !isFilterOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
    >
      {/* Background Filler for Tab Bar Area (Prevents seeing content behind the container) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-50 pointer-events-none -z-10"
          />
        )}
      </AnimatePresence>

      {/* Main Panel Content (Only visible when expanded) */}
      <motion.div 
        id="species-panel-scroll-container" 
        initial={false}
        animate={{ 
          opacity: isExpanded ? 1 : 0,
          y: 0,
          pointerEvents: isExpanded ? 'auto' : 'none'
        }}
        transition={{ 
          duration: isExpanded ? 0.5 : 0.25, 
          ease: "easeInOut"
        }}
        className={`flex-1 no-scrollbar bg-slate-50 relative shrink-0 ${isExpanded ? 'overflow-y-auto' : 'overflow-hidden'}`}
      >
        {/* Static Header Safe Area - Naturally scrolls out of view, preventing layout thrashing */}
        {isExpanded && (
          <div className="w-full shrink-0 h-24 md:h-28 lg:h-32" />
        )}

        <AnimatePresence mode="popLayout">
          {activeSpeciesId && (
            <motion.div
              key={activeSpeciesId}
              initial={{ opacity: 0, x: 10, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -10, scale: 0.98 }}
              transition={{ 
                duration: 0.3,
                ease: "circOut"
              }}
              className="h-full"
            >
              {speciesData[activeSpeciesId] ? (
                <SpeciesContent species={speciesData[activeSpeciesId]} showBreadcrumb={true} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                    {language === 'zh' ? '正在載入物種詳情...' : 'Loading species details...'}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="w-full flex justify-center pointer-events-auto relative overflow-visible">
        {/* Global Tooltip Portal (Rendered here to escape internal Tab overflow) */}
        {openSpeciesIds.map(id => (
          <SpeciesTabPreview 
            key={`tooltip-${id}`}
            id={id} 
            species={speciesData[id] || null} 
            language={language} 
            visible={hoveredTabId === id} 
            xOffset={tooltipX}
          />
        ))}

        <div className="w-full bg-white/80 backdrop-blur-3xl border-t border-slate-200 shadow-[0_-10px_50px_rgba(0,0,0,0.1)] px-4 md:px-8 py-2 md:py-2.5 flex items-center justify-between">
          <div className="flex-1 min-w-0 overflow-hidden relative">
            <div 
              ref={tabsRef}
              className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth"
            >
            {openSpeciesIds.map((id) => {
              const species = speciesData[id];
              const isActive = activeSpeciesId === id;
              const loading = isLoading[id];
              
              return (
                <motion.div 
                  key={id}
                  layout
                  onClick={() => {
                    setActiveSpecies(id);
                    if (!isExpanded) toggleExpand(true);
                  }}
                  onMouseEnter={(e) => {
                    setHoveredTabId(id);
                    const rect = e.currentTarget.getBoundingClientRect();
                    const parentRect = e.currentTarget.offsetParent?.getBoundingClientRect();
                    if (parentRect) {
                      const centerX = rect.left + (rect.width / 2) - parentRect.left;
                      setTooltipX(centerX);
                    }
                  }}
                  onMouseLeave={() => setHoveredTabId(null)}
                  data-active={isActive}
                  className={`
                    group relative flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border transition-colors cursor-pointer whitespace-nowrap min-h-[44px] z-10
                    ${isActive 
                      ? 'border-slate-800 text-white' 
                      : 'bg-white/50 border-slate-100 text-slate-500 hover:bg-white hover:border-emerald-200'}
                  `}
                >
                  {/* Magic Move Background Slider */}
                  {isActive && (
                    <motion.div
                      layoutId="active-tab-highlight"
                      className="absolute inset-0 bg-slate-900 rounded-2xl -z-10 shadow-xl shadow-slate-200"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}

                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <div className="flex flex-col items-start leading-none gap-0.5">
                      <span className={`text-[11px] font-black tracking-tight ${species && !(language === 'zh' ? species.common_name_chi : species.common_name_eng) ? 'italic' : ''}`}>
                        {species ? (
                          (language === 'zh' ? species.common_name_chi : species.common_name_eng) || species.scientific_name
                        ) : `Loading...`}
                      </span>
                      {!loading && species && (
                        <span className={`text-[8px] font-bold uppercase tracking-wider opacity-60 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {species.taxa_group}
                        </span>
                      )}
                    </div>
                  )}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSpecies(id);
                    }}
                    className={`
                      p-1.5 rounded-lg transition-colors ml-1
                      ${isActive ? 'hover:bg-white/20 text-white' : 'hover:bg-red-50 text-slate-300 hover:text-red-500'}
                    `}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              );
            })}
            </div>
            {/* Fade effect to indicate more tabs on the right - Only shows when scrollable */}
            <AnimatePresence>
              {showRightGradient && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent pointer-events-none z-20" 
                />
              )}
            </AnimatePresence>
          </div>

          {/* Action Buttons - Fixed on the right */}
          <div className="flex items-center gap-2 md:gap-2.5 shrink-0 ml-2 md:ml-4 relative">
            <AnimatePresence>
              {isCopied && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="absolute bottom-full mb-6 right-0 z-[100] whitespace-nowrap bg-slate-900/95 backdrop-blur-xl text-white px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10"
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Check className="w-3 h-3" />
                  </div>
                  <span className="text-[11px] font-black tracking-widest uppercase">
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
                p-3 rounded-2xl transition-all duration-300 flex items-center justify-center border
                ${activeSpeciesId 
                  ? 'bg-white border-slate-100 text-slate-600 shadow-sm hover:border-emerald-200 hover:text-emerald-600 hover:-translate-y-0.5 active:scale-95' 
                  : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-50'}
              `}
            >
              <Share2 className="w-5 h-5" />
            </button>

            {/* Expand/Collapse Toggle */}
            <button 
              onClick={() => toggleExpand()}
              className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 hover:scale-105 transition-all active:scale-95 border border-emerald-500 flex items-center gap-1 group overflow-hidden"
            >
              <motion.div
                initial={false}
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="flex items-center justify-center"
              >
                <ChevronUp className="w-5 h-5" />
              </motion.div>
              
              <AnimatePresence mode="wait" initial={false}>
                <motion.span 
                  key={isExpanded ? 'hide' : 'view'}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="hidden md:inline-block w-12 text-center text-[10px] font-black uppercase tracking-widest"
                >
                  {isExpanded ? 'Hide' : 'View'}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
