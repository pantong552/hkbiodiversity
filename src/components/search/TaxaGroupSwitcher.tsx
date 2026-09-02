'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, Dog, Leaf, ChevronDown, Check } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export type TaxaType = 'fauna' | 'flora' | 'fungi';

function MushroomIcon({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12 3C6.5 3 2.5 7.5 2.5 12.5c0 .3.2.5.5.5h18c.3 0 .5-.2.5-.5C21.5 7.5 17.5 3 12 3z" />
      <path d="M10 13v6a2 2 0 0 0 4 0v-6" />
      <circle cx="7.5" cy="8" r="1" fill="currentColor" />
      <circle cx="16.5" cy="8" r="1" fill="currentColor" />
      <circle cx="12" cy="6" r="1" fill="currentColor" />
    </svg>
  );
}

interface TaxaGroupSwitcherProps {
  activeType: TaxaType;
  onChange: (type: TaxaType) => void;
  compact?: boolean;
  variant?: 'default' | 'header';
}

export default function TaxaGroupSwitcher({ activeType, onChange, compact = false, variant = 'default' }: TaxaGroupSwitcherProps) {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const options = [
    { 
      id: 'fauna' as const, 
      label: language === 'zh' ? '動物 (Fauna)' : 'Fauna',
      icon: Dog,
      iconColor: 'text-amber-600',
      activeBg: 'bg-amber-50 text-amber-900 border-amber-200/80',
    },
    { 
      id: 'flora' as const, 
      label: language === 'zh' ? '植物 (Flora)' : 'Flora',
      icon: Leaf,
      iconColor: 'text-emerald-600',
      activeBg: 'bg-emerald-50 text-emerald-950 border-emerald-200/80',
    },
    { 
      id: 'fungi' as const, 
      label: language === 'zh' ? '真菌 (Fungi)' : 'Fungi',
      icon: MushroomIcon,
      iconColor: 'text-purple-600',
      activeBg: 'bg-purple-50 text-purple-950 border-purple-200/80',
    },
  ];

  const currentOption = options.find(o => o.id === activeType) || options[0];

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left w-full" ref={dropdownRef}>
      {/* Prominent Header-style Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          group w-full flex items-center justify-between gap-3 px-3.5 py-2.5
          bg-white hover:bg-emerald-50/40 border-2 border-emerald-600/30 hover:border-emerald-600/60
          rounded-2xl transition-all duration-200 cursor-pointer outline-none select-none shadow-sm hover:shadow-md active:scale-[0.99]
          ${isOpen ? 'ring-4 ring-emerald-500/20 border-emerald-600 shadow-md bg-white' : ''}
        `}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Prominent Solid Filter Icon Badge */}
          <div className="p-1.5 rounded-xl bg-emerald-600 text-white shadow-xs group-hover:scale-105 transition-transform shrink-0">
            <Filter className="w-4 h-4" />
          </div>
          <span className="text-sm font-black text-slate-900 tracking-tight truncate">
            {currentOption.label}
          </span>
        </div>
        <ChevronDown 
          className={`w-4 h-4 text-emerald-600 font-bold shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-emerald-700' : 'group-hover:text-emerald-700'}`} 
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 4 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 right-0 z-[120] mt-1.5 p-1.5 bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl shadow-2xl ring-1 ring-black/5"
          >
            <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
              {language === 'zh' ? '切換物種類別' : 'Switch Taxa Group'}
            </div>
            
            {options.map((option) => {
              const isSelected = activeType === option.id;
              const Icon = option.icon;

              return (
                <button
                  key={option.id}
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-black transition-all duration-150 cursor-pointer
                    ${isSelected 
                      ? `${option.activeBg} border shadow-2xs` 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }
                  `}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isSelected ? option.iconColor : 'text-slate-400'}`} />
                    <span>{option.label}</span>
                  </div>

                  {isSelected && (
                    <Check className={`w-4 h-4 ${option.iconColor}`} />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}





