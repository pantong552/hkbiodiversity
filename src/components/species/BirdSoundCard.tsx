'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Volume2,
  Music,
  MapPin,
  User,
  Tag,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  Play,
  ExternalLink,
  Radio,
  Clock,
  Check
} from 'lucide-react';
import { CustomAudioPlayer } from './CustomAudioPlayer';
import { SpectrogramViewer } from './SpectrogramViewer';
import { useLanguage } from '@/context/LanguageContext';

interface SonoObject {
  small?: string | null;
  med?: string | null;
  large?: string | null;
  full?: string | null;
}

interface Recording {
  id: string;
  gen: string;
  sp: string;
  ssp?: string;
  grp?: string;
  status?: string;
  en?: string;
  rec?: string;
  cnt?: string;
  loc?: string;
  lat?: string;
  lon?: string;
  alt?: string;
  type?: string;
  sex?: string;
  stage?: string;
  method?: string;
  url?: string;
  file?: string;
  'file-name'?: string;
  sono?: SonoObject;
  osci?: SonoObject;
  lic?: string;
  q?: string;
  length?: string;
  time?: string;
  date?: string;
  uploaded?: string;
  also?: string[];
  rmk?: string;
  'animal-seen'?: string;
  'playback-used'?: string;
  temp?: string | null;
  regnr?: string;
  auto?: string;
  dvc?: string;
  mic?: string;
  smp?: string;
  'annotation-set'?: any[];
}

interface BirdSoundCardProps {
  scientificName: string;
  commonName?: string;
}

const XENO_CANTO_API_KEY = "060dbba81c2ed20bab7881d4f252afa560c2d2c0";

