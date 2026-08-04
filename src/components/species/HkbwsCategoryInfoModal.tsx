'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Info, X, HelpCircle, Sparkles, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';

export default function HkbwsCategoryInfoModal() {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [activeTab, setActiveTab] = useState<'zh' | 'en'>(language === 'zh' ? 'zh' : 'en');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync tab with global language on mount or change
  useEffect(() => {
    setActiveTab(language === 'zh' ? 'zh' : 'en');
  }, [language]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 200);
  };

  const categoryData = {
    cat1: {
      badge: 'Category I',
      badgeChi: '第 I 類',
      color: 'bg-emerald-500 text-white shadow-emerald-500/20',
      cardBg: 'bg-emerald-50/70 border-emerald-200/80 hover:border-emerald-300',
      titleChi: '在香港有明確野生記錄的鳥種。',
      titleEng: 'Species that have been recorded in an apparently wild state in HK.',
    },
    cat2: {
      badge: 'Category II',
      badgeChi: '第 II 類',
      color: 'bg-amber-500 text-white shadow-amber-500/20',
      cardBg: 'bg-amber-50/70 border-amber-200/80 hover:border-amber-300',
      titleChi: '非原居或由籠鳥繁衍，但已建立穩定野外族群的鳥種。細分為：',
      titleEng: 'Designates bird species with established or feral populations in Hong Kong that may derive from captive stock, historical introductions, or regional range changes rather than purely wild-recorded native status.',
      sub: [
        {
          badge: 'IIA',
          badgeChi: '第 IIA 類',
          zh: '在中國東南部繁殖，現時在香港的繁殖群落被認為是由逃逸籠鳥所繁衍，但亦可能在棲息地變化前已在香港出沒。',
          en: 'Southeast China breeding species, the currently established HK breeding population of which is considered to derive from captive stock, but which probably occurred in HK prior to habitat changes.',
        },
        {
          badge: 'IIB',
          badgeChi: '第 IIB 類',
          zh: '人為引入香港的非原居鳥種，現時無需額外幫助已能自行繼續繁衍。',
          en: 'Extralimital species that, although originally introduced to HK by man, maintain a regular feral breeding stock without necessary recourse to further introduction.',
        },
        {
          badge: 'IIC',
          badgeChi: '第 IIC 類',
          zh: '曾經在香港擁有野生群落的鳥種。',
          en: 'Previously established feral species.',
        },
      ],
    },
    cat3: {
      badge: 'Category III',
      badgeChi: '第 III 類',
      color: 'bg-rose-500 text-white shadow-rose-500/20',
      cardBg: 'bg-rose-50/70 border-rose-200/80 hover:border-rose-300',
      titleChi: '可能在飼養時逃逸或人為放生的鳥種。此類別不計入香港正式鳥類名錄的總數中。',
      titleEng: 'Species for which all published HK records are considered likely to relate to birds that have escaped or have been released from captivity.',
    },
  };

  return (
    <div className="relative inline-flex items-center ml-1.5">
      {/* Trigger Icon Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="p-1 rounded-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100/70 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 group"
        aria-label="HKBWS Category Definition Info"
      >
        <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:scale-110 transition-transform" />
      </button>

      {/* Quick Hover Tooltip Preview (Desktop) */}
      <AnimatePresence>
        {isHovered && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900/95 text-white text-xs rounded-xl shadow-xl backdrop-blur-md z-50 pointer-events-none hidden sm:block border border-slate-700/50"
          >
            <div className="flex items-center gap-1.5 font-bold text-emerald-400 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{language === 'zh' ? '鳥種類別定義 (HKBWS)' : 'Bird Categories Definition'}</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              {language === 'zh'
                ? '點擊查看香港觀鳥會 (HKBWS) 第 I、II (IIA/B/C) 及 III 類詳細定義與說明。'
                : 'Click to view complete details for HKBWS Category I, II (IIA/B/C), and III.'}
            </p>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900/95" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Modal Popover */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full overflow-hidden z-10 my-auto text-slate-800"
            >
              {/* Header */}
              <div className="relative px-6 py-5 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/20 rounded-2xl border border-emerald-400/30 text-emerald-300 backdrop-blur-md">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                      鳥種類別定義
                      <span className="text-xs font-normal text-emerald-300/80 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        HKBWS
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300/90 font-medium">Bird Species Categories Definition</p>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Language Segmented Control Tab */}
              <div className="px-6 pt-4 pb-2 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-500 hidden sm:inline">
                  {activeTab === 'zh' ? '香港觀鳥會官方名錄類別說明' : 'Official HKBWS Checklist Category Guide'}
                </span>
                <div className="flex bg-slate-200/70 p-1 rounded-xl gap-1 text-xs font-bold w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setActiveTab('zh')}
                    className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'zh' ? 'bg-white text-emerald-700 shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    繁體中文
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('en')}
                    className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'en' ? 'bg-white text-emerald-700 shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    English
                  </button>
                </div>
              </div>

              {/* Content Body */}
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar text-slate-700 text-sm">
                {/* Category I */}
                <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${categoryData.cat1.cardBg}`}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className={`px-3 py-1 text-xs font-black rounded-lg shadow-sm ${categoryData.cat1.color}`}>
                      {activeTab === 'zh' ? categoryData.cat1.badgeChi : categoryData.cat1.badge}
                    </span>
                  </div>
                  <p className="text-slate-800 font-semibold leading-relaxed">
                    {activeTab === 'zh' ? categoryData.cat1.titleChi : categoryData.cat1.titleEng}
                  </p>
                </div>

                {/* Category II */}
                <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${categoryData.cat2.cardBg}`}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className={`px-3 py-1 text-xs font-black rounded-lg shadow-sm ${categoryData.cat2.color}`}>
                      {activeTab === 'zh' ? categoryData.cat2.badgeChi : categoryData.cat2.badge}
                    </span>
                  </div>
                  <p className="text-slate-800 font-semibold leading-relaxed mb-3">
                    {activeTab === 'zh' ? categoryData.cat2.titleChi : categoryData.cat2.titleEng}
                  </p>

                  {/* Subcategories IIA, IIB, IIC */}
                  <div className="space-y-2.5 pl-2 sm:pl-3 border-l-2 border-amber-300/60 mt-3">
                    {categoryData.cat2.sub.map((subItem) => (
                      <div key={subItem.badge} className="bg-white/80 p-3 rounded-xl border border-amber-100/80 shadow-2xs">
                        <div className="flex items-start gap-2.5">
                          <span className="px-2 py-0.5 text-[11px] font-black bg-amber-100 text-amber-800 rounded-md shrink-0 mt-0.5">
                            {activeTab === 'zh' ? subItem.badgeChi : subItem.badge}
                          </span>
                          <p className="text-xs text-slate-700 leading-relaxed font-medium">
                            {activeTab === 'zh' ? subItem.zh : subItem.en}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Category III */}
                <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${categoryData.cat3.cardBg}`}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className={`px-3 py-1 text-xs font-black rounded-lg shadow-sm ${categoryData.cat3.color}`}>
                      {activeTab === 'zh' ? categoryData.cat3.badgeChi : categoryData.cat3.badge}
                    </span>
                  </div>
                  <p className="text-slate-800 font-semibold leading-relaxed">
                    {activeTab === 'zh' ? categoryData.cat3.titleChi : categoryData.cat3.titleEng}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                  香港觀鳥會 香港鳥類名錄 (HKBWS Bird Checklist)
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all cursor-pointer shadow-sm"
                >
                  {activeTab === 'zh' ? '關閉' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
