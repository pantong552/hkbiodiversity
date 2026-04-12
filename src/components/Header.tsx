'use client';

import { useState, useEffect, useRef } from 'react';
import { Leaf, Menu, X, User, LogOut } from 'lucide-react';
import Link from 'next/link';
import LoginButton from './LoginButton';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Globe } from 'lucide-react';

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
    { name: t('nav.about'), href: '/about' },
    { name: t('nav.blog'), href: '/blog' },
    { name: t('nav.contact'), href: '/contact' },
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
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <span className="text-lg font-black tracking-tight text-slate-900">
            HK <span className="text-emerald-600">Biodiversity</span> Collective
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-10">
          <div className="flex items-center gap-8">
            {navLinks.map((link) => (
              <Link 
                key={link.name} 
                href={link.href}
                className="text-sm font-bold text-slate-500 hover:text-emerald-600 transition-colors"
              >
                {link.name}
              </Link>
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
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                {user.user_metadata.avatar_url ? (
                  <img 
                    src={user.user_metadata.avatar_url} 
                    alt="User Avatar" 
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <User className="w-4 h-4 text-slate-500" />
                )}
                <span className="text-sm font-bold text-slate-700">
                  {user.user_metadata.full_name || user.email}
                </span>
              </div>
              <button 
                onClick={handleLogout}
                className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
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
                <Link 
                  key={link.name} 
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-lg font-bold text-slate-700 hover:text-emerald-600 px-4 py-2 rounded-xl hover:bg-emerald-50 transition-all"
                >
                  {link.name}
                </Link>
              ))}
              <hr className="border-slate-100 my-2" />
              {user ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100">
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
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{user.user_metadata.full_name || 'Member'}</span>
                      <span className="text-xs text-slate-500">{user.email}</span>
                    </div>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 w-full py-4 text-red-600 font-bold border-2 border-red-100 rounded-2xl hover:bg-red-50"
                  >
                    <LogOut className="w-5 h-5" />
                    Logout
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
  );
}

