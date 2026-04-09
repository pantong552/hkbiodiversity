import React from 'react';
import { Species } from '@/types/species';
import { useLanguage } from '@/context/LanguageContext';
import { Activity } from 'lucide-react';

interface ConservationStatusProps {
  species: Species;
}

export default function ConservationStatus({ species }: ConservationStatusProps) {
  const { language } = useLanguage();

  const statuses = [
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
      value: species.native_status 
    },
  ];

  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 h-full">
      <h3 className="text-xl font-black text-slate-800 mb-8 pb-4 border-b border-slate-100 flex items-center gap-3">
        <Activity className="w-6 h-6 text-emerald-500" />
        {language === 'zh' ? '保育與生存狀態' : 'Conservation & Status'}
      </h3>
      
      <div className="grid grid-cols-1 gap-6">
        {statuses.map((status, idx) => (
          <div key={idx} className="flex flex-col group">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 transition-colors group-hover:text-emerald-500">
              {language === 'zh' ? status.labelChi : status.labelEng}
            </span>
            <div className={`
              text-sm font-black px-4 py-3 rounded-2xl transition-all
              ${status.value 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 group-hover:bg-emerald-100' 
                : 'bg-slate-50 text-slate-400 border border-slate-100'}
            `}>
              {status.value || '-'}
            </div>
          </div>
        ))}
        
        {/* Additional information if present */}
        {(species.endemic || species.cites) && (
          <div className="pt-4 mt-4 border-t border-slate-50 space-y-4">
            {species.endemic && (
              <div className="flex justify-between items-center px-4 py-2 bg-amber-50 rounded-xl border border-amber-100">
                <span className="text-xs font-bold text-amber-700 uppercase">{language === 'zh' ? '特有種' : 'Endemic'}</span>
                <span className="text-sm font-black text-amber-900">{species.endemic}</span>
              </div>
            )}
            {species.cites && (
              <div className="flex justify-between items-center px-4 py-2 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-xs font-bold text-blue-700 uppercase">CITES</span>
                <span className="text-sm font-black text-blue-900">{species.cites}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
