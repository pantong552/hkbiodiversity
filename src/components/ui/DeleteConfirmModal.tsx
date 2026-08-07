'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
  title?: string;
  description?: string;
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  title,
  description
}: DeleteConfirmModalProps) {
  const { language } = useLanguage();

  if (!isOpen) return null;

  const defaultTitle = language === 'zh' ? '確認刪除此相片？' : 'Delete Photo?';
  const defaultDescription = language === 'zh'
    ? '此動作將無法復原。這張相片將會永久從 Cloudinary 及資料庫中刪除。'
    : 'This action cannot be undone. This photo will be permanently removed from Cloudinary and the database.';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !isLoading && onClose()}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/80 overflow-hidden z-10 p-6 sm:p-8 text-center"
        >
          {/* Top Ambient Glow */}
          <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-rose-500/15 via-rose-500/5 to-transparent pointer-events-none" />

          {/* Close button */}
          <button
            onClick={onClose}
            disabled={isLoading}
            className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 rounded-full transition-all cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Badge Icon */}
          <div className="relative mx-auto mb-6 w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-rose-500 to-red-400 p-0.5 shadow-xl shadow-rose-500/25">
            <div className="w-full h-full bg-white rounded-[1.4rem] flex items-center justify-center">
              <Trash2 className="w-8 h-8 text-rose-500 stroke-[2.25]" />
            </div>
            <div className="absolute -bottom-1 -right-1 p-1.5 bg-rose-500 rounded-full text-white shadow-md">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Content Heading & Description */}
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-2">
            {title || defaultTitle}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed mb-8 px-2">
            {description || defaultDescription}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-3.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {language === 'zh' ? '取消' : 'Cancel'}
            </button>

            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-bold text-sm shadow-lg shadow-rose-500/30 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>{language === 'zh' ? '刪除中...' : 'Deleting...'}</span>
                </>
              ) : (
                <span>{language === 'zh' ? '確定刪除' : 'Yes, Delete'}</span>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
