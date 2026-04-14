import React from 'react';
import { Species } from '@/types/species';
import { useLanguage } from '@/context/LanguageContext';
import { Layers, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';

interface TaxonomyDisplayProps {
  species: Species;
}

export default function TaxonomyDisplay({ species }: TaxonomyDisplayProps) {
  const { language } = useLanguage();
  const router = useRouter();
  const { toggleExpand } = useSpeciesPanel();

  const levels = [
    { 
      id: 'phylum_eng', labelChi: '門', labelEng: 'Phylum',
      chi: species.phylum_chi, eng: species.phylum_eng 
    },
    { 
      id: 'class_eng', labelChi: '綱', labelEng: 'Class',
      chi: species.class_chi, eng: species.class_eng 
    },
    { 
      id: 'order_eng', labelChi: '目', labelEng: 'Order',
      chi: species.order_chi, eng: species.order_eng 
    },
    { 
      id: 'family_eng', labelChi: '科', labelEng: 'Family',
      chi: species.family_chi, eng: species.family_eng 
    },
    { 
      id: 'genus_eng', labelChi: '屬', labelEng: 'Genus',
      chi: species.genus_chi, eng: species.genus_eng,
      isScientific: true
    },
    { 
      id: 'species', labelChi: '種', labelEng: 'Species',
      chi: ' - ', eng: species.species_eng,
      isScientific: true,
      isCurrent: true
    },
  ];

  const handleTaxonomyClick = (levelId: string, value: string) => {
    if (!value || levelId === 'species') return;
    
    toggleExpand(false);
    router.push(`/?${levelId}=${encodeURIComponent(value)}`);
  };

  return (
    <div className="bg-white p-5 md:p-6 lg:p-6 rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden min-h-full flex flex-col">
      <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-8 flex items-center gap-3 shrink-0">
        <div className="p-2 bg-emerald-100 rounded-xl">
          <Layers className="w-5 h-5 text-emerald-600" />
        </div>
        {language === 'zh' ? '分類學資料' : 'Taxonomy Information'}
      </h2>
      
      {/* Mobile Layout - Compact Grid/Chips */}
      <div className="lg:hidden grid grid-cols-2 gap-3">
        {levels.map((level, idx) => {
          if (!level.chi && !level.eng) return null;
          const isClickable = !level.isCurrent;
          
          return (
            <div 
              key={idx} 
              onClick={() => isClickable && handleTaxonomyClick(level.id, level.eng)}
              className={`flex flex-col p-4 rounded-2xl border transition-all ${
                level.isScientific 
                  ? 'bg-emerald-50 border-emerald-100' 
                  : 'bg-slate-50 border-slate-100'
              } ${isClickable ? 'cursor-pointer hover:border-emerald-500 hover:shadow-md active:scale-95' : ''}`}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  {language === 'zh' ? level.labelChi : level.labelEng}
                </span>
              </div>
              <span className={`text-[15px] font-bold text-slate-800 leading-tight ${language !== 'zh' && level.isScientific ? 'italic font-serif text-emerald-900' : ''}`}>
                {language === 'zh' ? (level.chi || level.eng) : level.eng}
              </span>
              {language === 'zh' && level.chi && level.eng && level.chi !== ' - ' && (
                <span className={`text-[11px] font-medium text-slate-500 mt-1 ${level.isScientific ? 'italic font-serif' : ''}`}>
                  {level.eng}
                </span>
              )}
              {language === 'zh' && (!level.chi || level.chi === ' - ') && level.eng && (
                <span className={`text-[11px] font-medium text-slate-500 mt-1 italic font-serif`}>
                  {level.eng}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop Layout - Professional Vertical Timeline */}
      <div className="hidden lg:block relative pl-3 space-y-4 flex-grow">
        {/* Vertical Line Connector */}
        <div className="absolute left-[5px] top-2 bottom-2 w-[1.5px] bg-gradient-to-b from-emerald-200 via-emerald-100 to-transparent" />

        {levels.map((level, idx) => {
          if (!level.chi && !level.eng) return null;
          const isClickable = !level.isCurrent;
          
          return (
            <div key={idx} className="relative group">
              {/* Node Dot */}
              <div className="absolute -left-[11.5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-emerald-400 z-10 shadow-sm group-hover:scale-125 transition-transform" />
              
              <div 
                onClick={() => isClickable && handleTaxonomyClick(level.id, level.eng)}
                className={`flex flex-col pl-5 py-0.5 rounded-xl transition-all ${isClickable ? 'cursor-pointer hover:bg-emerald-50/50' : ''}`}
              >
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  {language === 'zh' ? level.labelChi : level.labelEng}
                </span>
                
                <div className="flex flex-col">
                  <span className={`text-base font-bold text-slate-800 leading-tight ${language !== 'zh' && level.isScientific ? 'italic font-serif text-emerald-900 text-lg' : ''}`}>
                    {language === 'zh' ? (level.chi || level.eng) : level.eng}
                  </span>
                  
                  {language === 'zh' && level.chi && level.eng && level.chi !== ' - ' && (
                    <span className={`text-[11px] font-medium text-slate-500 mt-0.5 tracking-wide ${level.isScientific ? 'italic font-serif' : ''}`}>
                      {level.eng}
                    </span>
                  )}
                  {language === 'zh' && (!level.chi || level.chi === ' - ') && level.eng && (
                    <span className={`text-[11px] font-medium text-slate-500 mt-0.5 tracking-wide italic font-serif`}>
                      {level.eng}
                    </span>
                  )}
                </div>
              </div>

              {idx < levels.length - 1 && (
                <div className="mt-2 ml-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronDown className="w-4 h-4 text-emerald-200" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
