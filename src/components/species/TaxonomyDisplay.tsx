import React from 'react';
import { Species } from '@/types/species';
import { useLanguage } from '@/context/LanguageContext';
import { Shield, ChevronRight } from 'lucide-react';

interface TaxonomyDisplayProps {
  species: Species;
}

export default function TaxonomyDisplay({ species }: TaxonomyDisplayProps) {
  const { language } = useLanguage();

  const levels = [
    { 
      labelChi: '門', labelEng: 'Phylum', 
      chi: species.phylum_chi, eng: species.phylum_eng 
    },
    { 
      labelChi: '綱', labelEng: 'Class', 
      chi: species.class_chi, eng: species.class_eng 
    },
    { 
      labelChi: '目', labelEng: 'Order', 
      chi: species.order_chi, eng: species.order_eng 
    },
    { 
      labelChi: '科', labelEng: 'Family', 
      chi: species.family_chi, eng: species.family_eng 
    },
  ];

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
      <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
        <Shield className="w-6 h-6 text-emerald-500" />
        {language === 'zh' ? '分類學資料' : 'Taxonomy Information'}
      </h2>
      
      <div className="flex flex-wrap items-center gap-y-6">
        {levels.map((level, idx) => (
          <React.Fragment key={idx}>
            <div className="flex flex-col px-5 py-3 bg-slate-50 rounded-2xl border border-slate-100 min-w-[120px] transition-all hover:bg-emerald-50 hover:border-emerald-100 group">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 group-hover:text-emerald-500">
                {language === 'zh' ? level.labelChi : level.labelEng}
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-black text-slate-700 leading-tight group-hover:text-emerald-900">
                  {language === 'zh' ? level.chi : level.eng}
                </span>
                {language === 'zh' && level.eng && (
                  <span className="text-[10px] font-medium text-slate-400 mt-0.5 italic group-hover:text-emerald-600/70">
                    {level.eng}
                  </span>
                )}
              </div>
            </div>
            {idx < levels.length - 1 && (
              <ChevronRight className="w-5 h-5 text-slate-300 mx-1 shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
