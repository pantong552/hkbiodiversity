'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Sparkles, X, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { Profile } from '@/types/comments';

interface AuthReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  user: User | null;
  profile: Profile | null;
}

export default function AuthReminderModal({
  isOpen,
  onClose,
  featureName,
  user,
  profile
}: AuthReminderModalProps) {
  const { language } = useLanguage();
  const [isLoading, setIsLoading] = React.useState(false);
  const supabase = createClient();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('登入失敗:', error.message);
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const isNotActiveUser = Boolean(user && profile && profile.status !== 'active');

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/80 overflow-hidden z-10 p-6 sm:p-8 text-center"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 rounded-full transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Ambient Top Glow */}
          <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-emerald-500/15 via-emerald-500/5 to-transparent pointer-events-none" />

          {/* Badge Icon */}
          <div className="relative mx-auto mb-6 w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-xl shadow-emerald-500/20">
            <div className="w-full h-full bg-white rounded-[1.4rem] flex items-center justify-center">
              {isNotActiveUser ? (
                <ShieldAlert className="w-8 h-8 text-amber-500" />
              ) : (
                <Lock className="w-8 h-8 text-emerald-600" />
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 p-1.5 bg-emerald-500 rounded-full text-white shadow-md">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Content Heading */}
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-2">
            {isNotActiveUser 
              ? (language === 'zh' ? '帳號權限受限' : 'Account Status Restricted')
              : (language === 'zh' ? '會員限定功能' : 'Member Exclusive Feature')}
          </h3>

          {/* Subtitle / Feature Mention */}
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-4">
            {featureName 
              ? (language === 'zh' ? `解鎖 ${featureName}` : `Unlock ${featureName}`) 
              : (language === 'zh' ? '請登入或註冊會員' : 'Please Sign In or Register')}
          </p>

          {/* Main Description Text */}
          <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-4 mb-6 text-left space-y-2">
            {isNotActiveUser ? (
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                {language === 'zh'
                  ? `您目前的帳號狀態為「${profile?.status || 'Pending'}」。此功能（資料庫、Quick Search 及 AI 物種辨識）僅開放給 Active 狀態的正式會員。如有疑問請聯絡管理員啟用帳號。`
                  : `Your account status is currently "${profile?.status || 'Pending'}". This feature requires an "Active" user status. Please contact an administrator to activate your account.`}
              </p>
            ) : (
              <>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  {language === 'zh'
                    ? '資料庫瀏覽、Quick Search 快速搜尋及 AI 物種辨識功能僅開放給登入會員及狀態為 Active 之用戶使用。'
                    : 'Species Database browsing, Quick Search, and AI Photo Recognition are restricted to signed-in Active members.'}
                </p>
                <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{language === 'zh' ? '完整香港生物物種資料庫存取' : 'Full Hong Kong Biodiversity Database Access'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{language === 'zh' ? '即時 AI 相片物種識別與分類' : 'Instant AI Photo Recognition'}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          {!isNotActiveUser ? (
            <div className="space-y-3">
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full py-4 px-6 bg-slate-900 hover:bg-emerald-600 text-white font-bold text-sm rounded-2xl shadow-xl shadow-slate-900/10 hover:shadow-emerald-500/20 transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer group active:scale-[0.98]"
              >
                {isLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                <span>{isLoading ? (language === 'zh' ? '跳轉中...' : 'Redirecting...') : (language === 'zh' ? '使用 Google 免費登入 / 註冊' : 'Sign In with Google')}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={onClose}
                className="w-full py-3 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                {language === 'zh' ? '稍後再說' : 'Maybe Later'}
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-3.5 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-2xl transition-all cursor-pointer"
            >
              {language === 'zh' ? '我知道了' : 'I Understand'}
            </button>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
