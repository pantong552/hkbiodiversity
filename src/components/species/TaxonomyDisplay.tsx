import { useState } from 'react';
import { Species } from '@/types/species';
import { useLanguage } from '@/context/LanguageContext';
import { Layers, ChevronDown, Dna, Search, Loader2, Sparkles, AlertCircle, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';
import { formatScientificName } from '@/utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';

interface TaxonomyDisplayProps {
  species: Species;
}

interface FullTaxonomyData {
  usageId: string;
  classification: { rank: string; name: string; id: string; authorship?: string }[];
  synonyms: string[];
  subspecies: string[];
}

export default function TaxonomyDisplay({ species }: TaxonomyDisplayProps) {
  const { language } = useLanguage();
  const router = useRouter();
  const { toggleExpand } = useSpeciesPanel();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [fullData, setFullData] = useState<FullTaxonomyData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const toggleFullTaxonomy = async () => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    setIsExpanded(true);
    if (!fullData) {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/species/taxonomy?name=${encodeURIComponent(species.scientific_name)}`);
        if (!response.ok) throw new Error('Failed to fetch taxonomy data');
        const data = await response.json();
        setFullData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
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
      
      {/* Mobile Path */}
      <div className="lg:hidden flex flex-col space-y-1.5 relative pl-1.5">
        <div className="absolute left-[7px] top-6 bottom-6 w-[1px] bg-slate-200/50 rounded-full" />
        {levels.map((level, idx) => {
          if (!level.chi && !level.eng) return null;
          const isClickable = !level.isCurrent;
          return (
            <div key={idx} className="relative flex items-center group/item py-1">
              <div className="absolute left-[7px] top-1/2 -translate-y-1/2 w-3 h-[1px] bg-slate-200/50" />
              {level.isCurrent && (
                <div className="absolute left-[-2px] top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-emerald-500 rounded-full z-20" />
              )}
              <div 
                onClick={() => isClickable && handleTaxonomyClick(level.id, level.eng)}
                className={`flex-1 ml-6 py-2.5 px-3.5 rounded-xl border transition-all ${
                  level.isCurrent ? 'bg-emerald-50 border-emerald-100 shadow-sm' : 'bg-white border-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="shrink-0">
                      <div className={`flex items-center justify-center min-w-[32px] h-[18px] px-1.5 rounded-md border text-center ${level.isCurrent ? 'bg-emerald-600 border-emerald-500' : 'bg-slate-100 border-slate-200'}`}>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${level.isCurrent ? 'text-white' : 'text-slate-500'}`}>
                          {language === 'zh' ? level.labelChi : level.labelEng}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className={`text-[13px] font-bold truncate leading-tight ${level.isCurrent ? 'text-emerald-900' : 'text-slate-800'}`}>
                        {level.id === 'species' 
                          ? formatScientificName(level.chi) 
                          : (language === 'zh' ? (level.chi || level.eng) : level.eng)
                        }
                      </span>
                      {language === 'zh' && level.eng && level.id !== 'species' && (
                        <span className={`text-[10px] font-medium text-slate-400 leading-tight mt-0.5 ${level.isScientific ? 'italic font-serif' : ''}`}>
                          {level.eng}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Path */}
      <div className="hidden lg:block w-full">
        <div className="grid grid-cols-5 gap-10">
          <div className="col-span-3 flex flex-col space-y-2">
            {levels.map((level, idx) => {
              if (!level.chi && !level.eng) return null;
              const isClickable = !level.isCurrent;
              return (
                <div key={idx} className="flex items-center group relative h-10" style={{ marginLeft: `${idx * 24}px` }}>
                  {idx > 0 && <div className="absolute -left-4 top-[-24px] w-4 h-8 border-l-2 border-b-2 border-slate-100 rounded-bl-xl pointer-events-none" />}
                  <div 
                    onClick={() => isClickable && handleTaxonomyClick(level.id, level.eng)}
                    className={`flex items-center gap-4 px-5 py-2.5 rounded-2xl transition-all duration-300 ${isClickable ? 'hover:bg-emerald-50 hover:shadow-sm cursor-pointer' : ''} ${level.isCurrent ? 'bg-emerald-50/50 border border-emerald-100 shadow-sm' : ''}`}
                  >
                    <div className="shrink-0">
                      <div className={`flex items-center justify-center min-w-[54px] h-[18px] px-2 rounded-md border text-center ${level.isCurrent ? 'bg-emerald-600 border-emerald-500 shadow-md' : 'bg-slate-100 border-slate-200'}`}>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${level.isCurrent ? 'text-white' : 'text-slate-500'}`}>
                          {language === 'zh' ? level.labelChi : level.labelEng}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[15px] font-bold ${level.isCurrent ? 'text-emerald-900' : 'text-slate-700'} 
                        ${(level.id === 'species' || (level.isScientific && language !== 'zh')) ? 'italic font-serif' : ''}`}>
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
                  </div>
                </div>
              );
            })}
          </div>
          <div className="col-span-2 border-l border-slate-100 pl-10 flex flex-col justify-center relative">
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
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
                <p className="text-[13px] font-bold text-slate-700 leading-relaxed">
                  {language === 'zh' ? '生物分類並非一成不變，而是一個隨科研進展不斷更新、修正的動態過程。' : 'Biological taxonomy is not static; it is a dynamic process continually refined by new scientific discoveries.'}
                </p>
                <p className="text-[12px] font-medium text-slate-500 leading-relaxed">
                  {language === 'zh'
                    ? '如果您掌握此物種最新的分類變動或權威資訊，歡迎提供給我們參考。'
                    : 'If you have access to more recent or authoritative taxonomic updates for this species, we value your contribution.'}
                </p>
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

      {/* Expandable Area */}
      <div className="mt-10 pt-6 border-t border-slate-100">
        <button
          onClick={toggleFullTaxonomy}
          className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all duration-500 group ${isExpanded ? 'bg-slate-900 text-white shadow-xl ring-4 ring-slate-100' : 'bg-slate-50 text-slate-600 hover:bg-emerald-50'}`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-xl transition-colors ${isExpanded ? 'bg-white/10 text-emerald-400' : 'bg-white text-slate-400 shadow-sm'}`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-sm font-black uppercase tracking-widest leading-tight">{language === 'zh' ? '完整分類階層' : 'Full Taxonomy Tree'}</span>
              <span className={`text-[10px] font-medium opacity-60 leading-tight mt-0.5 ${isExpanded ? 'text-white' : 'text-slate-500'}`}>
                {language === 'zh' ? '來自 Catalogue of Life 的詳細數據' : 'Detailed data from Catalogue of Life'}
              </span>
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 transition-transform duration-500 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="overflow-hidden"
            >
              <div className="pt-6 space-y-6">
                {isLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-4 bg-white/50 rounded-[2rem] border border-slate-100">
                    <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                    <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                      {language === 'zh' ? '正在獲取全球資料庫數據...' : 'Fetching Global Database...'}
                    </span>
                  </div>
                ) : error ? (
                  <div className="p-8 bg-red-50 rounded-[2rem] border border-red-100 flex items-center gap-4 text-red-700">
                    <AlertCircle className="w-6 h-6" />
                    <p className="text-sm font-bold">{language === 'zh' ? `載入失敗: ${error}` : `Failed: ${error}`}</p>
                  </div>
                ) : fullData && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                    {/* Left: Classification Path */}
                    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 relative overflow-hidden group flex flex-col">
                      <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
                        <Layers className="w-32 h-32 text-slate-900" />
                      </div>
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {language === 'zh' ? '完整階層路徑' : 'Full Hierarchy Path'}
                      </h3>
                      <div className="space-y-1 relative flex-1">
                        {fullData.classification.map((item, idx) => {
                          const rankLower = item.rank.toLowerCase();
                          const rankMap: Record<string, string> = {
                            domain: '域', kingdom: '界', subkingdom: '亞界', phylum: '門', subphylum: '亞門',
                            infraphylum: '下門', parvphylum: '小門', superclass: '總綱',
                            class: '綱', subclass: '亞綱', infraclass: '下綱', megaclass: '巨綱', gigaclass: '大綱',
                            superorder: '總目', order: '目', suborder: '亞目', infraorder: '下目',
                            parvorder: '小目', superfamily: '總科', family: '科', subfamily: '亞科',
                            supertribe: '總族', tribe: '族', subtribe: '亞族', genus: '屬',
                            subgenus: '亞屬', section: '節', subsection: '亞節', species: '種',
                            subspecies: '亞種'
                          };
                          const rankChi = rankMap[rankLower] || '';
                          const needsItalic = ['genus', 'subgenus', 'species', 'subspecies'].includes(rankLower);

                          return (
                            <div key={idx} className="grid grid-cols-[90px_24px_1fr] items-center group/line hover:bg-emerald-50/40 rounded-lg py-1 px-1 transition-all duration-300">
                              <div className="text-center pr-2">
                                {language === 'zh' && rankChi && (
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter block leading-tight">{rankChi}</span>
                                )}
                                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest block leading-tight">{item.rank}</span>
                              </div>
                              
                              {/* Modern Step Connector */}
                              <div className="relative flex justify-center h-full items-center">
                                {/* Vertical segments for tree continuity */}
                                <div className={`absolute w-[1px] bg-slate-100 ${idx === 0 ? 'top-1/2 h-1/2' : idx === fullData.classification.length - 1 ? 'top-0 h-1/2' : 'top-0 h-full'}`} />
                                {/* Horizontal connector */}
                                <div className="absolute left-1/2 w-2 h-[1px] bg-slate-100" />
                                {/* Diamond Node */}
                                <div className="relative w-1.5 h-1.5 bg-slate-200 rounded-sm rotate-45 group-hover/line:bg-emerald-500 group-hover/line:rotate-0 transition-all duration-300 z-10 shadow-sm" />
                              </div>

                              <div className="text-[13px] text-slate-600 leading-normal pl-2 group-hover/line:translate-x-0.5 transition-transform">
                                {formatScientificName(item.authorship ? `${item.name} ${item.authorship}` : item.name, needsItalic, true)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right: Subspecies & Synonyms */}
                    <div className="flex flex-col gap-6">
                      <div className="bg-emerald-50/50 rounded-[2rem] p-8 border border-emerald-100/50 relative overflow-hidden group">
                        <h3 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-6 flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          {language === 'zh' ? '已知亞種' : 'Known Subspecies'}
                        </h3>
                        {fullData.subspecies.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {fullData.subspecies.map((sub, idx) => (
                              <div key={idx} className="px-3 py-1.5 bg-white rounded-xl border border-emerald-100 text-[12px] text-emerald-800 shadow-sm">
                                {formatScientificName(sub, true, true)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm font-bold text-emerald-600/40">{language === 'zh' ? '查無亞種資訊' : 'No subspecies recorded'}</p>
                        )}
                      </div>

                      <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 group flex-1 flex flex-col overflow-hidden">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                          <Info className="w-4 h-4" />
                          {language === 'zh' ? '同物異名' : 'Synonyms'}
                        </h3>
                        <div className="flex-1 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-slate-200">
                          <div className="space-y-3 pb-2">
                            {fullData.synonyms.map((syn, idx) => (
                              <div key={idx} className="text-[11px] font-medium text-slate-500 leading-relaxed pb-2 border-b border-slate-50 last:border-0">
                                {formatScientificName(syn, true, true)}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex justify-center pb-4">
                   <p className="text-[10px] font-medium text-slate-400 flex items-center gap-2">
                     Source: Catalogue of Life (COL) • Usage ID: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-emerald-600 font-mono">{fullData?.usageId}</code>
                   </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
