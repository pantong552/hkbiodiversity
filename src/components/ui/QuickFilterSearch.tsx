'use client';

import React, { useState, useEffect } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface QuickFilterSearchProps {
  initialValue?: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onClear?: () => void;
  className?: string;
}

export default function QuickFilterSearch({
  initialValue = '',
  placeholder,
  onSubmit,
  onClear,
  className = ''
}: QuickFilterSearchProps) {
  const { language } = useLanguage();
  const [localValue, setLocalValue] = useState(initialValue);

  // Sync with initialValue (e.g. when filters are reset globally)
  useEffect(() => {
    setLocalValue(initialValue);
  }, [initialValue]);

  const handleSubmit = () => {
    onSubmit(localValue.trim());
  };

  const handleReset = () => {
    setLocalValue('');
    if (onClear) {
      onClear();
    } else {
      onSubmit('');
    }
  };

  return (
    <div className={`relative group flex items-center ${className}`}>
      <button 
        onClick={handleSubmit}
        className="absolute left-2 p-2.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all active:scale-95 z-10"
        title={language === 'zh' ? '搜尋' : 'Search'}
      >
        <Search className="w-5 h-5 group-focus-within:text-emerald-500" />
      </button>
      
      <input 
        type="text" 
        placeholder={placeholder || (language === 'zh' ? '快速搜尋...' : 'Quick search...')} 
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        onBlur={() => setLocalValue(initialValue)}
        suppressHydrationWarning={true}
        className="w-full pl-12 pr-12 py-4 bg-emerald-50/30 border-2 border-transparent rounded-2xl text-emerald-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50/50 transition-all outline-none text-sm"
      />

      {localValue && (
        <button
          onClick={handleReset}
          className="absolute right-2 p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-95 z-10"
          title={language === 'zh' ? '重設搜尋' : 'Reset Search'}
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
