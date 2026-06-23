'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { 
  Users, 
  Package, 
  LayoutDashboard, 
  ChevronRight,
  ShieldCheck,
  ArrowLeft,
  ListTree,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import Link from 'next/link';
import UsersManager from '@/components/admin/UsersManager';
import TaxonomyMappingsManager from '@/components/admin/TaxonomyMappingsManager';
import SpeciesManager from '@/components/admin/SpeciesManager';
import PlantSpeciesManager from '@/components/admin/PlantSpeciesManager';
import LanguageSwitcher from '@/components/admin/LanguageSwitcher';
import { motion, AnimatePresence } from 'framer-motion';
import AlertModal from '@/components/ui/AlertModal';

type AdminTab = 'users' | 'taxonomy-fauna' | 'taxonomy-flora' | 'species-fauna' | 'species-flora';

export default function MaintainPage() {
  const { profile, isLoading } = useAuth();
  const { t, language } = useLanguage();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ 
    isOpen: boolean; 
    onConfirm: (() => void) | null;
    title?: string;
    message?: string;
  }>({
    isOpen: false,
    onConfirm: null
  });

  useEffect(() => {
    if (!isLoading && !profile) {
      router.push('/account');
    }
    if (!isLoading && profile && profile.role !== 'admin') {
      router.push('/');
    }
  }, [profile, isLoading, router]);

  if (isLoading || !profile || profile.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-bold animate-pulse">Verifying Permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-100/40 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-slate-200/30 blur-[100px] rounded-full" />
      </div>

      <div className="flex-1 flex flex-col lg:flex-row relative z-10 pt-4 lg:pt-4">
        {/* Left Sidebar - Fixed on Desktop - Collapsible */}
        <aside 
          className={`w-full lg:h-[calc(100vh-60px)] lg:sticky lg:top-4 px-4 lg:pl-6 lg:pr-3 mb-6 lg:mb-0 flex flex-col gap-5 flex-shrink-0 transition-all duration-300 ease-in-out ${
            isCollapsed ? 'lg:w-20' : 'lg:w-64 xl:w-72'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Link 
                href="/"
                className={`inline-flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:gap-3 transition-all group ${
                  isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {t('account.back')}
              </Link>
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="hidden lg:flex p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all active:scale-95"
                title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
            </div>
            
            <div className={`flex items-center gap-3 group/title ${isCollapsed ? 'justify-center' : ''}`}>
              <div className="p-2.5 bg-gradient-to-br from-emerald-600 to-teal-500 rounded-2xl shadow-lg shadow-emerald-600/20 border border-emerald-400/20 flex-shrink-0 transition-transform duration-300 group-hover/title:scale-105 group-hover/title:rotate-3">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div className={`transition-all duration-300 origin-left ${isCollapsed ? 'opacity-0 scale-0 w-0 overflow-hidden' : 'opacity-100 scale-100'}`}>
                {language === 'zh' ? (
                  <>
                    <h1 className="text-lg xl:text-xl font-extrabold text-slate-800 tracking-tight leading-none whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700">
                      系統管理
                    </h1>
                    <p className="text-[9px] text-emerald-600 font-black uppercase tracking-widest mt-1 whitespace-nowrap font-mono opacity-80">
                      SYSTEM MANAGEMENT
                    </p>
                  </>
                ) : (
                  <>
                    <h1 className="text-lg xl:text-xl font-extrabold text-slate-800 tracking-tight leading-none uppercase whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700">
                      Console
                    </h1>
                    <p className="text-[9px] text-emerald-600 font-black uppercase tracking-widest mt-1 whitespace-nowrap font-mono opacity-80">
                      SYSTEM MANAGEMENT
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <nav className="flex flex-col gap-1.5">
            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center p-3 rounded-2xl transition-all duration-200 group outline-none select-none active:scale-[0.98] ${
                activeTab === 'users' 
                  ? 'bg-white shadow-lg shadow-slate-200/40 border border-slate-100 text-slate-900' 
                  : 'text-slate-500 hover:bg-white/50 border border-transparent'
              } ${isCollapsed ? 'justify-center' : 'justify-between'}`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl transition-colors flex-shrink-0 ${activeTab === 'users' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600'}`}>
                  <Users className="w-4 h-4" />
                </div>
                {!isCollapsed && <span className="font-bold text-sm whitespace-nowrap">{t('admin.users_manager')}</span>}
              </div>
              {!isCollapsed && <ChevronRight className={`w-3.5 h-3.5 transition-transform ${activeTab === 'users' ? 'opacity-100' : 'opacity-0 -translate-x-2'}`} />}
            </button>

            {/* Taxonomy Management with Sub-options */}
            <div className="flex flex-col">
              <div 
                className={`flex items-center p-3 rounded-2xl cursor-pointer transition-all duration-200 group outline-none select-none ${
                  activeTab.startsWith('taxonomy') 
                    ? 'bg-white shadow-lg shadow-slate-200/40 border border-slate-100 text-slate-900' 
                    : 'text-slate-500 hover:bg-white/50 border border-transparent'
                } ${isCollapsed ? 'justify-center' : 'justify-between'}`}
                onClick={() => {
                  if (isCollapsed) setIsCollapsed(false);
                  setActiveTab(activeTab === 'taxonomy-fauna' ? 'users' : 'taxonomy-fauna');
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl transition-colors flex-shrink-0 ${activeTab.startsWith('taxonomy') ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600'}`}>
                    <ListTree className="w-4 h-4" />
                  </div>
                  {!isCollapsed && <span className="font-bold text-sm whitespace-nowrap">{t('admin.taxonomy_manager')}</span>}
                </div>
                {!isCollapsed && <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeTab.startsWith('taxonomy') ? 'rotate-180' : ''}`} />}
              </div>
              
              <AnimatePresence>
                {!isCollapsed && activeTab.startsWith('taxonomy') && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden flex flex-col ml-12 border-l border-slate-100 gap-1 mt-1 mb-2"
                  >
                    <button 
                      onClick={() => setActiveTab('taxonomy-fauna')}
                      className={`relative text-left pl-6 pr-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 flex items-center ${
                        activeTab === 'taxonomy-fauna' 
                          ? 'text-emerald-700 bg-gradient-to-r from-emerald-50 to-transparent' 
                          : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/30 hover:translate-x-1'
                      }`}
                    >
                      {activeTab === 'taxonomy-fauna' && (
                        <motion.div 
                          layoutId="submenu-active-indicator"
                          className="absolute left-[-1px] top-2 bottom-2 w-0.5 bg-emerald-500 rounded-full"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      {t('admin.taxa_fauna')}
                    </button>
                    <button 
                      onClick={() => setActiveTab('taxonomy-flora')}
                      className={`relative text-left pl-6 pr-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 flex items-center ${
                        activeTab === 'taxonomy-flora' 
                          ? 'text-emerald-700 bg-gradient-to-r from-emerald-50 to-transparent' 
                          : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/30 hover:translate-x-1'
                      }`}
                    >
                      {activeTab === 'taxonomy-flora' && (
                        <motion.div 
                          layoutId="submenu-active-indicator"
                          className="absolute left-[-1px] top-2 bottom-2 w-0.5 bg-emerald-500 rounded-full"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      {t('admin.taxa_flora')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Species Bank Management with Sub-options */}
            <div className="flex flex-col">
              <div 
                className={`flex items-center p-3 rounded-2xl cursor-pointer transition-all duration-200 group outline-none select-none ${
                  activeTab.startsWith('species')
                    ? 'bg-white shadow-lg shadow-slate-200/40 border border-slate-100 text-slate-900' 
                    : 'text-slate-500 hover:bg-white/50 border border-transparent'
                } ${isCollapsed ? 'justify-center' : 'justify-between'}`}
                onClick={() => {
                  if (isCollapsed) setIsCollapsed(false);
                  setActiveTab('species-fauna');
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl transition-colors flex-shrink-0 ${activeTab.startsWith('species') ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600'}`}>
                    <Package className="w-4 h-4" />
                  </div>
                  {!isCollapsed && <span className="font-bold text-sm whitespace-nowrap">{t('admin.taxa_manager')}</span>}
                </div>
                {!isCollapsed && <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeTab.startsWith('species') ? 'rotate-180' : ''}`} />}
              </div>
              
              <AnimatePresence>
                {!isCollapsed && activeTab.startsWith('species') && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden flex flex-col ml-12 border-l border-slate-100 gap-1 mt-1 mb-2"
                  >
                    <button 
                      onClick={() => setActiveTab('species-fauna')}
                      className={`relative text-left pl-6 pr-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 flex items-center ${
                        activeTab === 'species-fauna' 
                          ? 'text-emerald-700 bg-gradient-to-r from-emerald-50 to-transparent' 
                          : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/30 hover:translate-x-1'
                      }`}
                    >
                      {activeTab === 'species-fauna' && (
                        <motion.div 
                          layoutId="submenu-active-indicator-species"
                          className="absolute left-[-1px] top-2 bottom-2 w-0.5 bg-emerald-500 rounded-full"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      {t('admin.species_fauna')}
                    </button>
                    <button 
                      onClick={() => setActiveTab('species-flora')}
                      className={`relative text-left pl-6 pr-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 flex items-center ${
                        activeTab === 'species-flora' 
                          ? 'text-emerald-700 bg-gradient-to-r from-emerald-50 to-transparent' 
                          : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/30 hover:translate-x-1'
                      }`}
                    >
                      {activeTab === 'species-flora' && (
                        <motion.div 
                          layoutId="submenu-active-indicator-species"
                          className="absolute left-[-1px] top-2 bottom-2 w-0.5 bg-emerald-500 rounded-full"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      {t('admin.species_flora')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </nav>

          {/* Language Switcher at Bottom */}
          <div className={`mt-auto pt-4 border-t border-slate-100 lg:pb-0 transition-all duration-300 ${isCollapsed ? 'px-0 flex justify-center' : 'px-2'}`}>
            {isCollapsed ? (
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-[10px] font-bold text-emerald-600">
                {language === 'zh' ? '繁' : 'EN'}
              </div>
            ) : (
              <LanguageSwitcher />
            )}
          </div>
        </aside>

          {/* Main Content Area */}
          <main className="flex-1 px-2 lg:pr-6 lg:pl-2 pb-2 min-w-0">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-white/40 backdrop-blur-2xl rounded-[2.5rem] border border-white p-4 md:px-6 md:py-4 shadow-2xl shadow-slate-200/40 flex flex-col h-[calc(100vh-32px)]"
            >
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <div className="w-2 h-6 bg-emerald-500 rounded-full" />
                  {activeTab === 'users' ? t('admin.users_manager') : activeTab === 'taxonomy-fauna' ? t('admin.taxa_fauna') : activeTab === 'taxonomy-flora' ? t('admin.taxa_flora') : activeTab === 'species-fauna' ? t('admin.species_fauna') : activeTab === 'species-flora' ? t('admin.species_flora') : t('admin.taxa_manager')}
                </h2>
              </div>
              <div className="flex-1 min-h-0">
                {activeTab === 'users' ? (
                  <UsersManager 
                    onRequestConfirm={(onConfirm) => setConfirmModal({ 
                      isOpen: true, 
                      onConfirm,
                      title: t('admin.confirm_remove_title'),
                      message: t('admin.confirm_remove')
                    })} 
                  />
                ) : activeTab === 'taxonomy-fauna' ? (
                  <TaxonomyMappingsManager 
                    mode="fauna" 
                    onRequestConfirm={(onConfirm, title, message) => setConfirmModal({ 
                      isOpen: true, 
                      onConfirm,
                      title: title || t('admin.confirm_remove_title'),
                      message: message || t('admin.confirm_remove')
                    })} 
                  />
                ) : activeTab === 'taxonomy-flora' ? (
                  <TaxonomyMappingsManager 
                    mode="flora" 
                    onRequestConfirm={(onConfirm, title, message) => setConfirmModal({ 
                      isOpen: true, 
                      onConfirm,
                      title: title || t('admin.confirm_remove_title'),
                      message: message || t('admin.confirm_remove')
                    })} 
                  />
                ) : activeTab === 'species-fauna' ? (
                  <SpeciesManager />
                ) : (
                  <PlantSpeciesManager />
                )}
              </div>
            </motion.div>
          </main>
        </div>

      <AlertModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false, onConfirm: null })}
        onConfirm={() => {
          if (confirmModal.onConfirm) confirmModal.onConfirm();
          setConfirmModal({ ...confirmModal, isOpen: false, onConfirm: null });
        }}
        title={confirmModal.title || t('admin.confirm_remove_title')}
        description={confirmModal.message || t('admin.confirm_remove')}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        type="danger"
      />

      <style jsx global>{`
        .glass-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
}
