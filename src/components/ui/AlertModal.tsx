'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, AlertTriangle, Trash2, XCircle, Info, LucideIcon } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export type AlertType = 'warning' | 'danger' | 'info' | 'success';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: AlertType;
  icon?: LucideIcon;
}

/**
 * 通用警告彈窗 - 緊湊精緻版
 * 特色：減弱毛玻璃效果以看清背景資料、更瘦長的卡片設計、緊湊間距但維持字體大小
 */
export default function AlertModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  type = 'warning',
  icon: CustomIcon,
}: AlertModalProps) {
  const { language } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const getIcon = () => {
    if (CustomIcon) return <CustomIcon className="w-6 h-6" />;
    switch (type) {
      case 'danger': return <Trash2 className="w-6 h-6 text-rose-500" />;
      case 'success': return <Info className="w-6 h-6 text-emerald-500" />;
      case 'info': return <Info className="w-6 h-6 text-blue-500" />;
      default: return <RotateCcw className="w-6 h-6 text-rose-500" />;
    }
  };

  const getIconBg = () => {
    switch (type) {
      case 'danger': return 'bg-rose-50';
      case 'success': return 'bg-emerald-50';
      case 'info': return 'bg-blue-50';
      default: return 'bg-rose-50';
    }
  };

  const getConfirmTextColor = () => {
    switch (type) {
      case 'danger': return 'text-rose-600';
      case 'success': return 'text-emerald-600';
      case 'info': return 'text-blue-600';
      default: return 'text-rose-600';
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-6">
          {/* Backdrop with subtle blur to see content behind */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40"
            style={{ 
              backdropFilter: 'blur(8px) saturate(110%)',
              WebkitBackdropFilter: 'blur(8px) saturate(110%)'
            }}
          />
          
          {/* Compact Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            className="relative w-full max-w-[300px] bg-white rounded-[2.2rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] overflow-hidden"
          >
            <div className="pt-8 pb-5 px-6 text-center">
              <div className={`w-14 h-14 ${getIconBg()} rounded-[1.2rem] flex items-center justify-center mb-4 mx-auto`}>
                {getIcon()}
              </div>
              
              <h3 className="text-[19px] font-black text-[#1e293b] mb-2 tracking-tight">
                {title}
              </h3>
              <p className="text-slate-500 text-[13px] font-medium leading-[1.5] px-1">
                {description}
              </p>
            </div>

            {/* Compact Grid Buttons */}
            <div className="grid grid-cols-2 border-t border-slate-50 relative">
              <button
                onClick={onClose}
                className="py-4 text-[13px] font-black text-slate-400 hover:bg-slate-50 transition-all active:bg-slate-100 uppercase tracking-widest"
              >
                {cancelLabel || (language === 'zh' ? '取消' : 'Cancel')}
              </button>
              
              {/* Thin Divider */}
              <div className="absolute left-1/2 top-0 bottom-0 w-[0.5px] bg-slate-100" />
              
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`py-4 text-[13px] font-black transition-all active:bg-slate-100 uppercase tracking-widest hover:bg-slate-50 ${getConfirmTextColor()}`}
              >
                {confirmLabel || (language === 'zh' ? '確認' : 'Confirm')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
