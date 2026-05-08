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
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import UsersManager from '@/components/admin/UsersManager';
import TaxaManager from '@/components/admin/TaxaManager';
import { motion, AnimatePresence } from 'framer-motion';

type AdminTab = 'users' | 'taxa';

// --- Custom Confirmation Modal ---
function CustomConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText, 
  cancelText 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-[320px] bg-white rounded-[2rem] shadow-2xl shadow-slate-900/40 overflow-hidden"
          >
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <ShieldCheck className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight mb-2">{title}</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed px-2">
                {message}
              </p>
            </div>
            <div className="flex border-t border-slate-100">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-4 text-xs font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 px-4 py-4 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors border-l border-slate-100"
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default function MaintainPage() {
  const { profile, isLoading } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; onConfirm: (() => void) | null }>({
    isOpen: false,
    onConfirm: null
  });

  useEffect(() => {
    if (!isLoading && (!profile || profile.role !== 'admin')) {
      router.push('/');
    }
  }, [profile, isLoading, router]);

  if (isLoading || !profile || profile.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
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

      <div className="flex-1 flex flex-col lg:flex-row relative z-10 pt-4 lg:pt-6">
        {/* Left Sidebar - Fixed on Desktop */}
        <aside className="w-full lg:w-72 xl:w-80 lg:h-[calc(100vh-60px)] lg:sticky lg:top-6 px-6 lg:pl-8 lg:pr-4 mb-8 lg:mb-0 flex flex-col gap-6">
          <div className="space-y-6">
            <Link 
              href="/"
              className="inline-flex items-center gap-2 text-xs font-black text-emerald-600 uppercase tracking-widest hover:gap-3 transition-all group"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('account.back')}
            </Link>
            
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-2xl shadow-xl shadow-emerald-200/40 border border-emerald-100">
                <ShieldCheck className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-2xl xl:text-3xl font-black text-slate-900 tracking-tighter leading-none">
                  {t('admin.title')}
                </h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
                  Management Console
                </p>
              </div>
            </div>
          </div>

          <nav className="flex flex-col gap-2">
            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center justify-between p-4 rounded-3xl transition-all group ${
                activeTab === 'users' 
                  ? 'bg-white shadow-xl shadow-slate-200/50 border border-slate-100 text-slate-900' 
                  : 'text-slate-500 hover:bg-white/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl transition-colors ${activeTab === 'users' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600'}`}>
                  <Users className="w-5 h-5" />
                </div>
                <span className="font-bold">{t('admin.users_manager')}</span>
              </div>
              <ChevronRight className={`w-4 h-4 transition-transform ${activeTab === 'users' ? 'opacity-100' : 'opacity-0 -translate-x-2'}`} />
            </button>

            <button
              onClick={() => setActiveTab('taxa')}
              className={`w-full flex items-center justify-between p-4 rounded-3xl transition-all group ${
                activeTab === 'taxa' 
                  ? 'bg-white shadow-xl shadow-slate-200/50 border border-slate-100 text-slate-900' 
                  : 'text-slate-500 hover:bg-white/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl transition-colors ${activeTab === 'taxa' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600'}`}>
                  <Package className="w-5 h-5" />
                </div>
                <span className="font-bold">{t('admin.taxa_manager')}</span>
              </div>
              <ChevronRight className={`w-4 h-4 transition-transform ${activeTab === 'taxa' ? 'opacity-100' : 'opacity-0 -translate-x-2'}`} />
            </button>
            
            {/* Help box removed */}
          </nav>
        </aside>

          {/* Main Content Area */}
          <main className="flex-1 px-4 lg:pr-8 lg:pl-4 pb-20">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-white/40 backdrop-blur-2xl rounded-[2.5rem] border border-white p-4 md:p-8 shadow-2xl shadow-slate-200/40 min-h-[calc(100vh-120px)]"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <div className="w-2 h-6 bg-emerald-500 rounded-full" />
                  {activeTab === 'users' ? t('admin.users_manager') : t('admin.taxa_manager')}
                </h2>
              </div>
              {activeTab === 'users' ? (
                <UsersManager 
                  onRequestConfirm={(onConfirm) => setConfirmModal({ isOpen: true, onConfirm })} 
                />
              ) : <TaxaManager />}
            </motion.div>
          </main>
        </div>

      <CustomConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, onConfirm: null })}
        onConfirm={() => {
          if (confirmModal.onConfirm) confirmModal.onConfirm();
          setConfirmModal({ isOpen: false, onConfirm: null });
        }}
        title={t('admin.confirm_remove_title')}
        message={t('admin.confirm_remove')}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
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
