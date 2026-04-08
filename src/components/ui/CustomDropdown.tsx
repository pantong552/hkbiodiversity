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
}

export default function CustomDropdown({ options, value, onChange, label }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const selectedOption = options.find(opt => opt.value === value) || options[0];

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
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center justify-between gap-3 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300
          border outline-none min-w-[180px] group
          ${isOpen 
            ? 'bg-white border-emerald-200 shadow-xl shadow-emerald-50 ring-4 ring-emerald-50/50' 
            : 'bg-slate-50 border-transparent text-slate-700 hover:bg-white hover:border-emerald-100 hover:shadow-lg hover:shadow-slate-200/50'}
        `}
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-emerald-500' : 'group-hover:text-slate-600'}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-[200px] bg-white/95 backdrop-blur-2xl border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/80 p-2 z-[100] animate-in fade-in zoom-in-95 duration-200">
          <div className="space-y-1">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`
                  w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-bold transition-all text-left
                  ${option.value === value 
                    ? 'bg-emerald-50 text-emerald-700' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                `}
              >
                {option.label}
                {option.value === value && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
