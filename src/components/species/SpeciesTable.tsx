'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, Search, ArrowUpDown, ExternalLink } from 'lucide-react';
import { Species } from '@/types/species';
import { useLanguage } from '@/context/LanguageContext';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';
import { getIUCNConfig } from '@/constants/statusStyles';

interface SpeciesTableProps {
  species: Species[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
}

export default function SpeciesTable({ species, sortBy, sortOrder, onSort }: SpeciesTableProps) {
  const { language, t } = useLanguage();
  const { addSpecies } = useSpeciesPanel();
  const [localFilters, setLocalFilters] = useState<Record<string, string>>({});

  const columns = [
    { key: 'order', label: t('table.order'), sortable: true, mobile: false },
    { key: 'family', label: t('table.family'), sortable: true, mobile: false },
    { key: 'scientific_name', label: t('table.scientific_name'), sortable: true, mobile: true },
    { key: 'common_name', label: t('table.common_name'), sortable: true, mobile: true },
    { key: 'native_status', label: t('table.native_status'), sortable: true, mobile: false },
    { key: 'iucn', label: t('table.iucn_status'), sortable: true, mobile: true },
  ];

  const handleFilterChange = (key: string, value: string) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  // 即使伺服器端已經過濾了，我們可以在本地進行二次過濾以支持 Header Filter
  const filteredSpecies = species.filter(item => {
    return Object.entries(localFilters).every(([key, value]) => {
      if (!value) return true;
      const itemValue = String((item as any)[key] || '').toLowerCase();
      // 特殊處理顯示名稱
      if (key === 'common_name') {
        const name = language === 'zh' ? item.common_name_chi : item.common_name_eng;
        return name?.toLowerCase().includes(value.toLowerCase());
      }
      if (key === 'order' || key === 'family' || key === 'genus') {
         const name = language === 'zh' ? (item as any)[`${key}_chi`] : (item as any)[`${key}_eng`];
         return name?.toLowerCase().includes(value.toLowerCase());
      }
      return itemValue.includes(value.toLowerCase());
    });
  });

  return (
    <div className="w-full bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden animate-in fade-in duration-500">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px] md:min-w-full">
          <thead>
            {/* Header Labels & Sorting */}
            <tr className="bg-slate-50/50 border-b border-slate-100">
              {columns.map((col) => (
                <th 
                  key={col.key}
                  className={`
                    px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400 
                    ${!col.mobile ? 'hidden md:table-cell' : ''}
                  `}
                >
                  <div 
                    className={`flex items-center gap-2 ${col.sortable ? 'cursor-pointer hover:text-emerald-600 transition-colors' : ''}`}
                    onClick={() => col.sortable && onSort(col.key)}
                  >
                    {col.label}
                    {col.sortable && (
                      <div className="flex flex-col">
                        {sortBy === col.key ? (
                          sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-emerald-500" /> : <ChevronDown className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-20" />
                        )}
                      </div>
                    )}
                  </div>
                </th>
              ))}
              <th className="px-6 py-5 w-16"></th>
            </tr>

            {/* Header Filters */}
            <tr className="bg-white border-b border-slate-50">
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-3 ${!col.mobile ? 'hidden md:table-cell' : ''}`}>
                  <div className="relative group">
                    {col.key === 'iucn' || col.key === 'native_status' ? (
                      <select 
                        value={localFilters[col.key] || ''}
                        onChange={(e) => handleFilterChange(col.key, e.target.value)}
                        className="w-full bg-slate-50/50 border border-transparent focus:border-emerald-100 focus:bg-white rounded-xl px-3 py-2 text-xs font-bold outline-none transition-all appearance-none cursor-pointer"
                      >
                        <option value="">{t('filter.reset')}</option>
                        {col.key === 'iucn' ? (
                          <>
                            <option value="Critically Endangered">Critically Endangered (CR)</option>
                            <option value="Endangered">Endangered (EN)</option>
                            <option value="Vulnerable">Vulnerable (VU)</option>
                            <option value="Near Threatened">Near Threatened (NT)</option>
                            <option value="Least Concern">Least Concern (LC)</option>
                            <option value="Data Deficient">Data Deficient (DD)</option>
                          </>
                        ) : (
                          <>
                            <option value="Native">Native</option>
                            <option value="Exotic">Exotic</option>
                            <option value="Reintroduced">Reintroduced</option>
                          </>
                        )}
                      </select>
                    ) : (
                      <>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                        <input 
                          type="text"
                          placeholder={`${t('filter.reset')}...`}
                          value={localFilters[col.key] || ''}
                          onChange={(e) => handleFilterChange(col.key, e.target.value)}
                          className="w-full bg-slate-50/50 border border-transparent focus:border-emerald-100 focus:bg-white rounded-xl pl-9 pr-3 py-2 text-xs font-medium outline-none transition-all placeholder:text-slate-300"
                        />
                      </>
                    )}
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-slate-50">
            {filteredSpecies.map((item) => {
              const iucnConfig = getIUCNConfig(item.iucn);
              return (
                <tr 
                  key={item.id}
                  onClick={() => addSpecies(item.id)}
                  className="group hover:bg-emerald-50/30 transition-colors cursor-pointer"
                >
                  {/* Order */}
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className="text-[13px] font-bold text-slate-600">
                      {language === 'zh' ? item.order_chi : item.order_eng}
                    </span>
                  </td>
                  
                  {/* Family */}
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className="text-[13px] font-medium text-slate-500">
                      {language === 'zh' ? item.family_chi : item.family_eng}
                    </span>
                  </td>

                  {/* Scientific Name */}
                  <td className="px-6 py-4">
                    <span className="text-[14px] font-serif italic font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
                      {item.scientific_name}
                    </span>
                  </td>

                  {/* Common Name */}
                  <td className="px-6 py-4">
                    <span className="text-[14px] font-black text-slate-900">
                      {language === 'zh' ? item.common_name_chi : item.common_name_eng}
                    </span>
                  </td>

                  {/* Native Status */}
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${item.native_status?.includes('Native') ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500'}`}>
                      {item.native_status || 'Unknown'}
                    </span>
                  </td>

                  {/* IUCN Status */}
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm ${iucnConfig.styles}`}>
                      {language === 'zh' ? iucnConfig.label.zh : iucnConfig.label.en}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="px-6 py-4 text-right">
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {filteredSpecies.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-slate-400 font-medium">找不到匹配的資料</p>
        </div>
      )}
    </div>
  );
}
