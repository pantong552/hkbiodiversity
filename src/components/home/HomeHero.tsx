'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronRight, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';

export default function HomeHero() {
  const { language, t } = useLanguage();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'fauna' | 'flora'>('fauna');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // 將搜尋條件儲存於 sessionStorage，避免暴露在 URL 中
    const payload = {
      q: searchQuery.trim(),
      type: searchType
    };
    
    try {
      sessionStorage.setItem('hkbc_quick_search', JSON.stringify(payload));
    } catch (err) {
      console.error('Failed to save search payload', err);
    }
    
    router.push('/database');
  };

  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden pt-20">
      {/* Background with Overlay */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-white z-10" />
        <img 
          src="https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?q=80&w=2574&auto=format&fit=crop" 
          alt="Nature Background"
          className="w-full h-full object-cover scale-105 animate-slow-zoom"
        />
      </div>

      <div className="container mx-auto px-6 relative z-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto"
        >
          <h1 className="flex flex-col gap-6 md:gap-10 drop-shadow-2xl">
            {language === 'zh' ? (
              <div className="flex flex-col items-center gap-2 md:gap-4">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.8 }}
                  className="flex flex-col md:flex-row items-center gap-x-6 gap-y-1"
                >
                  <span className="text-xl md:text-3xl font-light tracking-[0.4em] text-emerald-100/60 uppercase">探尋</span>
                  <span className="text-6xl md:text-8xl lg:text-[7.5rem] font-black tracking-tighter text-white leading-none">
                    山林<span className="text-emerald-400">海影</span>
                  </span>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                  className="flex flex-col md:flex-row items-center gap-x-6 gap-y-1"
                >
                  <span className="text-xl md:text-3xl font-light tracking-[0.4em] text-emerald-100/60 uppercase">共譜</span>
                  <span className="text-6xl md:text-8xl lg:text-[7.5rem] font-black tracking-tighter text-white leading-none">
                    自然<span className="text-emerald-400">誌銘</span>
                  </span>
                </motion.div>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center px-4">
                <motion.span 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.8 }}
                  className="text-5xl md:text-8xl lg:text-[8.5rem] font-black tracking-tighter text-white leading-[0.85] mb-2"
                >
                  Tracing the <span className="text-emerald-400">wilds</span>
                </motion.span>
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                  className="flex flex-col items-center"
                >
                  <span className="text-2xl md:text-5xl lg:text-[3.8rem] font-medium tracking-tight text-emerald-100/90 leading-tight">
                    scripting the <span className="italic font-light text-white">life</span> of our lands.
                  </span>
                  <div className="h-1 w-20 md:w-32 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent mt-8 md:mt-12" />
                </motion.div>
              </div>
            )}
          </h1>

          {/* Search Bar */}
          <form 
            onSubmit={handleSearch}
            className="relative max-w-3xl mx-auto group mt-16 md:mt-24 px-4"
          >
            <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full group-focus-within:bg-emerald-500/40 transition-all duration-700" />
            <div className="relative flex items-center bg-white/95 backdrop-blur-2xl rounded-[2.5rem] p-1 md:p-1.5 shadow-2xl shadow-slate-900/20 border border-white">
              
              {/* Type Dropdown */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                  className="flex items-center gap-1.5 md:gap-2 px-3 md:px-6 py-3 md:py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-[2rem] transition-all font-black text-[10px] md:text-xs uppercase tracking-widest border border-slate-100"
                >
                  <span className="truncate max-w-[50px] md:max-w-none">
                    {searchType === 'fauna' ? t('home.fauna') : t('home.flora')}
                  </span>
                  <ChevronDown className={`w-3 h-3 md:w-4 md:h-4 transition-transform duration-300 ${showTypeDropdown ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showTypeDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full left-0 mt-2 w-40 md:w-48 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-50 p-2"
                    >
                      <button
                        type="button"
                        onClick={() => { setSearchType('fauna'); setShowTypeDropdown(false); }}
                        className={`w-full flex items-center gap-2 md:gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-2xl text-left transition-all ${searchType === 'fauna' ? 'bg-emerald-600 text-white font-black' : 'hover:bg-slate-50 text-slate-600 font-bold'}`}
                      >
                        <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${searchType === 'fauna' ? 'bg-white' : 'bg-emerald-50'}`} />
                        <span className="text-[11px] md:text-sm">{t('home.fauna')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSearchType('flora'); setShowTypeDropdown(false); }}
                        className={`w-full flex items-center gap-2 md:gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-2xl text-left transition-all ${searchType === 'flora' ? 'bg-emerald-600 text-white font-black' : 'hover:bg-slate-50 text-slate-600 font-bold'}`}
                      >
                        <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${searchType === 'flora' ? 'bg-white' : 'bg-emerald-50'}`} />
                        <span className="text-[11px] md:text-sm">{t('home.flora')}</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Minimal Divider */}
              <div className="w-px h-6 md:h-8 bg-slate-200 mx-1 md:mx-2" />

              {/* Input Area */}
              <div className="flex-1 flex items-center px-2 md:px-4 min-w-0">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('search.placeholder')}
                  className="w-full bg-transparent border-none outline-none text-slate-800 font-bold placeholder:text-slate-400 py-3 md:py-4 text-sm md:text-lg truncate"
                  suppressHydrationWarning
                />
              </div>

              {/* Search Trigger (Icon Button) */}
              <button 
                type="submit"
                className="w-10 h-10 md:w-14 md:h-14 shrink-0 flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-200/40 hover:scale-105 active:scale-95 transition-all duration-300 mr-0.5 md:mr-1"
              >
                <Search className="w-4 h-4 md:w-6 h-6" />
              </button>
            </div>
          </form>
        </motion.div>
      </div>

      <style jsx global>{`
        @keyframes slow-zoom {
          from { transform: scale(1); }
          to { transform: scale(1.1); }
        }
        .animate-slow-zoom {
          animation: slow-zoom 20s ease-in-out infinite alternate;
        }
      `}</style>
    </section>
  );
}
