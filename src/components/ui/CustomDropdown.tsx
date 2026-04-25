'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  options: Option[];
  value: string;
  onChange: (value: any) => void;
  label?: string;
  size?: 'normal' | 'sm';
  placeholder?: string;
  className?: string;
  align?: 'left' | 'right';
}

export default function CustomDropdown({ 
  options, 
  value, 
  onChange, 
  label, 
  size = 'normal',
  placeholder = 'Select...',
  className = '',
  align = 'left'
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const selectedOption = options.find(opt => opt.value === value);
  const isSmall = size === 'sm';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center justify-between gap-1 transition-all duration-300
          border outline-none group w-full
          ${isSmall 
            ? 'px-2 py-1.5 rounded-lg text-xs font-bold min-h-[36px]' 
            : 'px-5 py-2.5 rounded-xl text-sm font-bold min-w-[180px]'}
          ${isOpen 
            ? 'bg-white border-emerald-200 shadow-xl shadow-emerald-50 ring-4 ring-emerald-50/50' 
            : 'bg-slate-50 border-transparent text-slate-700 hover:bg-white hover:border-emerald-100 hover:shadow-lg hover:shadow-slate-200/50'}
        `}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`shrink-0 text-slate-400 transition-transform duration-300 ${isSmall ? 'w-3 h-3' : 'w-4 h-4'} ${isOpen ? 'rotate-180 text-emerald-500' : 'group-hover:text-slate-600'}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={`
          absolute top-full mt-2 bg-white border border-slate-100 shadow-2xl shadow-slate-200/80 p-1.5 z-[100] animate-in fade-in zoom-in-95 duration-200
          ${align === 'right' ? 'right-0' : 'left-0'}
          ${isSmall ? 'rounded-xl min-w-[90px]' : 'rounded-2xl min-w-[200px]'}
        `}>
          <div className="space-y-0.5 max-h-[300px] overflow-y-auto custom-scrollbar">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`
                  w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-left font-bold
                  ${isSmall ? 'text-[11px]' : 'text-sm'}
                  ${option.value === value 
                    ? 'bg-emerald-50 text-emerald-700' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                `}
              >
                <span className="truncate pr-2">{option.label}</span>
                {option.value === value && <Check className={isSmall ? 'w-3 h-3' : 'w-4 h-4'} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
