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
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-4 mb-8">
        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-xl">
            <Layers className="w-6 h-6 text-emerald-600" />
          </div>
          {language === 'zh' ? '分類階層' : 'Classification'}
        </h2>
        
        {/* Fill Empty Space with a useful button */}
        <div className="hidden sm:block">
          <a 
            href={`https://www.inaturalist.org/taxa/${species.species_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 rounded-xl transition-all group"
          >
            <span className="text-[10px] font-black text-slate-400 group-hover:text-emerald-600 uppercase tracking-widest">
              {language === 'zh' ? '查看 iNaturalist 分類樹' : 'Browse Taxonomy Tree'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-300 group-hover:text-emerald-400 rotate-[-90deg]" />
          </a>
        </div>
      </div>
      
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

      {/* Desktop Layout - Professional Compact Hierarchical Path */}
      <div className="hidden lg:block w-full">
        <div className="grid grid-cols-3 gap-12">
          {/* Left: Hierarchical Path */}
          <div className="col-span-2 flex flex-col space-y-2">
            {levels.map((level, idx) => {
              if (!level.chi && !level.eng) return null;
              const isClickable = !level.isCurrent;
              const isScientist = level.isScientific && language !== 'zh';
              
              return (
                <div 
                  key={idx} 
                  className="flex items-center group relative h-10"
                  style={{ marginLeft: `${idx * 32}px` }}
                >
                  {/* L-Tree Line Connector - Enhanced */}
                  {idx > 0 && (
                    <div className="absolute -left-5 top-[-24px] w-5 h-8 border-l-2 border-b-2 border-slate-100 rounded-bl-xl pointer-events-none" />
                  )}

                  <div 
                    onClick={() => isClickable && handleTaxonomyClick(level.id, level.eng)}
                    className={`
                      flex items-center gap-4 px-5 py-2 rounded-2xl transition-all duration-300
                      ${isClickable ? 'hover:bg-emerald-50 hover:shadow-sm cursor-pointer' : 'bg-transparent'}
                      ${level.isCurrent ? 'bg-emerald-50/50 border border-emerald-100 shadow-sm' : ''}
                    `}
                  >
                    {/* Category Label - Modern Badge */}
                    <div className={`
                      flex items-center justify-center min-w-[70px] px-2.5 py-1 rounded-lg border
                      ${level.isCurrent ? 'bg-emerald-600 border-emerald-500 shadow-md shadow-emerald-200/50' : 'bg-slate-100 border-slate-200'}
                    `}>
                      <span className={`text-[9px] font-black uppercase tracking-widest ${level.isCurrent ? 'text-white' : 'text-slate-500'}`}>
                        {language === 'zh' ? level.labelChi : level.labelEng}
                      </span>
                    </div>

                    {/* Classification Names */}
                    <div className="flex items-center gap-3">
                      <span className={`text-[15px] font-bold ${level.isCurrent ? 'text-emerald-900' : 'text-slate-700'} ${isScientist ? 'italic font-serif' : ''}`}>
                        {language === 'zh' ? (level.chi || level.eng) : level.eng}
                      </span>
                      
                      {language === 'zh' && level.eng && (
                        <span className={`text-[11px] font-medium text-slate-400 group-hover:text-emerald-400 transition-colors ${level.isScientific ? 'italic font-serif' : ''}`}>
                          {level.eng}
                        </span>
                      )}
                    </div>

                    {/* Interaction Indicator */}
                    {isClickable && (
                      <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 ml-4 translate-x-[-10px] group-hover:translate-x-0">
                        <div className="flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black uppercase tracking-widest">
                          {language === 'zh' ? '查看' : 'View'}
                          <ChevronDown className="w-2.5 h-2.5 rotate-[-90deg]" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Scientific Note & Feedback CTA */}
          <div className="col-span-1 border-l border-slate-50 pl-12 flex flex-col justify-center relative">
            <div className="absolute top-0 right-0 opacity-[0.03] pointer-events-none">
               <Layers className="w-56 h-56 text-slate-950" />
            </div>
            
            <div className="relative z-10 space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-lg border border-amber-100/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
                    {language === 'zh' ? '生物分類學' : 'Biological Taxonomy'}
                  </span>
                </div>
                
                <div className="space-y-4">
                  <p className="text-[13px] font-bold text-slate-700 leading-relaxed">
                    {language === 'zh' 
                      ? '生物分類並非一成不變，而是一個隨科研進展不斷更新、修正的動態過程。' 
                      : 'Biological taxonomy is not static; it is a dynamic process continually refined by new scientific discoveries.'}
                  </p>
                  <p className="text-[12px] font-medium text-slate-500 leading-relaxed">
                    {language === 'zh'
                      ? '如果您掌握此物種最新的分類變動或權威資訊，歡迎提供給我們參考。'
                      : 'If you have access to more recent or authoritative taxonomic updates for this species, we value your contribution.'}
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  onClick={() => {
                    const commentSection = document.getElementById('comment-section');
                    if (commentSection) {
                      commentSection.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="flex items-center gap-3 px-6 py-3 bg-slate-950 hover:bg-emerald-600 text-white rounded-2xl transition-all duration-300 shadow-lg shadow-slate-200 hover:shadow-emerald-200 group active:scale-95"
                >
                  <span className="text-xs font-black uppercase tracking-widest">
                    {language === 'zh' ? '提供最新資訊' : 'Submit Feedback'}
                  </span>
                  <div className="p-1 bg-white/10 rounded-lg group-hover:bg-white/20 transition-colors">
                    <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
