import React from 'react';
import { Species } from '@/types/species';
import { useLanguage } from '@/context/LanguageContext';
import { Shield, Info } from 'lucide-react';

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
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 w-full mb-12">
      <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
        <Shield className="w-6 h-6 text-emerald-500" />
        {language === 'zh' ? '保育與生存狀態' : 'Conservation & Survival Status'}
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statuses.map((status, idx) => (
          <div key={idx} className="flex flex-col group">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 transition-colors group-hover:text-emerald-500">
              {language === 'zh' ? status.labelChi : status.labelEng}
            </span>
            <div className={`
              text-sm font-black px-5 py-4 rounded-2xl transition-all h-full flex items-center
              ${status.value 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 group-hover:bg-emerald-100 group-hover:border-emerald-200' 
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
                  {language === 'zh' ? '特有性' : 'Endemicity'}
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
