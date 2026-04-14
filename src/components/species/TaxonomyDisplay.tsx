import React from 'react';
import { Species } from '@/types/species';
import { useLanguage } from '@/context/LanguageContext';
import { Layers, ChevronDown } from 'lucide-react';

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
    { 
      labelChi: '屬', labelEng: 'Genus', 
      chi: species.genus_chi, eng: species.genus_eng,
      isGenus: true
    },
  ];

  return (
    <div className="bg-white p-5 md:p-6 rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
      <h2 className="text-lg md:text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
        <div className="p-1.5 bg-emerald-100 rounded-lg">
          <Layers className="w-4 h-4 text-emerald-600" />
        </div>
        {language === 'zh' ? '分類學資料' : 'Taxonomy Information'}
      </h2>
      
      <div className="relative pl-3 space-y-5">
        {/* Vertical Line Connector */}
        <div className="absolute left-[5px] top-2 bottom-2 w-[1.5px] bg-gradient-to-b from-emerald-200 via-emerald-100 to-transparent" />

        {levels.map((level, idx) => {
          if (!level.chi && !level.eng) return null;
          
          return (
            <div key={idx} className="relative group">
              {/* Node Dot */}
              <div className="absolute -left-[11.5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-emerald-400 z-10 shadow-sm group-hover:scale-125 transition-transform" />
              
              <div className="flex flex-col pl-4">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  {language === 'zh' ? level.labelChi : level.labelEng}
                </span>
                
                <div className="flex flex-col">
                  <span className={`text-[15px] font-bold text-slate-800 leading-tight ${level.isGenus ? 'italic font-serif text-emerald-900 text-base' : ''}`}>
                    {language === 'zh' ? level.chi : level.eng}
                  </span>
                  
                  {language === 'zh' && level.eng && (
                    <span className={`text-[10px] font-medium text-slate-500 mt-0.5 tracking-wide ${level.isGenus ? 'italic font-serif opacity-80' : ''}`}>
                      {level.eng}
                    </span>
                  )}
                </div>
              </div>

              {idx < levels.length - 1 && (
                <div className="mt-3 ml-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronDown className="w-3.5 h-3.5 text-emerald-200" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
