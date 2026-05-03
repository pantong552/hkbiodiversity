import React from 'react';
import { Species } from '@/types/species';
import { useLanguage } from '@/context/LanguageContext';
import { Shield, Info } from 'lucide-react';
import { formatNativeStatus } from '@/utils/formatters';

interface ConservationStatusProps {
  species: Species;
}

export default function ConservationStatus({ species }: ConservationStatusProps) {
  const { language } = useLanguage();

  const isPlant = species.taxa_group === 'FLORA' || ('is_cap96' in species);

  // Helper formatting for Cap 96/586 Boolean-like values
  const formatYesNo = (val: any) => {
    if (!val || val === 'No' || val === '沒有列入' || val === '非' || val === 'N' || val === 'n' || val === 'False' || val === false) return '-';
    if (val === 'Y' || val === true || val === 'Yes' || val === 'y' || val === 'True') return language === 'zh' ? '是' : 'Yes';
    return val;
  };

  const statuses = isPlant ? [
    {
      labelChi: '林務條例 (第96章) 保育類',
      labelEng: 'Forests and Countryside Ordinance (Cap. 96)',
      value: formatYesNo((species as any).is_cap96)
    },
    {
      labelChi: '保護瀕危動植物物種條例 (第586章)',
      labelEng: 'Protection of Endangered Species Ordinance (Cap. 586)',
      value: formatYesNo((species as any).is_cap586)
    },
    {
      labelChi: '香港稀有及珍貴植物',
      labelEng: 'HK Rare and Precious Plants',
      value: (species as any).hk_rare_precious_note === 'No' ? '-' : (species as any).hk_rare_precious_note
    },
    {
      labelChi: '中國植物紅皮書',
      labelEng: 'China Plant Red Data Book',
      value: (species as any).china_red_data_book_note === '沒有列入' || (species as any).china_red_data_book_note === 'Not Listed' ? '-' : (species as any).china_red_data_book_note
    }
  ] : [
    { 
      labelChi: 'IUCN 紅皮書', 
      labelEng: 'IUCN Red List', 
      value: species.iucn 
    },
    { 
      labelChi: '中國紅皮書', 
      labelEng: 'China Red List', 
      value: species.china_red_list 
    },
    { 
      labelChi: '中國脊椎動物紅皮書', 
      labelEng: 'China Vertebrates Red List', 
      value: species.china_vertebrates_red_list 
    },
    { 
      labelChi: '香港保護法例', 
      labelEng: 'HK Protection Status', 
      value: species.hk_protection 
    },
    { 
      labelChi: '香港原生概況', 
      labelEng: 'HK Native Status', 
      value: formatNativeStatus(species.native_status, language) 
    },
    ...(species.class_eng === 'Aves' ? [{ 
      labelChi: '鳥種類別（香港觀鳥會）', 
      labelEng: 'Category (HKBWS)', 
      value: species.hkbws_cat 
    }] : []),
  ];

  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 w-full mb-12">
      <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
        <Shield className="w-6 h-6 text-emerald-500" />
        {language === 'zh' ? '保育與生存狀態' : 'Conservation & Survival Status'}
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statuses.map((status, idx) => (
          <div key={idx} className="flex flex-col group h-full">
            <span className="text-xs font-bold text-slate-500 tracking-tight mb-3 transition-colors group-hover:text-emerald-600 min-h-[32px] flex items-end">
              {language === 'zh' ? status.labelChi : status.labelEng}
            </span>
            <div className={`
              text-base font-black px-5 py-3.5 rounded-2xl transition-all flex items-center justify-center text-center
              ${status.value && status.value !== '-' 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 group-hover:bg-emerald-100 group-hover:border-emerald-300 shadow-sm' 
                : 'bg-slate-50 text-slate-400 border border-slate-100'}
            `}>
              {status.value || '-'}
            </div>
          </div>
        ))}
        
        {/* Additional information if present */}
        {(species.endemic || species.cites) && (
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50 mt-2">
            {species.endemic && (
              <div className="group">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                  {language === 'zh' ? '特有種' : 'Endemicity'}
                </span>
                <div className="flex justify-between items-center px-5 py-4 bg-amber-50 rounded-2xl border border-amber-100 group-hover:bg-amber-100 transition-colors">
                  <span className="text-sm font-black text-amber-900">{species.endemic}</span>
                  <Info className="w-4 h-4 text-amber-400" />
                </div>
              </div>
            )}
            {species.cites && (
              <div className="group">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                  CITES
                </span>
                <div className="flex justify-between items-center px-5 py-4 bg-blue-50 rounded-2xl border border-blue-100 group-hover:bg-blue-100 transition-colors">
                  <span className="text-sm font-black text-blue-900">{species.cites}</span>
                  <Info className="w-4 h-4 text-blue-400" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
