'use client';

import { useState } from 'react';
import { User, Heart, Calendar, Clock, Mail, ArrowLeft, Settings } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import UsernameForm from './UsernameForm';
import BookmarksSection from './BookmarksSection';

type TabType = 'profile' | 'bookmarks';

export default function AccountPanel() {
  const { user, profile, isLoading } = useAuth();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>('profile');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center space-y-6 max-w-sm">
          <div className="w-20 h-20 mx-auto bg-slate-50 rounded-3xl flex items-center justify-center border border-slate-100">
            <User className="w-10 h-10 text-slate-300" />
          </div>
          <p className="text-lg font-bold text-slate-500">{t('account.not_logged_in')}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('account.back')}
          </Link>
        </div>
      </div>
    );
  }

  // 格式化日期
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

  return (
    <div className="min-h-screen pt-32 sm:pt-40 pb-16 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-8">
        
        {/* 頁面標題區 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl border border-slate-100 hover:border-emerald-200 transition-all duration-300 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Settings className="w-6 h-6 text-emerald-600" />
                {t('account.title')}
              </h1>
            </div>
          </div>
        </div>

        {/* 使用者基本資訊卡（始終可見） */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 rounded-3xl p-6 sm:p-8 text-white shadow-2xl shadow-emerald-200">
          {/* 裝飾性背景圖案 */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative flex items-center gap-5">
            {/* 頭像 */}
            <div className="relative flex-shrink-0">
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="Avatar"
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-3 border-white/30 shadow-xl object-cover"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                  <User className="w-8 h-8 text-white/80" />
                </div>
              )}
              {/* 線上狀態指示器 */}
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-3 border-emerald-700 shadow-lg" />
            </div>

            {/* 姓名與 Email */}
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-black truncate">
                {user.user_metadata?.full_name || profile?.username || 'Member'}
              </h2>
              <p className="text-emerald-200 text-sm truncate mt-0.5">
                @{profile?.username || '—'}
              </p>
              <p className="text-emerald-300/70 text-xs truncate mt-1">
                {user.email}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs 切換區 */}
        <div className="flex p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black
                transition-all duration-300 cursor-pointer
                ${
                  activeTab === tab.id
                    ? 'bg-white text-emerald-700 shadow-lg shadow-slate-200/50'
                    : 'text-slate-400 hover:text-slate-600'
                }
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 內容區 */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50 p-6 sm:p-8">
          {activeTab === 'profile' ? (
            <div className="space-y-8">
              {/* 帳號資訊區塊 */}
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-300 mb-5 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  {t('account.profile_info')}
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* 加入日期 */}
                  <div className="flex items-start gap-3 p-4 bg-slate-50/70 rounded-2xl border border-slate-100">
                    <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 flex-shrink-0">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {t('account.member_since')}
                      </p>
                      <p className="text-sm font-bold text-slate-700 mt-0.5">
                        {formatDate(user.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* 最後登入 */}
                  <div className="flex items-start gap-3 p-4 bg-slate-50/70 rounded-2xl border border-slate-100">
                    <div className="p-2.5 bg-sky-50 rounded-xl border border-sky-100 flex-shrink-0">
                      <Clock className="w-4 h-4 text-sky-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {t('account.last_online')}
                      </p>
                      <p className="text-sm font-bold text-slate-700 mt-0.5">
                        {formatDateTime(profile?.last_online_at || user.last_sign_in_at)}
                      </p>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="sm:col-span-2 flex items-start gap-3 p-4 bg-slate-50/70 rounded-2xl border border-slate-100">
                    <div className="p-2.5 bg-violet-50 rounded-xl border border-violet-100 flex-shrink-0">
                      <Mail className="w-4 h-4 text-violet-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {t('account.email')}
                      </p>
                      <p className="text-sm font-bold text-slate-700 mt-0.5 truncate">
                        {user.email || '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 分隔線 */}
              <div className="border-t border-slate-100" />

              {/* 使用者名稱編輯區 */}
              <UsernameForm />
            </div>
          ) : (
            <BookmarksSection />
          )}
        </div>
      </div>
    </div>
  );
}
