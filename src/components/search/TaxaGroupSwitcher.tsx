'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dog, Leaf, ChevronDown, Check } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export type TaxaType = 'fauna' | 'flora';

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
      shortLabel: language === 'zh' ? '動物' : 'Fauna',
      icon: Dog,
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-700',
      iconColor: 'text-amber-600',
      ringColor: 'ring-amber-200'
    },
    { 
      id: 'flora' as const, 
      label: language === 'zh' ? '植物 (Flora)' : 'Flora', 
      shortLabel: language === 'zh' ? '植物' : 'Flora',
      icon: Leaf,
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-700',
      iconColor: 'text-emerald-600',
      ringColor: 'ring-emerald-200'
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
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center justify-between gap-2 transition-all duration-200 cursor-pointer
          ${variant === 'header'
            ? 'px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 shadow-sm active:scale-95'
            : 'w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-xs font-black text-slate-700 shadow-sm mb-4'
          }
        `}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1 rounded-lg ${currentOption.bgColor} ${currentOption.textColor}`}>
            <currentOption.icon className="w-3.5 h-3.5" />
          </div>
          <span className="truncate font-extrabold tracking-wide">
            {variant === 'header' ? currentOption.shortLabel : currentOption.label}
          </span>
        </div>
        <ChevronDown 
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-emerald-600' : ''}`} 
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 4 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`
              absolute right-0 z-[120] w-44 p-1.5 bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-xl ring-1 ring-black/5
            `}
          >
            <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
              {language === 'zh' ? '選擇物種類別' : 'Select Taxa Group'}
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
                    w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer
                    ${isSelected 
                      ? `${option.bgColor} ${option.textColor} font-black` 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }
                  `}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1 rounded-lg ${isSelected ? 'bg-white shadow-xs' : 'bg-slate-100'}`}>
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? option.iconColor : 'text-slate-400'}`} />
                    </div>
                    <span>{option.label}</span>
                  </div>

                  {isSelected && (
                    <Check className={`w-3.5 h-3.5 ${option.iconColor}`} />
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


