import { useState } from 'react';
import { Species } from '@/types/species';
import { useLanguage } from '@/context/LanguageContext';
import { Layers, ChevronDown, Dna, Search, Loader2, Sparkles, AlertCircle, Info, Tag, BookOpen, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSpeciesPanel } from '@/context/SpeciesPanelContext';
import { formatScientificName, parseAliases } from '@/utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import { useTaxonomy } from '@/context/TaxonomyContext';

interface TaxonomyDisplayProps {
  species: Species;
}

interface FullTaxonomyData {
  usageId: string;
  classification: { rank: string; name: string; id: string; authorship?: string }[];
  synonyms: string[];
  subspecies: string[];
  datasetKey?: string;
  datasetTitle?: string;
  datasetVersion?: string;
  datasetIssued?: string;
}


export default function TaxonomyDisplay({ species }: TaxonomyDisplayProps) {
  const { language } = useLanguage();
  const { getTaxonomyChi } = useTaxonomy();
  const router = useRouter();
  const { toggleExpand, setPendingTaxonomyFilter } = useSpeciesPanel();

  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllSynonyms, setShowAllSynonyms] = useState(false);
  const [fullData, setFullData] = useState<FullTaxonomyData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 判斷是否為植物或真菌
  const isPlant = species.taxa_group === 'FLORA' || (!species.phylum_eng && !!(species as any).family_chi);
  const isFungi = species.taxa_group === 'FUNGI' || String(species.taxa_id || '').startsWith('fungi_');
  const taxaType = isPlant ? 'flora' : (isFungi ? 'fungi' : 'fauna');

  const levels = isPlant ? [
    {
      id: 'categories', labelChi: '類別', labelEng: 'Category',
      chi: getTaxonomyChi('category', taxaType, (species as any).category_eng), eng: (species as any).category_eng
    },
    {
      id: 'families', labelChi: '科', labelEng: 'Family',
      chi: getTaxonomyChi('family', taxaType, (species as any).family_eng), eng: (species as any).family_eng
    },
    {
      id: 'genuses', labelChi: '屬', labelEng: 'Genus',
      chi: getTaxonomyChi('genus', taxaType, (species as any).genus_eng), eng: (species as any).genus_eng,
      isScientific: true
    },
    {
      id: 'species', labelChi: '種', labelEng: 'Species',
      chi: species.scientific_name, eng: species.species_eng,
      isScientific: true,
      isCurrent: true
    },
  ] : [
    {
      id: 'phylum_eng', labelChi: '門', labelEng: 'Phylum',
      chi: getTaxonomyChi('phylum', taxaType, species.phylum_eng), eng: species.phylum_eng
    },
    {
      id: 'class_eng', labelChi: '綱', labelEng: 'Class',
      chi: getTaxonomyChi('class', taxaType, species.class_eng), eng: species.class_eng
    },
    {
      id: 'order_eng', labelChi: '目', labelEng: 'Order',
      chi: getTaxonomyChi('order', taxaType, species.order_eng), eng: species.order_eng
    },
    {
      id: 'family_eng', labelChi: '科', labelEng: 'Family',
      chi: getTaxonomyChi('family', taxaType, species.family_eng), eng: species.family_eng
    },
    {
      id: 'genus_eng', labelChi: '屬', labelEng: 'Genus',
      chi: getTaxonomyChi('genus', taxaType, species.genus_eng), eng: species.genus_eng,
      isScientific: true
    },
    {
      id: 'species', labelChi: '種', labelEng: 'Species',
      chi: species.scientific_name, eng: species.species_eng,
      isScientific: true,
      isCurrent: true
    },
  ];

  const handleTaxonomyClick = (levelId: string, value: string, chiValue?: string) => {
    const searchValue = isPlant ? (chiValue || value) : value;
    if (!searchValue || levelId === 'species') return;

    setPendingTaxonomyFilter({ level: levelId, value: searchValue });
    toggleExpand(false);

    if (window.location.pathname !== '/database') {
      router.push('/database');
    }
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

  const chiAliases = parseAliases(species.alias_common_name_chi);
  const engAliases = parseAliases(species.alias_common_name_eng);
  const sciAliases = parseAliases(species.alias_scientific_name);

  return (

    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 sm:gap-4 mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center justify-between flex-1 truncate">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            </div>
            <span className="truncate">{language === 'zh' ? '基本資料' : 'Basic Information'}</span>
          </div>

          <div className="sm:hidden shrink-0">
            <a
              href={`https://www.inaturalist.org/taxa/${species.inat_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-xl shadow-sm active:bg-slate-50 transition-colors"
            >
              <img src="/INaturalist_logo.svg" alt="iNaturalist" className="w-4 h-4 object-contain" />
            </a>
          </div>
        </h2>

        <div className="hidden sm:block shrink-0">
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

      {/* Main Grid: Left = Basic Specs & Aliases (7 col), Right = Taxonomy Hierarchy (5 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* Left Column: 基本資料 & 別名 (佔比 7/12 ~ 58.3%, 即 3:2 比例) */}
        <div className="lg:col-span-7 flex flex-col space-y-6">
          
          {/* 物種主名稱資訊卡片 */}
          <div className="bg-slate-50/80 rounded-2xl p-4.5 border border-slate-100/80 space-y-3">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {language === 'zh' ? '名稱與學名' : 'Names & Nomenclature'}
            </h3>

            <div className="space-y-2.5">
              {/* 1. 學名 */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 block leading-tight">
                  {language === 'zh' ? '學名' : 'Scientific Name'}
                </span>
                <p className="text-sm font-bold text-slate-800 leading-snug">
                  {species.scientific_name ? (
                    <>
                      {formatScientificName(species.scientific_name, true)}
                      {species.author && (
                        <span className="text-xs font-normal text-slate-500 ml-1.5">
                          {species.author}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-400 font-normal">-</span>
                  )}
                </p>
              </div>

              {/* 2 & 3. 中文俗名與英文俗名 (Desktop 2-column 排版) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
                {/* 中文俗名 (僅中文語系) */}
                {language === 'zh' && (
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 block leading-tight">
                      中文俗名
                    </span>
                    <p className="text-sm font-bold text-slate-800 leading-snug">
                      {species.common_name_chi || <span className="text-slate-400 font-normal">-</span>}
                    </p>
                  </div>
                )}

                {/* 英文俗名 */}
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block leading-tight">
                    {language === 'zh' ? '英文俗名' : 'English Common Name'}
                  </span>
                  <p className="text-sm font-bold text-slate-800 leading-snug">
                    {species.common_name_eng || <span className="text-slate-400 font-normal">-</span>}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 別名清單區塊 */}
          <div className="bg-slate-50/80 rounded-2xl p-4.5 border border-slate-100/80 space-y-3">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-emerald-500" />
              {language === 'zh' ? '別名與異名' : 'Aliases & Synonyms'}
            </h3>

            <div className="space-y-2.5">
              {/* 中文俗名別名 (僅中文語系) */}
              {language === 'zh' && (
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block leading-tight">
                    中文俗名別名
                  </span>
                  <p className="text-sm font-bold text-slate-800 leading-snug">
                    {chiAliases.length > 0 ? chiAliases.join('、') : <span className="text-slate-400 font-normal">-</span>}
                  </p>
                </div>
              )}

              {/* 英文俗名別名 */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 block leading-tight">
                  {language === 'zh' ? '英文俗名別名' : 'English Alias'}
                </span>
                <p className="text-sm font-bold text-slate-800 leading-snug">
                  {engAliases.length > 0 ? engAliases.join(', ') : <span className="text-slate-400 font-normal">-</span>}
                </p>
              </div>

              {/* 同物異名 */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 block leading-tight mb-1">
                  {language === 'zh' ? '同物異名' : 'Synonyms'}
                </span>
                <div className="text-sm font-bold text-slate-800 leading-snug">
                  {sciAliases.length > 0 ? (
                    <div>
                      {/* 1. 常駐展示的前 4 個項目：永遠固定，不套用 height 動畫，確保完全不受拉伸影響 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                        {sciAliases.slice(0, 4).map((syn, idx) => (
                          <div key={`syn-fixed-${idx}`} className="truncate">
                            {formatScientificName(syn, true)}
                          </div>
                        ))}
                      </div>

                      {/* 2. 第 5 個起的擴展項目：套用高度過渡與透明度過渡動畫 */}
                      {sciAliases.length > 4 && (
                        <AnimatePresence>
                          {showAllSynonyms && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pt-1">
                                {sciAliases.slice(4).map((syn, idx) => (
                                  <div key={`syn-extra-${idx}`} className="truncate">
                                    {formatScientificName(syn, true)}
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      )}

                      {/* Toggle 按鈕 */}
                      {sciAliases.length > 6 && (
                        <button
                          onClick={() => setShowAllSynonyms(prev => !prev)}
                          className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors focus:outline-none"
                        >
                          <span>
                            {showAllSynonyms 
                              ? (language === 'zh' ? '收起' : 'Show less') 
                              : (language === 'zh' ? `顯示更多 (${sciAliases.length - 4})` : `Show more (${sciAliases.length - 4})`)}
                          </span>
                          <ChevronDown 
                            className={`w-3 h-3 transition-transform duration-300 ${showAllSynonyms ? 'rotate-180' : ''}`} 
                          />
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-400 font-normal">-</span>
                  )}
                </div>
              </div>
            </div>
          </div>




        </div>

        {/* Right Column: 分類階層 (佔比 5/12) */}
        <div className="lg:col-span-5 flex flex-col justify-start">
          <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100/80 space-y-4 h-full">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
              <Layers className="w-3.5 h-3.5 text-emerald-500" />
              {language === 'zh' ? '分類階層' : 'Taxonomic Hierarchy'}
            </h3>

            {/* List Path without left connecting line */}
            <div className="flex flex-col space-y-2">
              {levels.map((level, idx) => {
                if (!level.chi && !level.eng) return null;
                const isClickable = !level.isCurrent;
                return (
                  <div key={idx} className="relative flex items-center py-0.5">
                    <div
                      onClick={() => isClickable && handleTaxonomyClick(level.id, level.eng, level.chi)}
                      className={`flex-1 py-2 px-3.5 rounded-xl border transition-all ${
                        level.isCurrent 
                          ? 'bg-emerald-50/90 border-emerald-200 shadow-sm ring-1 ring-emerald-500/20' 
                          : 'bg-white border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/40 hover:shadow-sm cursor-pointer'
                      }`}
                    >

                      <div className="flex items-center gap-3">
                        <div className={`shrink-0 ${language === 'zh' ? 'w-7' : 'w-[68px]'} flex items-center justify-start`}>
                          <div className={`flex items-center justify-center ${language === 'zh' ? 'w-7 h-5 rounded-md' : 'w-full h-5 px-1 rounded-md'} border text-center ${level.isCurrent ? 'bg-emerald-600 border-emerald-500 shadow-sm' : 'bg-slate-100 border-slate-200'}`}>
                            <span className={`${language === 'zh' ? 'text-[12px] font-bold' : 'text-[9px] font-black uppercase tracking-widest'} ${level.isCurrent ? 'text-white' : 'text-slate-600'}`}>
                              {language === 'zh' ? level.labelChi : level.labelEng}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
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
                );
              })}
            </div>
          </div>
        </div>

      </div>



      {/* Expandable Area */}
      <div className="mt-4 sm:mt-8 pt-0">
        <button
          onClick={toggleFullTaxonomy}
          className={`w-full flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl transition-all duration-500 group ${isExpanded ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-emerald-50'}`}
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
                    <div className="bg-white rounded-[2rem] p-5 md:p-8 shadow-sm border border-slate-100 flex flex-col">
                      <div className="space-y-1 relative flex-1 -mx-2 md:mx-0">
                        {fullData.classification.map((item, idx) => {
                          const rankLower = item.rank.toLowerCase();
                          const rankMap: Record<string, string> = {
                            domain: '域', kingdom: '界', subkingdom: '亞界', phylum: '門', subphylum: '亞門',
                            infraphylum: '下門', parvphylum: '小門', superclass: '總綱',
                            class: '綱', subclass: '亞綱', infraclass: '下綱', megaclass: '巨綱', gigaclass: '大綱',
                            superorder: '總目', order: '目', suborder: '亞目', infraorder: '下目',
                            parvorder: '小目', superfamily: '總科', family: '科', subfamily: '亞科',
                            supertribe: '總族', tribe: '族', subtribe: '亞族', genus: '屬',
                            subgenus: '亞節', section: '節', subsection: '亞節', species: '種',
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
                      {/* 已知亞種 Card - UI 與同物異名保持一致 */}
                      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 group flex flex-col overflow-hidden">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-500" />
                          {language === 'zh' ? '已知亞種' : 'Known Subspecies'}
                        </h3>
                        <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                          {fullData.subspecies.length > 0 ? (
                            <div className="space-y-1.5">
                              {fullData.subspecies.map((sub, idx) => (
                                <div key={idx} className="text-[12px] font-bold text-slate-700 leading-snug py-0.5">
                                  {formatScientificName(sub, true, true)}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs font-normal">-</span>
                          )}
                        </div>
                      </div>

                      {/* 同物異名 Card */}
                      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 group flex-1 flex flex-col overflow-hidden">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Info className="w-4 h-4 text-emerald-500" />
                          {language === 'zh' ? '同物異名' : 'Synonyms'}
                        </h3>
                        <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                          {fullData.synonyms.length > 0 ? (
                            <div className="space-y-1.5">
                              {fullData.synonyms.map((syn, idx) => (
                                <div key={idx} className="text-[12px] font-bold text-slate-700 leading-snug py-0.5">
                                  {formatScientificName(syn, true, true)}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs font-normal">-</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-x-3 gap-y-1.5 pb-4 text-[10px] font-medium text-slate-400 text-center">
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <span>Source: Catalogue of Life (COL)</span>
                    {fullData?.datasetVersion && (
                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold whitespace-nowrap">
                        Release: {fullData.datasetVersion}
                      </span>
                    )}
                    {fullData?.datasetIssued && (
                      <span className="text-slate-400 whitespace-nowrap">
                        Issued: {fullData.datasetIssued}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <span className="hidden sm:inline">•</span>
                    <span>Usage ID:</span>
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-emerald-600 font-mono">
                      {fullData?.usageId}
                    </code>
                    {fullData?.usageId && (
                      <a
                        href={`https://www.checklistbank.org/dataset/${fullData.datasetKey || '3LXR'}/taxon/${fullData.usageId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-500 hover:text-emerald-600 inline-flex items-center"
                        title="View on Catalogue of Life (ChecklistBank)"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
