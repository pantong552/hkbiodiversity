'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabase';
import { Species } from '@/types/species';
import SpeciesContent from './SpeciesContent';

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
                  <span className="text-xs font-black">
                    {species ? (language === 'zh' ? species.common_name_chi : species.common_name_eng) : `ID: ${id}`}
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

        <button 
          onClick={() => toggleExpand()}
          className="ml-4 p-2 bg-slate-900 text-white rounded-xl shadow-lg hover:scale-105 transition-transform active:scale-95 shrink-0"
        >
          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>
      </div>

      {/* Main Panel Content (Only visible when expanded) */}
      <div className="flex-1 overflow-y-auto no-scrollbar bg-slate-50">
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