export default function BirdSoundCard({ scientificName, commonName }: BirdSoundCardProps) {
  const { language } = useLanguage();
  const [rawRecordings, setRawRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // 以 type (聲音類型) 分類：'ALL' 或具體 type 類型
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // 點擊選單外部自動關閉 Dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // 記錄展開 "Show detail" 的錄音 ID
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // 記錄已點擊載入聲音檔的錄音 ID
  const [loadedAudioMap, setLoadedAudioMap] = useState<Record<string, boolean>>({});

  // 記錄各個錄音卡片的聲譜圖 (Spectrogram) 開啟狀態
  const [spectroOpenMap, setSpectroOpenMap] = useState<Record<string, boolean>>({});

  // 每個錄音的 audio element ref（不用 state，避免 60fps re-render）
  const audioElementRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  const getAudioRef = React.useCallback((id: string): React.MutableRefObject<HTMLAudioElement | null> => {
    if (!audioElementRefs.current[id]) {
      audioElementRefs.current[id] = null;
    }
    return {
      get current() { return audioElementRefs.current[id]; },
      set current(el) { audioElementRefs.current[id] = el; }
    };
  }, []);

  const fetchRecordings = async () => {
    if (!scientificName) return;
    setLoading(true);
    setError(null);
    setRawRecordings([]);

    try {
      let recordingsAcc: Recording[] = [];
      let currentPage = 1;
      let totalPages = 1;
      const perPage = 100;

      // 最多擷取前 3 頁 (300 筆)
      while (currentPage <= totalPages && currentPage <= 3) {
        const apiUrl = `https://xeno-canto.org/api/3/recordings?query=${encodeURIComponent(`sp:"${scientificName}"`)}&per_page=${perPage}&page=${currentPage}&key=${XENO_CANTO_API_KEY}`;
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        totalPages = parseInt(data.numPages || '1', 10);

        if (data.recordings && Array.isArray(data.recordings)) {
          recordingsAcc = recordingsAcc.concat(data.recordings);
        }

        currentPage++;
        if (currentPage <= totalPages && currentPage <= 3) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      setRawRecordings(recordingsAcc);
    } catch (err: any) {
      console.error('Failed to fetch xeno-canto recordings:', err);
      setError(err?.message || 'Failed to load recordings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecordings();
  }, [scientificName]);

  // 提取所有不重複的子 type 分類 (以 ',' 分割)，並計算包含該 type 的錄音數量
  const typeCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    const unspecifiedLabel = language === 'zh' ? '未指定' : 'Unspecified';

    rawRecordings.forEach((rec) => {
      const rawType = rec.type?.trim();
      if (!rawType) {
        counts[unspecifiedLabel] = (counts[unspecifiedLabel] || 0) + 1;
      } else {
        // 以 ',' 分割並去除前後空白與重複值
        const subTypes = Array.from(
          new Set(
            rawType
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          )
        );

        subTypes.forEach((subType) => {
          counts[subType] = (counts[subType] || 0) + 1;
        });
      }
    });

    // 依數量由多到少排序
    const sortedTypes = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    return { counts, sortedTypes };
  }, [rawRecordings, language]);

  // 根據 selectedType 過濾錄音列表 (若選取特定 type，只要錄音包含該 type 即符合)
  const filteredRecordings = useMemo(() => {
    if (selectedType === 'ALL') return rawRecordings;
    const unspecifiedLabel = language === 'zh' ? '未指定' : 'Unspecified';

    return rawRecordings.filter((rec) => {
      const rawType = rec.type?.trim();
      if (!rawType) {
        return selectedType === unspecifiedLabel;
      }
      const subTypes = rawType
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      return subTypes.includes(selectedType);
    });
  }, [rawRecordings, selectedType, language]);

  const formatAudioUrl = (rec: Recording) => {
    let audioUrl = rec.file;
    if (!audioUrl) {
      audioUrl = `https://xeno-canto.org/${rec.id}/download`;
    } else if (audioUrl.startsWith('//')) {
      audioUrl = 'https:' + audioUrl;
    }
    return audioUrl;
  };

  return (
    <section className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100/50">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 leading-tight flex items-center gap-2">
              <span>{language === 'zh' ? '鳥類鳴聲紀錄' : 'Bird Sounds'}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold">
                {rawRecordings.length}
              </span>
            </h2>
            <p className="text-xs font-medium text-slate-400">
              {language === 'zh' ? '來自 Xeno-Canto 野外錄音資料庫' : 'Field recordings from Xeno-Canto'}
            </p>
          </div>
        </div>
      </div>

      {/* Type Filter Section */}
      {!loading && !error && rawRecordings.length > 0 && (
        <div className="space-y-2">
          <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Tag className="w-3 h-3 text-emerald-500" />
            <span>{language === 'zh' ? '鳴聲類型篩選 (Type)' : 'Filter by Sound Type'}</span>
          </label>

          {/* Mobile Mode: Completely Customized Floating Dropdown Menu */}
          <div className="block md:hidden relative" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`w-full flex items-center justify-between bg-slate-50 border ${
                isDropdownOpen ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200'
              } text-slate-800 font-bold text-xs py-2.5 px-3.5 rounded-xl transition-all shadow-sm active:scale-[0.99]`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="capitalize truncate">
                  {selectedType === 'ALL'
                    ? language === 'zh'
                      ? '全部 (All)'
                      : 'All'
                    : selectedType}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black shrink-0">
                  {selectedType === 'ALL'
                    ? rawRecordings.length
                    : typeCategories.counts[selectedType] || 0}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180 text-emerald-600' : ''
                }`}
              />
            </button>

            {/* Floating Dropdown List Menu */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-150 rounded-2xl shadow-xl z-50 py-1.5 max-h-56 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150 custom-scrollbar">
                {/* Option: ALL */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedType('ALL');
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 text-xs font-bold flex items-center justify-between transition-colors ${
                    selectedType === 'ALL'
                      ? 'bg-emerald-50 text-emerald-700 font-black'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{language === 'zh' ? '全部 (All)' : 'All'}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                      {rawRecordings.length}
                    </span>
                    {selectedType === 'ALL' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </div>
                </button>

                {/* Divider */}
                <div className="my-1 border-t border-slate-100" />

                {/* Option List */}
                {typeCategories.sortedTypes.map((typeKey) => {
                  const isSelected = selectedType === typeKey;
                  const count = typeCategories.counts[typeKey];
                  return (
                    <button
                      key={typeKey}
                      type="button"
                      onClick={() => {
                        setSelectedType(typeKey);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 text-xs font-bold flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-700 font-black'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="capitalize truncate">{typeKey}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                          {count}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Desktop Mode: Pills Row */}
          <div className="hidden md:flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar scrollbar-none">
            <button
              onClick={() => setSelectedType('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                selectedType === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              <span>{language === 'zh' ? '全部 (All)' : 'All'}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  selectedType === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {rawRecordings.length}
              </span>
            </button>

            {typeCategories.sortedTypes.map((typeKey) => {
              const count = typeCategories.counts[typeKey];
              const isSelected = selectedType === typeKey;
              return (
                <button
                  key={typeKey}
                  onClick={() => setSelectedType(typeKey)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                  }`}
                >
                  <span className="capitalize">{typeKey}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
          <p className="text-xs font-medium tracking-wide">
            {language === 'zh' ? '正在搜尋 Xeno-Canto 錄音庫...' : 'Searching Xeno-Canto database...'}
          </p>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 bg-red-50 text-red-700 p-4 rounded-2xl border border-red-100 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{language === 'zh' ? `載入失敗: ${error}` : `Failed to load: ${error}`}</span>
        </div>
      ) : filteredRecordings.length === 0 ? (
        <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <Music className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-500">
            {language === 'zh' ? '暫無符合條件的鳴聲紀錄' : 'No sound recordings found'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {language === 'zh'
              ? `未能在 Xeno-Canto 找到類別為 "${selectedType}" 的 ${scientificName} 錄音`
              : `No "${selectedType}" recordings found for ${scientificName}`}
          </p>
        </div>
      ) : (
        <div
          className={`space-y-3.5 overflow-y-auto pr-1 custom-scrollbar transition-all duration-300 ${
            Object.values(spectroOpenMap).some(Boolean) ? 'max-h-[750px]' : 'max-h-[550px]'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold px-1">
            <span>
              {language === 'zh'
                ? `顯示 ${filteredRecordings.length} / ${rawRecordings.length} 筆錄音`
                : `Showing ${filteredRecordings.length} / ${rawRecordings.length} recordings`}
            </span>
            <span>Xeno-Canto Field Archive</span>
          </div>

          {filteredRecordings.map((rec, index) => {
            const audioSrc = formatAudioUrl(rec);
            const isLoaded = loadedAudioMap[rec.id];
            const isExpanded = expandedId === rec.id;
            const isSpectroOpen = !!spectroOpenMap[rec.id];

            // 優先使用 full 聲譜圖圖片，次選 large / med / small
            const sonoImgUrl = rec.sono?.full || rec.sono?.large || rec.sono?.med || rec.sono?.small;
            // 每個錄音一個穩定的 ref，傳給 CustomAudioPlayer & SpectrogramViewer
            const audioRef = getAudioRef(rec.id);

            return (
              <div
                key={rec.id || index}
                className={`bg-slate-50 hover:bg-slate-100/80 transition-all rounded-2xl border ${
                  isExpanded || isSpectroOpen
                    ? 'border-emerald-500 ring-2 ring-emerald-500/10 shadow-sm'
                    : 'border-slate-200 hover:border-emerald-300'
                } p-4 space-y-3`}
              >
                {/* 1. Summary Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-black">
                      #{index + 1}
                    </span>
                    <a
                      href={rec.url || `https://xeno-canto.org/${rec.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-black text-slate-800 hover:text-emerald-600 transition-colors flex items-center gap-1"
                    >
                      <span>XC{rec.id}</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                    {rec.type && (
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-md text-[10px] font-bold capitalize">
                        {rec.type}
                      </span>
                    )}
                    {rec.length && (
                      <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{rec.length}</span>
                      </span>
                    )}
                  </div>

                  {rec.status && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        rec.status === 'identified'
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/50'
                          : 'bg-amber-50 text-amber-600 border border-amber-200/50'
                      }`}
                    >
                      {rec.status}
                    </span>
                  )}
                </div>

                {/* 2. Spectrogram Container (Smooth grid-rows collapse/expand animation) */}
                {isLoaded && sonoImgUrl && (
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isSpectroOpen
                        ? 'grid-rows-[1fr] opacity-100 mt-2 mb-1'
                        : 'grid-rows-[0fr] opacity-0 mt-0 mb-0 pointer-events-none'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <SpectrogramViewer
                        sonoImgUrl={sonoImgUrl}
                        recId={rec.id}
                        audioElementRef={audioRef}
                        language={language}
                      />
                    </div>
                  </div>
                )}

                {/* 3. Audio Player Action Row (填滿全行 100% 寬度) */}
                <div className="pt-0.5 w-full">
                  {!isLoaded ? (
                    <button
                      onClick={() => {
                        setLoadedAudioMap((prev) => ({ ...prev, [rec.id]: true }));
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99]"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{language === 'zh' ? '載入聲音檔 (點擊播放)' : 'Load Sound File'}</span>
                    </button>
                  ) : (
                    <CustomAudioPlayer
                      src={audioSrc}
                      autoPlay={true}
                      audioElementRef={audioRef}
                      showSpectrogram={isSpectroOpen}
                      onToggleSpectrogram={() =>
                        setSpectroOpenMap((prev) => ({ ...prev, [rec.id]: !prev[rec.id] }))
                      }
                    />
                  )}
                </div>

                {/* 4. Primary Meta Grid (Location & Author Row) + Show Detail Button 統一融合欄位 */}
                <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between gap-2 text-xs text-slate-600">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate" title={`${rec.loc || ''} ${rec.cnt || ''}`}>
                        {rec.loc || (language === 'zh' ? '未知地點' : 'Unknown location')}
                        {rec.cnt ? `, ${rec.cnt}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate" title={rec.rec || ''}>
                        {rec.rec || (language === 'zh' ? '匿名錄音者' : 'Anonymous')}
                      </span>
                    </div>
                  </div>

                  {/* Show Detail Button 放在最右邊 */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                    className={`py-1.5 px-3 rounded-xl border text-[11px] font-extrabold flex items-center shrink-0 gap-1 transition-all ${
                      isExpanded
                        ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <span>{isExpanded ? (language === 'zh' ? '收起詳情' : 'Hide detail') : (language === 'zh' ? '完整詳情' : 'Show detail')}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* 5. Expanded Detailed Information Panel (與 Location/Author 資料自然整合) */}
                {isExpanded && (
                  <div className="pt-2 space-y-3 text-xs animate-fadeIn">
                    {/* Detailed Metadata Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-white p-3.5 rounded-xl border border-slate-200/60 text-slate-700">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{language === 'zh' ? '物種學名' : 'Species'}</span>
                        <span className="font-semibold italic text-slate-900">{rec.gen} {rec.sp} {rec.ssp}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{language === 'zh' ? '英文俗名' : 'English Name'}</span>
                        <span className="font-semibold text-slate-800">{rec.en || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{language === 'zh' ? '錄音日期 / 時間' : 'Date / Time'}</span>
                        <span className="font-semibold text-slate-800">{rec.date || '-'} {rec.time || ''}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{language === 'zh' ? '經緯度' : 'Coordinates (Lat / Lon)'}</span>
                        <span className="font-semibold text-slate-800">
                          {rec.lat && rec.lon ? `${rec.lat}, ${rec.lon}` : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{language === 'zh' ? '海拔' : 'Altitude (Elevation)'}</span>
                        <span className="font-semibold text-slate-800">{rec.alt ? `${rec.alt}m` : '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{language === 'zh' ? '發聲個體階段 │ 性別' : 'Stage │ Sex'}</span>
                        <span className="font-semibold text-slate-800 capitalize">
                          {[rec.stage, rec.sex].filter(Boolean).join(' │ ') || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{language === 'zh' ? '錄音方法' : 'Method'}</span>
                        <span className="font-semibold text-slate-800">
                          {rec.method
                            ? rec.method.charAt(0).toUpperCase() + rec.method.slice(1)
                            : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{language === 'zh' ? '採樣率' : 'Sample Rate'}</span>
                        <span className="font-semibold text-slate-800">{rec.smp ? `${rec.smp} Hz` : '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{language === 'zh' ? '錄音品質等級' : 'Quality Rating'}</span>
                        <span className="font-extrabold text-emerald-600">Grade {rec.q || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{language === 'zh' ? '目擊動物 │ 回放引誘' : 'Seen │ Playback'}</span>
                        <span className="font-semibold text-slate-800">
                          {(() => {
                            const formatBool = (val?: string) => {
                              if (!val || val === 'unknown') return '-';
                              const isYes = val.toLowerCase() === 'yes';
                              if (language === 'zh') return isYes ? '是' : '否';
                              return isYes ? 'Yes' : 'No';
                            };
                            return `${formatBool(rec['animal-seen'])} │ ${formatBool(rec['playback-used'])}`;
                          })()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{language === 'zh' ? '錄音設備 / 麥克風' : 'Device / Mic'}</span>
                        <span className="font-semibold text-slate-800 truncate block" title={[rec.dvc, rec.mic].filter(Boolean).join(' / ')}>
                          {[rec.dvc, rec.mic].filter(Boolean).join(' / ') || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{language === 'zh' ? '創用 CC 授權' : 'License'}</span>
                        {rec.lic ? (
                          <a
                            href={rec.lic}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 underline font-extrabold truncate block"
                            title={rec.lic}
                          >
                            {(() => {
                              try {
                                const urlObj = new URL(rec.lic);
                                const parts = urlObj.pathname.split('/').filter(Boolean);
                                // 例: /licenses/by-nc-sa/4.0/ => ['licenses', 'by-nc-sa', '4.0']
                                const licIndex = parts.indexOf('licenses');
                                if (licIndex !== -1 && parts[licIndex + 1]) {
                                  const code = parts[licIndex + 1].toUpperCase();
                                  const version = parts[licIndex + 2] ? ` ${parts[licIndex + 2]}` : '';
                                  return `CC ${code}${version}`;
                                }
                              } catch (e) {
                                // fallback regexp match
                                const match = rec.lic.match(/licenses\/([^\/]+)(?:\/([^\/]+))?/i);
                                if (match && match[1]) {
                                  const code = match[1].toUpperCase();
                                  const version = match[2] ? ` ${match[2]}` : '';
                                  return `CC ${code}${version}`;
                                }
                              }
                              return 'CC License';
                            })()}
                          </a>
                        ) : '-'}
                      </div>
                    </div>

                    {/* Background Species (also) */}
                    {rec.also && rec.also.length > 0 && (
                      <div className="bg-slate-100/70 p-2.5 rounded-xl text-slate-600 text-[11px]">
                        <span className="font-bold text-slate-700 mr-1.5">{language === 'zh' ? '背景包含其他鳥種:' : 'Background species:'}</span>
                        <span className="italic">{rec.also.join(', ')}</span>
                      </div>
                    )}

                    {/* Remarks (rmk) */}
                    {rec.rmk && (
                      <div className="bg-amber-50/60 border border-amber-100 p-3 rounded-xl text-amber-900 text-xs">
                        <span className="font-bold block mb-0.5 text-amber-800">{language === 'zh' ? '錄音備註 (Remarks):' : 'Remarks:'}</span>
                        <p className="whitespace-pre-wrap leading-relaxed">{rec.rmk}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
