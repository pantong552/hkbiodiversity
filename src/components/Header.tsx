'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Leaf, Menu, X, User, LogOut, Settings, Globe } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import LoginButton from './LoginButton';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';

export default function Header() {
  const { language, setLanguage, t } = useLanguage();
  const { user, profile, signOut } = useAuth();
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // 在瀏覽器繪製前立即同步 isScrolled 狀態，防止「閃白」
  useLayoutEffect(() => {
    setIsScrolled(window.scrollY > 20);
  }, []);

  const { openSpeciesIds, isExpanded, isGalleryOpen, isUploadModalOpen, isFilterOpen, isEditModalOpen, toggleExpand, setIsAccountOpen, isAccountOpen } = useSpeciesPanel();
  
  // 正規化路徑（移除結尾斜線或查詢參數，確保 Vercel 生產環境首頁正確辨識）
  const normalizedPath = (pathname || '/').replace(/\/$/, '') || '/';
  const isHomePage = normalizedPath === '/';
  const hasSpeciesOpen = openSpeciesIds.length > 0;
  const isHeaderTransparent = isHomePage && !isScrolled && !hasSpeciesOpen;
  const lastScrollYRef = useRef(0);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);

  // 監聽 BFCache（Back-Forward Cache）頁面恢復事件
  // 當 Refresh 或返回時從快取恢復頁面，強制重新同步 scroll 狀態
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      // e.persisted === true 代表從 BFCache 恢復（不是全新加載）
      setIsScrolled(window.scrollY > 20);
      setIsVisible(true);
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  useEffect(() => {

    const handleScroll = (e?: Event) => {
      if (e && isMobileMenuOpen) setIsMobileMenuOpen(false);

      let currentScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
      
      if (isExpanded) {
        const panelContainer = document.getElementById('species-panel-scroll-container');
        if (panelContainer) {
          currentScrollY = panelContainer.scrollTop;
        }
      }

      // 切換透明度/高度
      setIsScrolled(currentScrollY > 20);

      // 智慧顯示/隱藏邏輯
      const deltaY = currentScrollY - lastScrollYRef.current;

      if (Math.abs(deltaY) > 10) {
        if (currentScrollY <= 50) {
          setIsVisible(true);
        } else if (deltaY > 0 && currentScrollY > 100) {
          setIsVisible(false);
        } else if (deltaY < 0) {
          setIsVisible(true);
        }
        lastScrollYRef.current = currentScrollY;
      } else if (currentScrollY <= 50) {
        setIsVisible(true);
      }
    };

    // 掛載時同步一次當前 scrollY 狀態
    setIsScrolled(window.scrollY > 20);

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    let panelContainer: HTMLElement | null = null;
    if (isExpanded) {
      panelContainer = document.getElementById('species-panel-scroll-container');
      if (panelContainer) {
        panelContainer.addEventListener('scroll', handleScroll, { passive: true });
      }
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (panelContainer) {
        panelContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [isExpanded, isMobileMenuOpen]);

  // 處理點擊外部關閉選單
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // 確保點擊的不是選單本身，也不是開關按鈕本身
      if (
        isMobileMenuOpen && 
        mobileMenuRef.current && 
        !mobileMenuRef.current.contains(event.target as Node) &&
        menuToggleRef.current &&
        !menuToggleRef.current.contains(event.target as Node)
      ) {
        setIsMobileMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    await signOut();
  };

  const navLinks = [
    { name: t('nav.home'), href: '/' },
    { name: t('nav.database'), href: '/database' },
    // 以下頁面尚未建立，暫時停用以避免 404 prefetch 錯誤
    { name: t('nav.about'), href: '#', disabled: true },
    { name: t('nav.blog'), href: '/journal' },
    ...(profile?.role === 'admin' ? [{ name: t('nav.manage'), href: '/maintain' }] : []),
  ];

  return (
    <div className={`
      fixed top-4 inset-x-0 z-[60] 
      px-6 md:px-8 lg:px-10 xl:px-16
      transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1)
      ${(isVisible && !isGalleryOpen && !isUploadModalOpen && !isAccountOpen && !isEditModalOpen) ? 'translate-y-0 opacity-100' : '-translate-y-40 opacity-0 pointer-events-none'}
    `}>
      <nav className={`
        max-w-[1920px] mx-auto rounded-[2rem]
        ${isHeaderTransparent ? 'bg-transparent border-transparent shadow-none' : 'glass-header bg-white/90 backdrop-blur-xl border-slate-100 shadow-2xl shadow-slate-200/50'}
        ${isScrolled ? 'py-2 lg:py-3' : 'py-3 lg:py-5'}
        px-6 md:px-8 flex items-center justify-between
        transition-all duration-500
      `}>
        {/* Logo & Branding */}
        <Link 
          href="/" 
          onClick={() => toggleExpand(false)}
          className="flex items-center gap-5 group relative"
        >
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="relative w-14 h-14 md:w-16 md:h-16 flex items-center justify-center"
          >
            {/* Ambient Glow Background */}
            <div className="absolute inset-0 bg-emerald-500/10 blur-2xl rounded-full group-hover:bg-emerald-500/20 transition-all duration-700" />

            <img
              src="/logo.svg"
              alt="HKBC Logo"
              className="w-full h-full object-contain relative z-10 filter drop-shadow-[0_4px_12px_rgba(103,151,88,0.15)] group-hover:drop-shadow-[0_8px_24px_rgba(103,151,88,0.25)] transition-all duration-500"
            />
          </motion.div>

          {/* Vertical Separator Line */}
          <div className={`h-10 w-px hidden md:block transition-colors duration-500 ${isHeaderTransparent ? 'bg-white/20' : 'bg-slate-200/60'}`} />
  
          {/* Text Identity */}
          <div className="flex flex-col justify-center gap-0.5">
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-black tracking-tighter transition-colors duration-500 ${isHeaderTransparent ? 'text-white drop-shadow-md' : 'text-slate-900'} group-hover:text-emerald-500`}>
                HK
              </span>
              <motion.span
                initial={{ letterSpacing: "0.2em" }}
                whileHover={{ letterSpacing: language === 'zh' ? "0.4em" : "0.3em" }}
                className={`text-xs font-light uppercase transition-colors duration-500 ${isHeaderTransparent ? 'text-emerald-300 drop-shadow-sm' : 'text-emerald-600'}`}
              >
                Biodiversity
              </motion.span>
            </div>
  
            <div className="flex items-center gap-3">
              <span className={`text-[12px] font-bold uppercase tracking-[0.25em] transition-colors duration-500 ${isHeaderTransparent ? 'text-white drop-shadow-sm' : 'text-slate-500'}`}>
                Collective
              </span>
              {/* Chinese Title Integration - Hidden on Mobile */}
              <div className="hidden md:flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity duration-700">
                <div className={`w-1 h-1 rounded-full ${isHeaderTransparent ? 'bg-emerald-400' : 'bg-emerald-500'}`} />
                <span className={`text-[12px] font-medium tracking-widest transition-colors duration-500 ${isHeaderTransparent ? 'text-white/80 drop-shadow-sm' : 'text-slate-400'} whitespace-nowrap`}>
                  香港自然生態匯誌
                </span>
              </div>
            </div>
          </div>
        </Link>

        {/* Desktop Nav - Now only visible above 1100px */}
        <div className={`hidden min-[1101px]:flex items-center ${language === 'en' ? 'gap-4 xl:gap-6' : 'gap-6 xl:gap-10'}`}>
          <div className="flex items-center gap-4 xl:gap-8">
            {navLinks.map((link) => (
              link.disabled ? (
                <span
                  key={link.name}
                  className="text-sm font-bold text-slate-300 cursor-not-allowed"
                  title="Coming Soon"
                >
                  {link.name}
                </span>
              ) : (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => {
                    if (pathname === link.href) {
                      toggleExpand(false);
                    }
                  }}
                  className={`${language === 'en' ? 'text-xs xl:text-sm' : 'text-sm'} font-bold transition-colors duration-500 ${isHeaderTransparent ? 'text-white drop-shadow-sm hover:text-emerald-300' : 'text-slate-500 hover:text-emerald-600'}`}
                >
                  {link.name}
                </Link>
              )
            ))}
          </div>

          {/* Language Switcher - Desktop */}
          <div className={`flex items-center p-1 rounded-full border transition-all duration-500 backdrop-blur-sm ${isHeaderTransparent ? 'bg-white/10 border-white/20' : 'bg-slate-100/50 border-slate-200/50'}`}>
            <button
              onClick={() => setLanguage('zh')}
              className={`px-3 py-1 text-[10px] font-black rounded-full transition-all ${language === 'zh' ? 'bg-white text-emerald-600 shadow-sm' : (isHeaderTransparent ? 'text-white/60 hover:text-white' : 'text-slate-400 hover:text-slate-600')}`}
            >
              繁中
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-3 py-1 text-[10px] font-black rounded-full transition-all ${language === 'en' ? 'bg-white text-emerald-600 shadow-sm' : (isHeaderTransparent ? 'text-white/60 hover:text-white' : 'text-slate-400 hover:text-slate-600')}`}
            >
              EN
            </button>
          </div>

          {user ? (
            <div className="flex items-center gap-2 lg:gap-3">
              <button 
                onClick={() => setIsAccountOpen(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all duration-500 cursor-pointer group ${isHeaderTransparent ? 'bg-white/10 border-white/20 hover:bg-white/20' : 'bg-slate-50 border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50'}`}
              >
                {user.user_metadata.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="User Avatar"
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <User className={`w-4 h-4 ${isHeaderTransparent ? 'text-white/60' : 'text-slate-500'}`} />
                )}
                <span className={`text-sm font-bold transition-colors ${isHeaderTransparent ? 'text-white group-hover:text-white' : 'text-slate-700 group-hover:text-emerald-700'}`}>
                  {user.user_metadata.full_name || user.email}
                </span>
              </button>
              <button
                onClick={handleLogout}
                className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <LoginButton isTransparent={isHeaderTransparent} />
          )}
        </div>

        {/* Mobile/Tablet Menu Toggle - Visible below 1101px */}
        <button
          ref={menuToggleRef}
          className={`min-[1101px]:hidden p-2 rounded-xl transition-colors duration-500 ${isHeaderTransparent ? 'text-white hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'}`}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        
        {/* Mobile/Tablet Menu Dropdown */}
        {isMobileMenuOpen && (
          <div 
            ref={mobileMenuRef}
            className="min-[1101px]:hidden absolute top-full left-0 right-0 mt-4 mx-4 md:mx-auto md:max-w-md p-6 bg-white rounded-3xl shadow-2xl border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300"
          >
          <div className="flex flex-col gap-6">
            {/* Language Selection - Mobile */}
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2 text-slate-400">
                <Globe className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Language</span>
              </div>
              <div className="flex p-1 bg-slate-50 rounded-xl border border-slate-100">
                <button
                  onClick={() => setLanguage('zh')}
                  className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${language === 'zh' ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-slate-100' : 'text-slate-400'}`}
                >
                  繁中
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${language === 'en' ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-slate-100' : 'text-slate-400'}`}
                >
                  EN
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                link.disabled ? (
                  <span
                    key={link.name}
                    className="text-lg font-bold text-slate-300 px-4 py-2 rounded-xl cursor-not-allowed"
                  >
                    {link.name} <span className="text-xs text-slate-300 ml-1">(Coming Soon)</span>
                  </span>
                ) : (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      if (pathname === link.href) {
                        toggleExpand(false);
                      }
                    }}
                    className="text-lg font-bold text-slate-700 hover:text-emerald-600 px-4 py-2 rounded-xl hover:bg-emerald-50 transition-all"
                  >
                    {link.name}
                  </Link>
                )
              ))}
              <hr className="border-slate-100 my-2" />
              {user ? (
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsAccountOpen(true);
                    }}
                    className="flex items-center gap-3 px-4 py-3 w-full bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all duration-300 cursor-pointer"
                  >
                    {user.user_metadata.avatar_url ? (
                      <img
                        src={user.user_metadata.avatar_url}
                        alt="User Avatar"
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-slate-500" />
                      </div>
                    )}
                    <div className="flex flex-col flex-1 text-left">
                      <span className="font-bold text-slate-900">{user.user_metadata.full_name || 'Member'}</span>
                      <span className="text-xs text-slate-500">{user.email}</span>
                    </div>
                    <Settings className="w-5 h-5 text-slate-300" />
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 w-full py-3 text-red-600 font-bold border-2 border-red-100 rounded-2xl hover:bg-red-50 transition-all cursor-pointer"
                  >
                    <LogOut className="w-5 h-5" />
                    {t('auth.logout')}
                  </button>
                </div>
              ) : (
                <div className="flex justify-center">
                  <LoginButton isTransparent={false} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </nav>
    </div>
  );
}

