'use client';

import { useState, useEffect, useRef } from 'react';
import { Leaf, Menu, X, User, LogOut, Settings, Globe } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import LoginButton from './LoginButton';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';

export default function Header() {
  const { language, setLanguage, t } = useLanguage();
  const { user, signOut } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const { isExpanded, isGalleryOpen, isUploadModalOpen, isFilterOpen } = useSpeciesPanel();
  const lastScrollYRef = useRef(0);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleScroll = (e?: Event) => {
      // 僅在真正的捲動事件觸發且選單開啟時才關閉，避免初始化調用誤觸
      if (e && isMobileMenuOpen) setIsMobileMenuOpen(false);

      let currentScrollY = window.scrollY;
      
      // 如果面板展開，則監聽面板內部的捲動
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

      // 只有當位移超過一定像素 (10px) 時才更新狀態，避免因捲動抖動導致的頻繁閃爍
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
        // 在頂部附近時始終顯示
        setIsVisible(true);
      }
    };

    // 監聽 window
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // 如果面板展開，額外監聽面板容器
    let panelContainer: HTMLElement | null = null;
    if (isExpanded) {
      panelContainer = document.getElementById('species-panel-scroll-container');
      if (panelContainer) {
        panelContainer.addEventListener('scroll', handleScroll, { passive: true });
        // 初始化一次位置
        handleScroll();
      }
    }

    // 當 isExpanded 變動時也初始化一次
    handleScroll();

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
    // 以下頁面尚未建立，暫時停用以避免 404 prefetch 錯誤
    { name: t('nav.about'), href: '#', disabled: true },
    { name: t('nav.blog'), href: '#', disabled: true },
    { name: t('nav.contact'), href: '#', disabled: true },
  ];

  return (
    <div className={`
      fixed top-4 inset-x-0 z-[60] 
      px-6 md:px-8 lg:px-10 xl:px-16
      transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1)
      ${(isVisible && !isGalleryOpen && !isUploadModalOpen && !isFilterOpen) ? 'translate-y-0 opacity-100' : '-translate-y-40 opacity-0'}
    `}>
      <nav className={`
        glass-header max-w-[1920px] mx-auto
        ${isScrolled ? 'py-2 lg:py-3 shadow-2xl shadow-slate-200/50' : 'py-3 lg:py-5 shadow-none'}
        px-6 md:px-8 flex items-center justify-between
        bg-white border-slate-100
      `}>
        {/* Logo & Branding */}
        <Link href="/" className="flex items-center gap-5 group relative">
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
          <div className="h-10 w-px bg-slate-200/60 hidden md:block" />

          {/* Text Identity */}
          <div className="flex flex-col justify-center gap-0.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black tracking-tighter text-slate-900 group-hover:text-emerald-700 transition-colors duration-500">
                HK
              </span>
              <motion.span
                initial={{ letterSpacing: "0.2em" }}
                whileHover={{ letterSpacing: "0.4em" }}
                className="text-xs font-light uppercase text-emerald-600 transition-all duration-700"
              >
                Biodiversity
              </motion.span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[12px] font-bold uppercase tracking-[0.25em] text-slate-500">
                Collective
              </span>
              {/* Chinese Title Integration - Hidden on Mobile */}
              <div className="hidden md:flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity duration-700">
                <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                <span className="text-[12px] font-medium tracking-widest text-slate-400 whitespace-nowrap">
                  香港自然生態匯誌
                </span>
              </div>
            </div>
          </div>
        </Link>

        {/* Desktop Nav - Now only visible above 1100px */}
        <div className="hidden min-[1101px]:flex items-center gap-6 xl:gap-10">
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
                  className="text-sm font-bold text-slate-500 hover:text-emerald-600 transition-colors"
                >
                  {link.name}
                </Link>
              )
            ))}
          </div>

          {/* Language Switcher - Desktop */}
          <div className="flex items-center p-1 bg-slate-100/50 rounded-full border border-slate-200/50 backdrop-blur-sm">
            <button
              onClick={() => setLanguage('zh')}
              className={`px-3 py-1 text-[10px] font-black rounded-full transition-all ${language === 'zh' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              繁中
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-3 py-1 text-[10px] font-black rounded-full transition-all ${language === 'en' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              EN
            </button>
          </div>

          {user ? (
            <div className="flex items-center gap-2 lg:gap-3">
              <Link href="/account" className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all duration-300 cursor-pointer group">
                {user.user_metadata.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="User Avatar"
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <User className="w-4 h-4 text-slate-500" />
                )}
                <span className="text-sm font-bold text-slate-700 group-hover:text-emerald-700 transition-colors">
                  {user.user_metadata.full_name || user.email}
                </span>
              </Link>
              <Link
                href="/account"
                className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all duration-300 cursor-pointer"
                title={t('account.header_link')}
              >
                <Settings className="w-5 h-5" />
              </Link>
              <button
                onClick={handleLogout}
                className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <LoginButton />
          )}
        </div>

        {/* Mobile/Tablet Menu Toggle - Visible below 1101px */}
        <button
          ref={menuToggleRef}
          className="min-[1101px]:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl"
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
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-lg font-bold text-slate-700 hover:text-emerald-600 px-4 py-2 rounded-xl hover:bg-emerald-50 transition-all"
                  >
                    {link.name}
                  </Link>
                )
              ))}
              <hr className="border-slate-100 my-2" />
              {user ? (
                <div className="space-y-3">
                  <Link
                    href="/account"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all duration-300 cursor-pointer"
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
                    <div className="flex flex-col flex-1">
                      <span className="font-bold text-slate-900">{user.user_metadata.full_name || 'Member'}</span>
                      <span className="text-xs text-slate-500">{user.email}</span>
                    </div>
                    <Settings className="w-5 h-5 text-slate-300" />
                  </Link>
                  <Link
                    href="/account"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 w-full py-3 text-emerald-700 font-bold border-2 border-emerald-100 rounded-2xl hover:bg-emerald-50 transition-all cursor-pointer"
                  >
                    <Settings className="w-4 h-4" />
                    {t('account.header_link')}
                  </Link>
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
                  <LoginButton />
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

