import React from 'react';
import { Species } from '@/types/species';
import { useLanguage } from '@/context/LanguageContext';
import { Layers, ChevronDown, Dna, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';
import { formatScientificName } from '@/utils/formatters';

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
      chi: species.scientific_name, eng: species.species_eng,
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
        <h2 className="text-2xl font-black text-slate-800 flex items-center justify-between flex-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <Layers className="w-6 h-6 text-emerald-600" />
            </div>
            {language === 'zh' ? '分類階層' : 'Classification'}
          </div>

          {/* Mobile Minimalism External Link Button - Hidden above sm */}
          <div className="sm:hidden">
            <a 
              href={`https://www.inaturalist.org/taxa/${species.inat_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl shadow-sm active:bg-slate-50 transition-colors"
            >
              <img src="/INaturalist_logo.svg" alt="iNaturalist" className="w-5 h-5 object-contain" />
            </a>
          </div>
        </h2>
        
        {/* Fill Empty Space with a useful button */}
        <div className="hidden sm:block">
          <a 
            href={`https://www.inaturalist.org/taxa/${species.inat_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-2 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-xl transition-all duration-300 shadow-sm hover:shadow-md group overflow-hidden"
          >
            <div className="relative w-5 h-5 flex items-center justify-center">
              <img 
                src="/INaturalist_logo.svg" 
                alt="iNaturalist" 
                className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300" 
              />
            </div>
            <span className="text-[10px] font-black text-slate-500 group-hover:text-emerald-700 uppercase tracking-[0.2em] transition-colors">
              {language === 'zh' ? 'iNaturalist 分類樹' : 'iNaturalist Tree'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-300 group-hover:text-emerald-400 rotate-[-90deg] transition-all group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
      
      {/* Mobile Layout - Professional Minimalist Path */}
      <div className="lg:hidden flex flex-col space-y-1.5 relative pl-1.5">
        {/* Main Backbone Line - Ultra Thin */}
        <div className="absolute left-[7px] top-6 bottom-6 w-[1px] bg-slate-200/50 rounded-full" />
        
        {levels.map((level, idx) => {
          if (!level.chi && !level.eng) return null;
          const isClickable = !level.isCurrent;
          
          return (
            <div 
              key={idx} 
              className="relative flex items-center group/item py-1"
            >
              {/* Branch Connection Line (Right Angle) */}
              <div className="absolute left-[7px] top-1/2 -translate-y-1/2 w-3 h-[1px] bg-slate-200/50" />
              
              {/* Secondary Status Accent */}
              {level.isCurrent && (
                <div className="absolute left-[-2px] top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-emerald-500 rounded-full z-20" />
              )}
              
              <div 
                onClick={() => isClickable && handleTaxonomyClick(level.id, level.eng)}
                className={`flex-1 ml-6 py-2.5 px-3.5 rounded-xl border transition-all ${
                  level.isCurrent 
                    ? 'bg-emerald-50 border-emerald-100 shadow-sm' 
                    : 'bg-white border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]'
                } ${isClickable ? 'active:scale-[0.98] active:bg-slate-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Level Badge - Now Perfectly Centered Relative to All Text */}
                    <div className="shrink-0">
                      <div className={`
                        flex items-center justify-center min-w-[32px] h-[18px] px-1.5 rounded-md border text-center
                        ${level.isCurrent ? 'bg-emerald-600 border-emerald-500' : 'bg-slate-100 border-slate-200'}
                      `}>
                        <span className={`text-[9px] font-black uppercase tracking-widest leading-[0] mb-[-1px] ${level.isCurrent ? 'text-white' : 'text-slate-500'}`}>
                          {language === 'zh' ? level.labelChi : level.labelEng}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className={`text-[13px] font-bold truncate leading-tight ${level.isCurrent ? 'text-emerald-900' : 'text-slate-800'} ${language !== 'zh' && level.id === 'genus_eng' ? 'italic font-serif' : ''}`}>
                        {level.id === 'species' 
                          ? formatScientificName(level.chi) 
                          : (language === 'zh' ? (level.chi || level.eng) : level.eng)
                        }
                      </span>
                      {language === 'zh' && level.eng && level.id !== 'species' && (
                        <span className={`text-[10px] font-medium text-slate-400 leading-tight mt-0.5 ${level.id === 'genus_eng' ? 'italic font-serif' : ''}`}>
                          {level.eng}
                        </span>
                      )}
                    </div>
                  </div>

                  {isClickable && (
                    <div className="shrink-0 w-6 h-6 flex items-center justify-center border border-slate-100 text-slate-300 rounded-full transition-colors active:bg-emerald-100 active:text-emerald-600">
                      <Search className="w-2.5 h-2.5" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Layout - Professional Compact Hierarchical Path */}
      <div className="hidden lg:block w-full">
        <div className="grid grid-cols-5 gap-10">
          {/* Left: Hierarchical Path */}
          <div className="col-span-3 flex flex-col space-y-2">
            {levels.map((level, idx) => {
              if (!level.chi && !level.eng) return null;
              const isClickable = !level.isCurrent;
              const isScientist = level.isScientific && language !== 'zh';
              
              return (
                <div 
                  key={idx} 
                  className="flex items-center group relative h-10"
                  style={{ marginLeft: `${idx * 24}px` }}
                >
                  {/* L-Tree Line Connector - Enhanced */}
                  {idx > 0 && (
                    <div className="absolute -left-4 top-[-24px] w-4 h-8 border-l-2 border-b-2 border-slate-100 rounded-bl-xl pointer-events-none" />
                  )}

                  <div 
                    onClick={() => isClickable && handleTaxonomyClick(level.id, level.eng)}
                    className={`
                      flex items-center gap-4 px-5 py-2.5 rounded-2xl transition-all duration-300
                      ${isClickable ? 'hover:bg-emerald-50 hover:shadow-sm cursor-pointer' : 'bg-transparent'}
                      ${level.isCurrent ? 'bg-emerald-50/50 border border-emerald-100 shadow-sm' : ''}
                    `}
                  >
                    {/* Category Label - Modern Badge */}
                    <div className="shrink-0">
                      <div className={`
                        flex items-center justify-center min-w-[54px] h-[18px] px-2 rounded-md border text-center
                        ${level.isCurrent ? 'bg-emerald-600 border-emerald-500 shadow-md shadow-emerald-200/50' : 'bg-slate-100 border-slate-200'}
                      `}>
                        <span className={`text-[9px] font-black uppercase tracking-widest leading-[0] mb-[-1px] ${level.isCurrent ? 'text-white' : 'text-slate-500'}`}>
                          {language === 'zh' ? level.labelChi : level.labelEng}
                        </span>
                      </div>
                    </div>

                    {/* Classification Names - Text Group for better centering */}
                    <div className="flex items-center gap-3">
                      <span className={`text-[15px] font-bold ${level.isCurrent ? 'text-emerald-900' : 'text-slate-700'} ${isScientist || level.id === 'species' ? 'italic font-serif' : ''}`}>
                        {level.id === 'species' 
                          ? formatScientificName(level.chi) 
                          : (language === 'zh' ? (level.chi || level.eng) : level.eng)
                        }
                      </span>
                      
                      {language === 'zh' && level.eng && level.id !== 'species' && (
                        <span className={`text-[11px] font-medium text-slate-400 group-hover:text-emerald-400 transition-colors ${level.isScientific ? 'italic font-serif' : ''}`}>
                          {level.eng}
                        </span>
                      )}
                    </div>

                    {/* Search Interaction Button */}
                    {isClickable && (
                      <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 ml-4 translate-x-[-10px] group-hover:translate-x-0">
                        <div className="w-8 h-8 flex items-center justify-center bg-emerald-100/60 text-emerald-700 rounded-full hover:bg-emerald-500 hover:text-white transition-all duration-200 shadow-sm active:scale-90 group/btn">
                          <Search className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Scientific Note & Feedback CTA */}
          <div className="col-span-2 border-l border-slate-100 pl-10 flex flex-col justify-center relative">
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none overflow-hidden">
               <Dna className="w-64 h-64 text-slate-950 rotate-[-15deg]" />
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

              <div className="pt-2 flex justify-end">
                <button 
                  onClick={() => {
                    const commentSection = document.getElementById('comment-section');
                    if (commentSection) {
                      commentSection.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="flex items-center gap-3 px-6 py-3 bg-slate-950 hover:bg-emerald-600 text-white rounded-2xl transition-all duration-300 shadow-lg shadow-slate-200 hover:shadow-emerald-200 group active:scale-95"
                >
                  <span className="text-xs font-black uppercase tracking-widest whitespace-nowrap">
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
