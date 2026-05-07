'use client';

 import { useMemo, useEffect, useState } from 'react';
import { ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { Species } from '@/types/species';
import { PlantSpecies } from '@/types/plants';
import { useLanguage } from '@/context/LanguageContext';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';
import { getIUCNConfig } from '@/constants/statusStyles';
import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown';
import { formatScientificName, formatNativeStatus } from '@/utils/formatters';
import { TaxaType } from '@/components/search/TaxaGroupSwitcher';
import { useTaxonomy } from '@/context/TaxonomyContext';

interface SpeciesTableProps {
  taxaType: TaxaType;
  species: (Species | PlantSpecies)[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  filters: Record<string, any>;
  metadata: Record<string, any[]>;
  onFilterChange: (filters: Record<string, any>) => void;
  onSort: (field: string) => void;
}

export default function SpeciesTable({ 
  taxaType,
  species, 
  sortBy, 
  sortOrder, 
  filters,
  metadata,
  onFilterChange,
  onSort 
}: SpeciesTableProps) {
  const { language, t } = useLanguage();
  const { getTaxonomyChi } = useTaxonomy();
  const { addSpecies } = useSpeciesPanel();
  const [isChanging, setIsChanging] = useState(false);
  const isPlant = taxaType === 'flora';

  // 監聽類型切換，防止佈局閃爍
  useEffect(() => {
    setIsChanging(true);
    const timer = setTimeout(() => setIsChanging(false), 50);
    return () => clearTimeout(timer);
  }, [taxaType]);

  const handleSelectChange = (key: string, value: string | string[]) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const iucnOptions = [
    { name: 'CR', display: 'CR', count: 0 },
    { name: 'EN', display: 'EN', count: 0 },
    { name: 'VU', display: 'VU', count: 0 },
    { name: 'NT', display: 'NT', count: 0 },
    { name: 'LC', display: 'LC', count: 0 },
    { name: 'DD', display: 'DD', count: 0 },
    { name: 'NE', display: 'NE', count: 0 },
  ];

  const nativeOptions = [
    { name: 'Native', display: language === 'zh' ? '原生' : 'Native', count: 0 },
    { name: 'Exotic', display: language === 'zh' ? '外來' : 'Exotic', count: 0 },
    { name: 'Reintroduced', display: language === 'zh' ? '重新引入' : 'Reintroduced', count: 0 },
  ];

  const columns = useMemo(() => {
    if (isPlant) {
      return [
        { key: 'family', label: t('table.family'), sortable: true, mobile: false },
        { key: 'genus', label: language === 'zh' ? '屬 Genus' : 'Genus', sortable: true, mobile: false },
        { key: 'scientific_name', label: t('table.scientific_name'), sortable: true, mobile: true },
        { key: 'common_name', label: t('table.common_name'), sortable: true, mobile: true },
        { key: 'native_status', label: t('table.native_status'), sortable: true, mobile: false },
        { key: 'iucn', label: language === 'zh' ? '珍稀 Rarity' : 'Rarity', sortable: true, mobile: true },
      ];
    }
    return [
      { key: 'order', label: t('table.order'), sortable: true, mobile: false },
      { key: 'family', label: t('table.family'), sortable: true, mobile: false },
      { key: 'scientific_name', label: t('table.scientific_name'), sortable: true, mobile: true },
      { key: 'common_name', label: t('table.common_name'), sortable: true, mobile: true },
      { key: 'native_status', label: t('table.native_status'), sortable: true, mobile: false },
      { key: 'iucn', label: 'IUCN', sortable: true, mobile: true },
    ];
  }, [isPlant, language, t]);

  return (
    <div className={`
      w-full bg-white rounded-[1.25rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden 
      transition-all duration-300 min-h-[400px]
      ${isChanging ? 'opacity-0 scale-[0.99]' : 'opacity-100 scale-100'}
    `}>
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-100">
        <table className="w-full text-left border-collapse min-w-full md:min-w-[1000px]">
          <thead>
            {/* Header Labels & Sorting */}
            <tr className="bg-slate-50/50 border-b border-slate-100">
              {columns.map((col) => (
                <th 
                  key={col.key} 
                  className={`
                    px-3 py-3 md:px-6 md:py-5 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap
                    ${!col.mobile ? 'hidden md:table-cell' : ''}
                    ${col.key === 'order' || col.key === 'family' || col.key === 'genus' ? 'md:w-[140px]' : ''}
                    ${col.key === 'scientific_name' || col.key === 'common_name' ? 'w-auto' : ''}
                    ${col.key === 'iucn' ? 'w-[80px] md:w-[120px]' : ''}
                  `}
                >
                  <div 
                    className={`flex items-center gap-1.5 md:gap-2 ${col.sortable ? 'cursor-pointer hover:text-emerald-600 transition-colors' : ''} ${col.key === 'iucn' || col.key === 'native_status' ? 'justify-center' : ''}`}
                    onClick={() => col.sortable && onSort(col.key)}
                  >
                    {col.label}
                    {col.sortable && (
                      <div className="flex flex-col">
                        {sortBy === col.key ? (
                          sortOrder === 'asc' ? <ChevronUp className="w-2.5 h-2.5 md:w-3 md:h-3 text-emerald-500" /> : <ChevronDown className="w-2.5 h-2.5 md:w-3 md:h-3 text-emerald-500" />
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 md:w-3 md:h-3 opacity-20" />
                        )}
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
            {/* Header Filters Row */}
            <tr className="bg-white border-b border-slate-50">
              {columns.map((col) => (
                <th key={col.key} className={`px-2 py-2 md:px-4 md:py-3 ${!col.mobile ? 'hidden md:table-cell' : ''}`}>
                  <div className="px-1">
                    {col.key === 'native_status' ? (
                      <MultiSelectDropdown
                        label={t('table.native_status')}
                        options={metadata.native_status || nativeOptions}
                        selectedValues={filters.native_status || []}
                        onChange={(vals) => handleSelectChange('native_status', vals)}
                        placeholder={language === 'zh' ? "全部" : "All"}
                        minWidth="140px"
                      />
                    ) : col.key === 'iucn' ? (
                      <MultiSelectDropdown
                        label={isPlant ? (language === 'zh' ? '珍稀' : 'Rarity') : "IUCN"}
                        options={metadata.iucn || iucnOptions}
                        selectedValues={filters.iucn || []}
                        onChange={(vals) => handleSelectChange('iucn', vals)}
                        placeholder={language === 'zh' ? "全部" : "All"}
                        align="right"
                        minWidth="140px"
                      />
                    ) : (
                      <MultiSelectDropdown
                        label={col.label}
                        options={(metadata[col.key] || []).map(item => {
                          const isZh = language === 'zh';
                          const isLocalizable = col.key === 'family' || col.key === 'order' || col.key === 'genus';
                          
                          let display = item.display || item.name;
                          if (isZh && isLocalizable) {
                            const mapped = getTaxonomyChi(col.key, taxaType === 'flora' ? 'flora' : 'fauna', item.en || item.name);
                            if (mapped) display = mapped;
                          } else if (language === 'en' && item.en) {
                            display = item.en;
                          }

                          return {
                            ...item,
                            display
                          };
                        })}
                        selectedValues={filters[col.key] || []}
                        onChange={(vals) => handleSelectChange(col.key, vals)}
                        placeholder={language === 'zh' ? "全部" : "All"}
                        minWidth={col.key === 'scientific_name' || col.key === 'common_name' ? '120px' : '160px'}
                        align="left"
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          
          <tbody className="divide-y divide-slate-50">
            {species.map((item) => {
              const faunaItem = item as Species;
              const floraItem = item as PlantSpecies;
              const itemIUCN = !isPlant ? (faunaItem.iucn || 'NE') : null;
              const iucnConfig = !isPlant ? getIUCNConfig(itemIUCN!) : null;
              const taxaTypeVal = isPlant ? 'flora' : 'fauna';
              
              return (
                <tr 
                  key={item.id}
                  onClick={() => item.taxa_id && addSpecies(item.taxa_id)}
                  className="group hover:bg-emerald-50/30 transition-colors cursor-pointer"
                >
                  {/* fauna Order only */}
                  {!isPlant && (
                    <td className="px-3 py-2.5 md:px-6 md:py-4 hidden md:table-cell w-[120px]">
                      <span className="text-[12px] md:text-[13px] font-bold text-slate-600 line-clamp-1">
                        {language === 'zh' ? getTaxonomyChi('order', taxaTypeVal, faunaItem.order_eng) : faunaItem.order_eng}
                      </span>
                    </td>
                  )}
                  
                  {/* Family (Both) */}
                  <td className="px-3 py-2.5 md:px-6 md:py-4 hidden md:table-cell w-[120px]">
                    <span className="text-[12px] md:text-[13px] font-medium text-slate-500 line-clamp-1">
                      {language === 'zh' 
                        ? getTaxonomyChi('family', taxaTypeVal, faunaItem.family_eng || floraItem.family_eng) 
                        : (faunaItem.family_eng || floraItem.family_eng)}
                    </span>
                  </td>

                  {/* flora Genus only */}
                  {isPlant && (
                    <td className="px-3 py-2.5 md:px-6 md:py-4 hidden md:table-cell w-[120px]">
                      <span className="text-[12px] md:text-[13px] font-medium text-slate-400 line-clamp-1">
                        {language === 'zh' ? getTaxonomyChi('genus', taxaTypeVal, floraItem.genus_eng) : floraItem.genus_eng}
                      </span>
                    </td>
                  )}

                  {/* Scientific Name */}
                  <td className="px-3 py-2.5 md:px-6 md:py-4 max-w-[150px] md:max-w-none">
                    <span className="text-[13px] md:text-[14px] font-bold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-2 md:whitespace-nowrap">
                      {formatScientificName(item.scientific_name)}
                    </span>
                  </td>

                  {/* Common Name */}
                  <td className="px-3 py-2.5 md:px-6 md:py-4 max-w-[140px] md:max-w-none">
                    <span className="text-[13px] md:text-[14px] font-black text-slate-900 line-clamp-2 md:whitespace-nowrap">
                      {language === 'zh' ? (faunaItem.common_name_chi || floraItem.common_name_chi) : (faunaItem.common_name_eng || floraItem.common_name_eng)}
                    </span>
                  </td>

                  {/* Native Status */}
                  <td className="px-3 py-2.5 md:px-6 md:py-4 hidden md:table-cell text-center">
                    <span className={`px-2 md:px-2.5 py-0.5 md:py-1 rounded-lg text-[9px] md:text-[10px] font-bold uppercase tracking-wider ${faunaItem.native_status?.includes('Native') || floraItem.origin?.includes('Native') || floraItem.origin?.includes('原生') ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500'}`}>
                      {formatNativeStatus(floraItem.origin || faunaItem.native_status, language)}
                    </span>
                  </td>

                  {/* Status (IUCN or Rarity) */}
                  <td className="px-3 py-2.5 md:px-6 md:py-4 whitespace-nowrap text-center">
                    {isPlant ? (
                       <span className={`px-2 py-0.5 md:px-3 md:py-1 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest border shadow-sm ${floraItem.hk_rare_precious_note && floraItem.hk_rare_precious_note !== 'No' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                        {floraItem.hk_rare_precious_note || 'N/A'}
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 md:px-3 md:py-1 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest border shadow-sm ${iucnConfig?.styles}`}>
                        {iucnConfig?.label.en}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {species.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-slate-400 font-medium">找不到符合條件的物種</p>
        </div>
      )}
    </div>
  );
}
