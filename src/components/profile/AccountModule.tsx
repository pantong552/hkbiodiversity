'use client';

import { useState, useEffect } from 'react';
import { User, Heart, Calendar, Clock, Mail, X, Settings, ArrowLeft, ShieldCheck, FileEdit } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';
import UsernameForm from './UsernameForm';
import BookmarksSection from './BookmarksSection';
import CuratorDraftsSection from './CuratorDraftsSection';

type TabType = 'profile' | 'bookmarks' | 'drafts';

export default function AccountModule() {
  const { user, profile, isLoading } = useAuth();
  const { t, language } = useLanguage();
  const { isAccountOpen, setIsAccountOpen, openSpeciesIds } = useSpeciesPanel();
  const [activeTab, setActiveTab] = useState<TabType>('profile');

  // 禁止背景捲動
  useEffect(() => {
    if (isAccountOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isAccountOpen]);

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'zh' ? 'zh-TW' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string | undefined) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleString(language === 'zh' ? 'zh-TW' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: t('account.tab_profile'), icon: <User className="w-4 h-4" /> },
    { id: 'bookmarks', label: t('account.tab_bookmarks'), icon: <Heart className="w-4 h-4" /> },
  ];

  if (profile?.role === 'curator' || profile?.role === 'admin') {
    tabs.push({
      id: 'drafts',
      label: language === 'zh' ? '修訂草稿' : 'My Drafts',
      icon: <FileEdit className="w-4 h-4 text-amber-500" />
    });
  }

  return (
    <AnimatePresence>
      {isAccountOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsAccountOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] cursor-pointer"
          />

          {/* 側邊面板 */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[540px] bg-slate-50 z-[101] shadow-2xl flex flex-col border-l border-slate-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 bg-white border-bottom border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-100">
                  <Settings className="w-5 h-5 text-emerald-600" />
                </div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  {t('account.title')}
                </h2>
              </div>
              <button
                onClick={() => setIsAccountOpen(false)}
                className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 custom-scrollbar">
              {isLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                  </div>
                </div>
              ) : !user ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center border border-slate-200">
                    <User className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="text-lg font-bold text-slate-500">{t('account.not_logged_in')}</p>
                </div>
              ) : (
                <>
                  {/* 使用者資訊卡 */}
                  <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 rounded-3xl p-6 text-white shadow-xl shadow-emerald-100">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="relative flex items-center gap-5">
                      <div className="relative flex-shrink-0">
                        {user.user_metadata?.avatar_url ? (
                          <img
                            src={user.user_metadata.avatar_url}
                            alt="Avatar"
                            className="w-16 h-16 rounded-2xl border-2 border-white/30 shadow-lg object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                            <User className="w-8 h-8 text-white/80" />
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-emerald-700 shadow-lg" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xl font-black truncate">
                          {user.user_metadata?.full_name || profile?.username || 'Member'}
                        </h3>
                        <p className="text-emerald-200 text-sm truncate mt-0.5">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex p-1.5 bg-slate-200/50 rounded-2xl border border-slate-200/30">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                          flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black
                          transition-all duration-300 cursor-pointer
                          ${
                            activeTab === tab.id
                              ? 'bg-white text-emerald-700 shadow-md ring-1 ring-slate-100'
                              : 'text-slate-400 hover:text-slate-600'
                          }
                        `}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab Content */}
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8">
                    {activeTab === 'profile' ? (
                      <div className="space-y-8">
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 mb-6 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                            {t('account.profile_info')}
                          </h4>
                          <div className="space-y-4">
                             <div className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                              <ShieldCheck className={`w-4 h-4 ${
                                profile?.role === 'admin' ? 'text-red-500' : 
                                profile?.role === 'curator' ? 'text-amber-500' : 'text-slate-400'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{t('account.role')}</p>
                                <p className={`text-sm font-black ${
                                  profile?.role === 'admin' ? 'text-red-600' : 
                                  profile?.role === 'curator' ? 'text-amber-600' : 'text-slate-700'
                                }`}>
                                  {t(`account.role_${profile?.role || 'guest'}`)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                              <Calendar className="w-4 h-4 text-emerald-600" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{t('account.member_since')}</p>
                                <p className="text-sm font-bold text-slate-700 truncate">{formatDate(user.created_at)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                              <Clock className="w-4 h-4 text-sky-600" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{t('account.last_online')}</p>
                                <p className="text-sm font-bold text-slate-700 truncate">{formatDateTime(profile?.last_online_at || user.last_sign_in_at)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="border-t border-slate-100 pt-8">
                          <UsernameForm />
                        </div>
                      </div>
                    ) : activeTab === 'bookmarks' ? (
                      <BookmarksSection />
                    ) : (
                      <CuratorDraftsSection />
                    )}
                  </div>
                </>
              )}
              
              {/* 底部預留空間 (防止被 Tab Bar 遮擋雖然它是 z-101，但為了捲動體驗) */}
              <div className={openSpeciesIds.length > 0 ? 'h-32' : 'h-10'} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
