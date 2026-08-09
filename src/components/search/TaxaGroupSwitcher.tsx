'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Dog, Leaf } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export type TaxaType = 'fauna' | 'flora';

interface TaxaGroupSwitcherProps {
  activeType: TaxaType;
  onChange: (type: TaxaType) => void;
  compact?: boolean;
}

export default function TaxaGroupSwitcher({ activeType, onChange, compact = false }: TaxaGroupSwitcherProps) {
  const { language } = useLanguage();

  const options = [
    { id: 'fauna', label: language === 'zh' ? (compact ? '動物' : '動物 (Fauna)') : 'Fauna', icon: Dog },
    { id: 'flora', label: language === 'zh' ? (compact ? '植物' : '植物 (Flora)') : 'Flora', icon: Leaf },
  ] as const;

  return (
    <div className={`relative flex p-1 bg-slate-100 rounded-2xl w-full ring-1 ring-slate-200/50 shadow-inner ${compact ? 'mb-4' : 'mb-6'}`}>
      {/* Active Background Slide */}
      <motion.div
        className="absolute h-[calc(100%-8px)] bg-white rounded-xl shadow-sm z-0"
        initial={false}
        animate={{
          left: activeType === 'fauna' ? '4px' : '50%',
          width: 'calc(50% - 4px)'
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />

      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          className={`flex-1 relative z-10 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-widest transition-colors duration-300 ${
            activeType === option.id ? 'text-emerald-700' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <option.icon className={`w-4 h-4 ${activeType === option.id ? 'text-emerald-500' : 'text-slate-300'}`} />
          {option.label}
        </button>
      ))}
    </div>
  );
}
