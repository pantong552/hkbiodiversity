'use client';

import { useState, useEffect, useRef } from 'react';
import { Leaf, Menu, X, User, LogOut, Settings, Globe } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import LoginButton from './LoginButton';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';

export default function Header() {
  const { language, setLanguage, t } = useLanguage();
  const { user, signOut } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // 使用 ref 來儲存滾動位置，避免 useEffect 頻繁重新觸發
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // 切換透明度/高度
      setIsScrolled(currentScrollY > 20);

      // 智慧顯示/隱藏邏輯
      if (currentScrollY > lastScrollYRef.current && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }

      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

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
    <nav className={`
      glass-header
      fixed top-4 left-0 right-0 z-[100]
      transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1)
      ${isScrolled ? 'py-3' : 'py-5'}
      ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-32 opacity-0'}
    `}>
      <div className="container mx-auto px-6 flex items-center justify-between">
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
                  香港生物多樣性匯誌
                </span>
              </div>
            </div>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-10">
          <div className="flex items-center gap-8">
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
            <div className="flex items-center gap-3">
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

        {/* Mobile Menu Toggle */}
        <button
          className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 mt-4 mx-4 p-6 bg-white rounded-3xl shadow-2xl border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300">
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
              <div className="mt-4 px-4 py-6 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex flex-wrap gap-4 mb-4">
                  <Link
                    href="/privacy"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-xs font-bold text-slate-500 hover:text-emerald-600 transition-colors"
                  >
                    {t('nav.privacy')}
                  </Link>
                  <Link
                    href="/terms"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-xs font-bold text-slate-500 hover:text-emerald-600 transition-colors"
                  >
                    {t('nav.terms')}
                  </Link>
                </div>
                <p className="text-[10px] font-medium text-slate-400 leading-relaxed uppercase tracking-widest">
                  © 2026 Hong Kong Biodiversity Collective<br />
                  All Rights Reserved.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

