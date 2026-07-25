'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';

interface RejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmReject: (reason: string) => void;
  articleTitle: string;
}

export default function RejectModal({
  isOpen,
  onClose,
  onConfirmReject,
  articleTitle,
}: RejectModalProps) {
  const { language } = useLanguage();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setIsSubmitting(true);
    onConfirmReject(reason.trim());
    setIsSubmitting(false);
    setReason('');
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 p-6"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5 text-rose-700">
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-100">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="font-bold text-base">
                {language === 'zh' ? '退回文章投稿 (Reject Article)' : 'Reject Article Submission'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="pt-4 space-y-4">
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              {language === 'zh'
                ? `您正準備退回文章《${articleTitle}》。請輸入退回原因或修改建議，作者將能看到此反饋並進行修正再提交：`
                : `You are about to reject "${articleTitle}". Please provide rejection reason or revision feedback for the author:`}
            </p>

            <div>
              <textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  language === 'zh'
                    ? '例如：請補充英文版本的內容與摘要，並確認封面圖片為高清無版權爭議照片...'
                    : 'e.g. Please supply English title & summary, and ensure image rights are verified...'
                }
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none text-slate-800 text-sm bg-slate-50/50"
                required
              />
            </div>

            <div className="flex justify-end items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-xs transition-colors"
              >
                {language === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !reason.trim()}
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {language === 'zh' ? '確認退回投稿' : 'Confirm Rejection'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
