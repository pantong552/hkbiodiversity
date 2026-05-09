'use client';

import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { motion } from 'framer-motion';
import { Languages } from 'lucide-react';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  const options = [
    { id: 'zh', label: '繁體中文' },
    { id: 'en', label: 'English' }
  ] as const;

  return (
    <div className="flex flex-col gap-2 px-1">
      <div className="flex items-center gap-2 px-2">
        <Languages className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Language / 語言
        </span>
      </div>
      
      <div className="relative p-1 bg-slate-100/80 backdrop-blur-sm rounded-2xl flex items-center border border-slate-200/50">
        {options.map((option) => {
          const isActive = language === option.id;
          
          return (
            <button
              key={option.id}
              onClick={() => setLanguage(option.id)}
              className={`relative flex-1 py-2 text-[11px] font-bold transition-colors duration-200 z-10 ${
                isActive ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-lang-bg"
                  className="absolute inset-0 bg-white rounded-xl shadow-sm border border-slate-200/30"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
