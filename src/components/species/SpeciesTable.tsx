import { useMemo, useEffect, useState } from 'react';
import { ChevronUp, ChevronDown, Search, ArrowUpDown, ExternalLink } from 'lucide-react';
import { Species } from '@/types/species';
import { useLanguage } from '@/context/LanguageContext';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';
import { getIUCNConfig } from '@/constants/statusStyles';
import CustomDropdown from '@/components/ui/CustomDropdown';
import debounce from 'lodash/debounce';
import { formatScientificName } from '@/utils/formatters';

interface SpeciesTableProps {
  species: Species[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  filters: Record<string, string>;
  onFilterChange: (filters: Record<string, string>) => void;
  onSort: (field: string) => void;
}

export default function SpeciesTable({ 
  species, 
  sortBy, 
  sortOrder, 
  filters,
  onFilterChange,
  onSort 
}: SpeciesTableProps) {
  const { language, t } = useLanguage();
  const { addSpecies } = useSpeciesPanel();
  
  // Local state for immediate UI feedback on text inputs
  const [localSearchValues, setLocalSearchValues] = useState<Record<string, string>>(filters);

  // Sync local state when external filters change (e.g. on clear all)
  useEffect(() => {
    setLocalSearchValues(filters);
  }, [filters]);

  const applyFilter = (key: string) => {
    onFilterChange({ ...filters, [key]: localSearchValues[key] || '' });
  };

  const handleInputChange = (key: string, value: string) => {
    setLocalSearchValues(prev => ({ ...prev, [key]: value }));
  };

  const handleKeyDown = (e: React.KeyboardEvent, key: string) => {
    if (e.key === 'Enter') {
      applyFilter(key);
    }
  };

  const handleSelectChange = (key: string, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const iucnOptions = [
    { value: '', label: t('filter.reset') },
    { value: 'Critically Endangered', label: 'Critically Endangered (CR)' },
    { value: 'Endangered', label: 'Endangered (EN)' },
    { value: 'Vulnerable', label: 'Vulnerable (VU)' },
    { value: 'Near Threatened', label: 'Near Threatened (NT)' },
    { value: 'Least Concern', label: 'Least Concern (LC)' },
    { value: 'Data Deficient', label: 'Data Deficient (DD)' },
  ];

  const nativeOptions = [
    { value: '', label: t('filter.reset') },
    { value: 'Native', label: 'Native' },
    { value: 'Exotic', label: 'Exotic' },
    { value: 'Reintroduced', label: 'Reintroduced' },
  ];

  const columns = [
    { key: 'order', label: t('table.order'), sortable: true, mobile: false },
    { key: 'family', label: t('table.family'), sortable: true, mobile: false },
    { key: 'scientific_name', label: t('table.scientific_name'), sortable: true, mobile: true },
    { key: 'common_name', label: t('table.common_name'), sortable: true, mobile: true },
    { key: 'native_status', label: t('table.native_status'), sortable: true, mobile: false },
    { key: 'iucn', label: t('table.iucn_status'), sortable: true, mobile: true },
  ];

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
                    ${col.key === 'order' || col.key === 'family' ? 'w-[120px]' : ''}
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
            </tr>

            {/* Header Filters */}
            <tr className="bg-white border-b border-slate-50">
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-3 ${!col.mobile ? 'hidden md:table-cell' : ''} ${col.key === 'order' || col.key === 'family' ? 'w-[120px]' : ''}`}>
                  <div className="relative group">
                    {col.key === 'iucn' || col.key === 'native_status' ? (
                      <CustomDropdown
                        size="sm"
                        options={col.key === 'iucn' ? iucnOptions : nativeOptions}
                        value={filters[col.key] || ''}
                        onChange={(val) => handleSelectChange(col.key, val)}
                        placeholder=""
                      />
                    ) : (
                      <div className="relative flex items-center">
                        <Search 
                          className="absolute left-3 w-3.5 h-3.5 text-slate-300 group-focus-within:text-emerald-500 transition-colors cursor-pointer hover:scale-110 active:scale-95" 
                          onClick={() => applyFilter(col.key)}
                        />
                        <input 
                          type="text"
                          placeholder=""
                          value={localSearchValues[col.key] || ''}
                          onChange={(e) => handleInputChange(col.key, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, col.key)}
                          className="w-full bg-slate-50/50 border border-transparent focus:border-emerald-100 focus:bg-white rounded-xl pl-9 pr-4 py-2 text-xs font-medium outline-none transition-all placeholder:text-slate-300"
                        />
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          
          <tbody className="divide-y divide-slate-50">
            {species.map((item) => {
              const iucnConfig = getIUCNConfig(item.iucn);
              return (
                <tr 
                  key={item.id}
                  onClick={() => addSpecies(item.taxa_id)}
                  className="group hover:bg-emerald-50/30 transition-colors cursor-pointer"
                >
                  {/* Order */}
                  <td className="px-6 py-4 hidden md:table-cell w-[120px]">
                    <span className="text-[13px] font-bold text-slate-600 line-clamp-1">
                      {language === 'zh' ? item.order_chi : item.order_eng}
                    </span>
                  </td>
                  
                  {/* Family */}
                  <td className="px-6 py-4 hidden md:table-cell w-[120px]">
                    <span className="text-[13px] font-medium text-slate-500 line-clamp-1">
                      {language === 'zh' ? item.family_chi : item.family_eng}
                    </span>
                  </td>

                  {/* Scientific Name */}
                  <td className="px-6 py-4">
                    <span className="text-[14px] font-bold text-slate-900 group-hover:text-emerald-700 transition-colors whitespace-nowrap">
                      {formatScientificName(item.scientific_name)}
                    </span>
                  </td>

                  {/* Common Name */}
                  <td className="px-6 py-4">
                    <span className="text-[14px] font-black text-slate-900 whitespace-nowrap">
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {species.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-slate-400 font-medium">找不到配合條件的物種</p>
        </div>
      )}
    </div>
  );
}
