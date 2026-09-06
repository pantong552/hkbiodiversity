'use client';

import React, { useState, useEffect, useRef } from 'react';
import Map, { Source, Layer, MapLayerMouseEvent, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as turf from '@turf/turf';
import { fetchAllInatObservations, InatObservation } from '@/utils/inaturalist';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, User, ExternalLink, MapPin, Loader2, Info, Bird, Maximize, MousePointer2, Layers, Shield, Link as LinkIcon, Filter, Building2, Camera, ChevronDown, Check, CheckCircle2, Database, Sparkles, TrendingUp, BarChart3, Activity, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { FullscreenControl, NavigationControl as MapNavControl, Popup } from 'react-map-gl/maplibre';

import { fetchBgisSpeciesList, fetchBgisObservationStats, BgisGridRecord, BgisDatasetItem, BGIS_DATASETS } from '@/utils/bgis';
import { fetchEbirdMapPoints, fetchEbirdObservationStats, EbirdRecord, fetchEbirdLocInfo, EbirdLocInfo, getEbirdEvidenceLabel } from '@/utils/ebird';

/**
 * 將 iNaturalist 圖片 URL 轉換為 Vercel External Rewrite 相對路徑（反向代理）與指定尺寸
 */
const getInatRewriteUrl = (url: string, size: 'square' | 'small' | 'medium' | 'large' | 'original' = 'square') => {
  if (!url) return '';
  let sizedUrl = url
    .replace('/square.', `/${size}.`)
    .replace('/medium.', `/${size}.`)
    .replace('/large.', `/${size}.`)
    .replace('/small.', `/${size}.`);

  if (sizedUrl.includes('inaturalist-open-data.s3.amazonaws.com/')) {
    return sizedUrl.replace('https://inaturalist-open-data.s3.amazonaws.com/', '/inat-s3/');
  }
  if (sizedUrl.includes('static.inaturalist.org/')) {
    return sizedUrl.replace('https://static.inaturalist.org/', '/inat-static/');
  }
  if (sizedUrl.includes('uploads.inaturalist.org/')) {
    return sizedUrl.replace('https://uploads.inaturalist.org/', '/inat-uploads/');
  }
  return sizedUrl;
};

interface SpeciesMapProps {
  taxonId?: number;
  scientificName?: string;
  chineseName?: string;
  taxaGroup?: string;
  ebirdSpeciesCode?: string;
}

interface GridFeatureProperties {
  grid_id: string | number;
  grid_no?: string;
  count: number;
  observations: InatObservation[];
  bgisCount?: number;
  bgisDataset?: BgisDatasetItem[];
  ebirdCount?: number;
  ebirdRecords?: EbirdRecord[];
}

type ObservationChartPoint = { label: string; inat: number; bgis: number; ebird: number };
type ObservationStats = {
  seasonality: { month: number; count: number }[];
  history: { year: number; count: number }[];
};

type SpeciesMapCacheEntry = {
  observations: InatObservation[];
  bgisList: BgisGridRecord[];
  ebirdRecords: EbirdRecord[];
  processedFeatures: any[];
  totalBgisCount: number;
};

const speciesMapCache: Record<string, SpeciesMapCacheEntry> = {};
const observationStatsCache: Record<string, { bgis: ObservationStats; ebird: ObservationStats }> = {};

function getSpeciesDataKey({ taxonId, scientificName, chineseName, taxaGroup, ebirdSpeciesCode }: SpeciesMapProps): string {
  return [taxonId || 0, scientificName || '', chineseName || '', taxaGroup || '', ebirdSpeciesCode || ''].join('|');
}

function getMonotoneSplinePath(coords: { x: number; y: number }[], baseY: number, topY: number): string {
  const n = coords.length;
  if (n === 0) return '';
  if (n === 1) return `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  if (n === 2) return `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)} L ${coords[1].x.toFixed(1)} ${coords[1].y.toFixed(1)}`;

  const dx: number[] = new Array(n - 1);
  const dy: number[] = new Array(n - 1);
  const slopes: number[] = new Array(n - 1);

  for (let i = 0; i < n - 1; i++) {
    dx[i] = coords[i + 1].x - coords[i].x;
    dy[i] = coords[i + 1].y - coords[i].y;
    slopes[i] = dx[i] !== 0 ? dy[i] / dx[i] : 0;
  }

  const tangents: number[] = new Array(n);
  tangents[0] = slopes[0];
  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      tangents[i] = 0;
    } else {
      tangents[i] = (slopes[i - 1] + slopes[i]) / 2;
    }
  }
  tangents[n - 1] = slopes[n - 2];

  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const alpha = tangents[i] / slopes[i];
      const beta = tangents[i + 1] / slopes[i];
      if (alpha < 0) tangents[i] = 0;
      if (beta < 0) tangents[i + 1] = 0;
      const magSq = alpha * alpha + beta * beta;
      if (magSq > 9) {
        const tau = 3 / Math.sqrt(magSq);
        tangents[i] = tau * alpha * slopes[i];
        tangents[i + 1] = tau * beta * slopes[i];
      }
    }
  }

  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const segDx = dx[i];

    const cp1x = p0.x + segDx / 3;
    let cp1y = p0.y + (tangents[i] * segDx) / 3;

    const cp2x = p1.x - segDx / 3;
    let cp2y = p1.y - (tangents[i + 1] * segDx) / 3;

    // Strict clamping: never dip below baseY (0 count baseline) or above top of chart
    cp1y = Math.min(baseY, Math.max(topY, cp1y));
    cp2y = Math.min(baseY, Math.max(topY, cp2y));

    if (Math.abs(p0.y - baseY) < 0.01 && Math.abs(p1.y - baseY) < 0.01) {
      cp1y = baseY;
      cp2y = baseY;
    }

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }

  return d;
}

function getMonotoneAreaPath(coords: { x: number; y: number }[], baseY: number, topY: number): string {
  if (coords.length === 0) return '';
  const lineD = getMonotoneSplinePath(coords, baseY, topY);
  const first = coords[0];
  const last = coords[coords.length - 1];
  return `${lineD} L ${last.x.toFixed(1)} ${baseY.toFixed(1)} L ${first.x.toFixed(1)} ${baseY.toFixed(1)} Z`;
}

export interface ObservationChartProps {
  taxonId?: number;
  observations?: InatObservation[];
  scientificName?: string;
  chineseName?: string;
  ebirdSpeciesCode?: string;
  isBirdGroup?: boolean;
  language?: 'zh' | 'en';
  enabled?: boolean;
}

export function ObservationChart({
  taxonId,
  observations: propObservations,
  scientificName,
  chineseName,
  ebirdSpeciesCode,
  isBirdGroup = false,
  language = 'zh',
  enabled = true
}: ObservationChartProps) {
  const [inatObservations, setInatObservations] = useState<InatObservation[]>(propObservations || []);

  useEffect(() => {
    if (propObservations && propObservations.length > 0) {
      setInatObservations(propObservations);
      return;
    }
    if (!taxonId || taxonId <= 0) return;

    for (const key of Object.keys(speciesMapCache)) {
      if (speciesMapCache[key]?.observations?.length) {
        setInatObservations(speciesMapCache[key].observations);
        return;
      }
    }

    let cancelled = false;
    fetchAllInatObservations(taxonId).then(obs => {
      if (!cancelled) setInatObservations(obs);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [taxonId, propObservations]);

  const observations = propObservations || inatObservations;

  const statsKey = `${scientificName || ''}|${chineseName || ''}|${ebirdSpeciesCode || ''}|${isBirdGroup}`;
  const initialCache = observationStatsCache[statsKey];
  const [mode, setMode] = useState<'seasonality' | 'history'>('seasonality');
  const [bgisStats, setBgisStats] = useState<ObservationStats>(initialCache?.bgis || { seasonality: [], history: [] });
  const [ebirdStats, setEbirdStats] = useState<ObservationStats>(initialCache?.ebird || { seasonality: [], history: [] });
  const [isBgisLoading, setIsBgisLoading] = useState(!initialCache?.bgis && !!(scientificName || chineseName));
  const [isEbirdLoading, setIsEbirdLoading] = useState(!initialCache?.ebird && isBirdGroup && !!ebirdSpeciesCode);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeSources, setActiveSources] = useState<Set<'inat' | 'bgis' | 'ebird'>>(new Set(['inat', 'bgis', 'ebird']));
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(event.target as Node)) {
        setIsModeDropdownOpen(false);
      }
    };
    if (isFilterDropdownOpen || isModeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterDropdownOpen, isModeDropdownOpen]);

  useEffect(() => {
    if (!enabled) return;
    const statsKey = `${scientificName || ''}|${chineseName || ''}|${ebirdSpeciesCode || ''}|${isBirdGroup}`;
    const cachedStats = observationStatsCache[statsKey];
    if (cachedStats) {
      setBgisStats(cachedStats.bgis);
      setEbirdStats(cachedStats.ebird);
      setIsBgisLoading(false);
      setIsEbirdLoading(false);
      return;
    }

    let cancelled = false;
    if (scientificName || chineseName) {
      setIsBgisLoading(true);
      fetchBgisObservationStats(scientificName || '', chineseName)
        .then(nextBgis => {
          if (cancelled) return;
          setBgisStats(nextBgis);
          setIsBgisLoading(false);
        })
        .catch(() => {
          if (!cancelled) setIsBgisLoading(false);
        });
    }

    if (isBirdGroup && ebirdSpeciesCode) {
      setIsEbirdLoading(true);
      fetchEbirdObservationStats(ebirdSpeciesCode)
        .then(nextEbird => {
          if (cancelled) return;
          setEbirdStats(nextEbird);
          setIsEbirdLoading(false);
        })
        .catch(() => {
          if (!cancelled) setIsEbirdLoading(false);
        });
    }

    return () => { cancelled = true; };
  }, [scientificName, chineseName, ebirdSpeciesCode, isBirdGroup, enabled]);

  useEffect(() => {
    if (!isBgisLoading && !isEbirdLoading) {
      const statsKey = `${scientificName || ''}|${chineseName || ''}|${ebirdSpeciesCode || ''}|${isBirdGroup}`;
      observationStatsCache[statsKey] = { bgis: bgisStats, ebird: ebirdStats };
    }
  }, [isBgisLoading, isEbirdLoading, bgisStats, ebirdStats, scientificName, chineseName, ebirdSpeciesCode, isBirdGroup]);

  const toggleSource = (src: 'inat' | 'bgis' | 'ebird') => {
    setActiveSources(prev => {
      const next = new Set(prev);
      if (next.has(src)) {
        if (next.size > 1) next.delete(src);
      } else {
        next.add(src);
      }
      return next;
    });
  };

  const selectedSourcesSummary = [
    activeSources.has('inat') ? 'iNat' : null,
    activeSources.has('bgis') ? 'BGIS' : null,
    (isBirdGroup && activeSources.has('ebird')) ? 'eBird' : null
  ].filter(Boolean).join(' + ') || (language === 'zh' ? '無選擇' : 'None');

  const inatSeasonality = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    count: observations.filter(observation => Number(observation.observed_on_details?.date?.slice(5, 7)) === index + 1).length
  }));
  const inatHistoryMap = observations.reduce<Record<number, number>>((counts, observation) => {
    const year = Number(observation.observed_on_details?.date?.slice(0, 4));
    if (year) counts[year] = (counts[year] || 0) + 1;
    return counts;
  }, {});
  const historyYears = Array.from(new Set([
    ...Object.keys(inatHistoryMap).map(Number),
    ...bgisStats.history.map(point => point.year),
    ...ebirdStats.history.map(point => point.year)
  ])).sort((a, b) => a - b);
  const points: ObservationChartPoint[] = mode === 'seasonality'
    ? inatSeasonality.map((point, index) => ({
      label: String(point.month),
      inat: point.count,
      bgis: bgisStats.seasonality[index]?.count || 0,
      ebird: ebirdStats.seasonality[index]?.count || 0
    }))
    : historyYears.map(year => ({
      label: String(year),
      inat: inatHistoryMap[year] || 0,
      bgis: bgisStats.history.find(point => point.year === year)?.count || 0,
      ebird: ebirdStats.history.find(point => point.year === year)?.count || 0
    }));
  const visibleSources = (['inat', 'bgis', ...(isBirdGroup ? ['ebird' as const] : [])] as const).filter(s => activeSources.has(s));
  const maxValue = Math.max(
    1,
    ...points.flatMap(point => visibleSources.map(s => point[s]))
  );

  const totalInat = points.reduce((sum, p) => sum + p.inat, 0);
  const totalBgis = points.reduce((sum, p) => sum + p.bgis, 0);
  const totalEbird = points.reduce((sum, p) => sum + p.ebird, 0);
  const totalActive = points.reduce((sum, p) => {
    let s = 0;
    if (activeSources.has('inat')) s += p.inat;
    if (activeSources.has('bgis')) s += p.bgis;
    if (isBirdGroup && activeSources.has('ebird')) s += p.ebird;
    return sum + s;
  }, 0);

  let peakIndex = -1;
  let peakValue = -1;
  points.forEach((p, idx) => {
    let s = 0;
    if (activeSources.has('inat')) s += p.inat;
    if (activeSources.has('bgis')) s += p.bgis;
    if (isBirdGroup && activeSources.has('ebird')) s += p.ebird;
    if (s > peakValue && s > 0) {
      peakValue = s;
      peakIndex = idx;
    }
  });

  const chartWidth = 640;
  const chartHeight = 310;
  const padding = { top: 24, right: 14, bottom: 38, left: 30 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const baseY = padding.top + plotHeight;

  const toX = (index: number) => padding.left + (points.length > 1 ? (index / (points.length - 1)) * plotWidth : plotWidth / 2);
  const toY = (value: number) => padding.top + plotHeight - (maxValue > 0 ? (value / maxValue) * plotHeight : 0);

  const yTicks = React.useMemo(() => {
    if (maxValue <= 4) {
      return Array.from({ length: maxValue + 1 }, (_, i) => i);
    }
    const step = Math.max(1, Math.ceil(maxValue / 4));
    const ticks = [0];
    for (let v = step; v < maxValue; v += step) {
      ticks.push(v);
    }
    if (!ticks.includes(maxValue)) {
      ticks.push(maxValue);
    }
    return ticks;
  }, [maxValue]);

  const getSourceCoords = (source: 'inat' | 'bgis' | 'ebird') => points.map((point, index) => ({
    x: toX(index),
    y: toY(point[source])
  }));

  const monthLabelsZh = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const monthNamesZhFull = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const monthLabelsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthNamesEnFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthLabels = language === 'zh' ? monthLabelsZh : monthLabelsEn;

  const hasData = points.some(point => point.inat > 0 || point.bgis > 0 || point.ebird > 0);

  const sourceConfig = {
    inat: {
      name: language === 'zh' ? 'iNaturalist 研究級' : 'iNaturalist Research Grade',
      shortName: 'iNaturalist',
      color: '#10b981',
      strokeColor: '#059669',
      bgColor: 'bg-emerald-500',
      lightBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      fillId: 'inatGradient',
      total: totalInat,
      isLoading: false
    },
    bgis: {
      name: language === 'zh' ? 'HKBIH 生物資料庫' : 'HKBIH (BGIS)',
      shortName: 'HKBIH',
      color: '#0d9488',
      strokeColor: '#0f766e',
      bgColor: 'bg-teal-500',
      lightBg: 'bg-teal-50 text-teal-700 border-teal-200',
      fillId: 'bgisGradient',
      total: totalBgis,
      isLoading: isBgisLoading
    },
    ebird: {
      name: language === 'zh' ? 'eBird 鳥類紀錄' : 'eBird Observations',
      shortName: 'eBird',
      color: '#0284c7',
      strokeColor: '#0369a1',
      bgColor: 'bg-sky-500',
      lightBg: 'bg-sky-50 text-sky-700 border-sky-200',
      fillId: 'ebirdGradient',
      total: totalEbird,
      isLoading: isEbirdLoading
    }
  };

  const getHoverLabel = (index: number) => {
    if (mode === 'seasonality') {
      return language === 'zh' ? `${monthNamesZhFull[index]} (${monthLabelsEn[index]})` : monthNamesEnFull[index];
    }
    return language === 'zh' ? `${points[index]?.label} 年` : points[index]?.label;
  };

  const hoveredPoint = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;
  const hoveredTotal = hoveredPoint
    ? (activeSources.has('inat') ? hoveredPoint.inat : 0) +
      (activeSources.has('bgis') ? hoveredPoint.bgis : 0) +
      (isBirdGroup && activeSources.has('ebird') ? hoveredPoint.ebird : 0)
    : 0;

  return (
    <section className="relative overflow-hidden rounded-[2.5rem] border border-slate-200/90 bg-white shadow-sm transition-all hover:shadow-md">
      {/* Top Banner & Header */}
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-emerald-50/30 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-3.5">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-100/50 flex items-center justify-center text-emerald-600 shrink-0 shadow-xs">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  {language === 'zh' ? '時序與物種觀測趨勢' : 'Temporal Observation Trends'}
                </h3>
                {hasData && (
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-100/70 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                    <Activity className="h-3 w-3 text-emerald-600 animate-pulse" />
                    {totalActive.toLocaleString()} {language === 'zh' ? '筆記錄' : 'records'}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                {mode === 'seasonality'
                  ? (language === 'zh' ? '按月份統計之歷史累積觀測頻率分布' : 'Monthly cumulative seasonal frequency distribution')
                  : (language === 'zh' ? '按年份統計之物種年度觀測歷史趨勢' : 'Annual historical trend across recorded years')}
              </p>
            </div>
          </div>

          {/* Mode Switcher (Desktop) */}
          <div className="hidden sm:flex self-start sm:self-auto rounded-2xl border border-slate-200/80 bg-slate-100/90 p-1 shadow-inner">
            {(['seasonality', 'history'] as const).map(chartMode => {
              const isActive = mode === chartMode;
              return (
                <button
                  key={chartMode}
                  type="button"
                  onClick={() => {
                    setMode(chartMode);
                    setHoveredIndex(null);
                  }}
                  className={`relative flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-black transition-all cursor-pointer ${
                    isActive ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {chartMode === 'seasonality' ? (
                    <>
                      <Calendar className="h-3.5 w-3.5" />
                      {language === 'zh' ? '季節月份' : 'Seasonality'}
                    </>
                  ) : (
                    <>
                      <BarChart3 className="h-3.5 w-3.5" />
                      {language === 'zh' ? '歷年趨勢' : 'History'}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Dataset Legend & Peak Badge */}
        <div className="mt-3.5 sm:mt-4 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 pt-1 sm:pt-2">
          {/* Mobile Controls: Mode Dropdown + Dataset Filter Dropdown */}
          <div className="sm:hidden flex flex-wrap items-center gap-2">
            {/* Mode Filter Dropdown */}
            <div className="relative" ref={modeDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setIsModeDropdownOpen(!isModeDropdownOpen);
                  setIsFilterDropdownOpen(false);
                }}
                className="h-[34px] bg-white border border-slate-200/90 shadow-2xs rounded-2xl px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer active:scale-95 transition-all"
              >
                {mode === 'seasonality' ? (
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span className="text-[11px] font-bold">
                  {mode === 'seasonality'
                    ? (language === 'zh' ? '季節月份' : 'Seasonality')
                    : (language === 'zh' ? '歷年趨勢' : 'History')}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isModeDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isModeDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-10 left-0 w-40 bg-white/95 backdrop-blur-xl border border-slate-200 shadow-xl rounded-2xl p-1.5 flex flex-col gap-1 z-50"
                  >
                    {(['seasonality', 'history'] as const).map(chartMode => {
                      const isSelected = mode === chartMode;
                      return (
                        <button
                          key={chartMode}
                          type="button"
                          onClick={() => {
                            setMode(chartMode);
                            setHoveredIndex(null);
                            setIsModeDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-50 text-emerald-800 font-black'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {chartMode === 'seasonality' ? (
                              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                            <span>
                              {chartMode === 'seasonality'
                                ? (language === 'zh' ? '季節月份' : 'Seasonality')
                                : (language === 'zh' ? '歷年趨勢' : 'History')}
                            </span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Dataset Filter Dropdown */}
            <div className="relative" ref={filterDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setIsFilterDropdownOpen(!isFilterDropdownOpen);
                  setIsModeDropdownOpen(false);
                }}
                className="h-[34px] bg-white border border-slate-200/90 shadow-2xs rounded-2xl px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer active:scale-95 transition-all"
              >
                <Filter className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[11px] font-bold">
                  {selectedSourcesSummary}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

            <AnimatePresence>
              {isFilterDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-10 left-0 w-52 bg-white/95 backdrop-blur-xl border border-slate-200 shadow-xl rounded-2xl p-1.5 flex flex-col gap-1 z-50"
                >
                  {(['inat', 'bgis', ...(isBirdGroup ? ['ebird' as const] : [])] as const).map(src => {
                    const cfg = sourceConfig[src];
                    const isSelected = activeSources.has(src);
                    return (
                      <button
                        key={src}
                        type="button"
                        onClick={() => toggleSource(src)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? `${cfg.lightBg}`
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: isSelected ? cfg.color : '#cbd5e1' }}
                          />
                          <span className="truncate">{cfg.shortName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${isSelected ? 'bg-white/80 shadow-2xs' : 'bg-slate-100 text-slate-400'}`}>
                            {cfg.isLoading ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin text-slate-400" />
                            ) : (
                              cfg.total.toLocaleString()
                            )}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: cfg.strokeColor }} />}
                        </div>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

          {/* Desktop Filter Pills */}
          <div className="hidden sm:flex flex-wrap items-center gap-2">
            {(['inat', 'bgis', ...(isBirdGroup ? ['ebird' as const] : [])] as const).map(src => {
              const cfg = sourceConfig[src];
              const isSelected = activeSources.has(src);
              return (
                <button
                  key={src}
                  type="button"
                  onClick={() => toggleSource(src)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-black transition-all cursor-pointer select-none ${
                    isSelected
                      ? `${cfg.lightBg} shadow-xs`
                      : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60 hover:opacity-100'
                  }`}
                  title={language === 'zh' ? '點擊切換顯示/隱藏' : 'Click to toggle line'}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full transition-transform"
                    style={{ backgroundColor: isSelected ? cfg.color : '#94a3b8' }}
                  />
                  <span>{cfg.shortName}</span>
                  <span className={`inline-flex items-center justify-center min-w-[20px] text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isSelected ? 'bg-white/80 shadow-2xs' : 'bg-slate-200 text-slate-500'}`}>
                    {cfg.isLoading ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin text-slate-400" />
                    ) : (
                      cfg.total.toLocaleString()
                    )}
                  </span>
                  {isSelected ? (
                    <Eye className="h-3 w-3 opacity-60" />
                  ) : (
                    <EyeOff className="h-3 w-3 opacity-40" />
                  )}
                </button>
              );
            })}
          </div>

          {peakIndex !== -1 && peakValue > 0 && (
            <div className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200/80 px-2.5 py-1 text-[11px] font-bold text-amber-900">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              <span>
                {language === 'zh'
                  ? '觀測高峰期：'
                  : (mode === 'seasonality' ? 'Peak Season: ' : 'Peak Year: ')}
                <strong className="font-black text-amber-950">
                  {mode === 'seasonality'
                    ? (language === 'zh' ? monthLabelsZh[peakIndex] : monthNamesEnFull[peakIndex])
                    : (language === 'zh' ? `${points[peakIndex]?.label} 年` : points[peakIndex]?.label)}
                </strong>
                {' '}({peakValue} {language === 'zh' ? '筆' : 'obs'})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Chart Body Area */}
      <div className="relative p-2.5 sm:p-6" ref={containerRef}>
        {(isBgisLoading && isEbirdLoading) && !hasData && observations.length === 0 ? (
          <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-sm font-semibold text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            <span>{language === 'zh' ? '正在載入分佈趨勢資料...' : 'Loading trend data...'}</span>
          </div>
        ) : !hasData ? (
          <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-sm font-semibold text-slate-400">
            <Info className="h-6 w-6 text-slate-300" />
            <span>{language === 'zh' ? '目前尚無此物種的時間記錄資料' : 'No observation date data available for this species'}</span>
          </div>
        ) : (
          <div className={`relative w-full select-none ${points.length > 15 ? 'overflow-x-auto' : 'overflow-visible'}`}>
            {/* SVG Chart */}
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className={`h-auto w-full ${points.length > 15 ? 'min-w-[500px]' : 'min-w-0'} overflow-visible`}
              role="img"
              aria-label={mode === 'seasonality' ? 'Observation seasonality chart' : 'Observation history chart'}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <defs>
                <linearGradient id="inatGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="bgisGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#0d9488" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="ebirdGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                </linearGradient>
                <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.15" />
                </filter>
              </defs>

              {/* Background Grid Lines & Y-Axis Scale */}
              {yTicks.map(val => {
                const y = toY(val);
                return (
                  <g key={val} className="transition-opacity">
                    <line
                      x1={padding.left}
                      x2={chartWidth - padding.right}
                      y1={y}
                      y2={y}
                      stroke="#f1f5f9"
                      strokeWidth="1.2"
                      strokeDasharray={val === 0 ? 'none' : '4 4'}
                    />
                    <text
                      x={padding.left - 10}
                      y={y + 3.5}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-bold font-mono tracking-tight"
                    >
                      {val.toLocaleString()}
                    </text>
                  </g>
                );
              })}

              {/* Hover Column Highlight Band */}
              {hoveredIndex !== null && (
                <rect
                  x={toX(hoveredIndex) - (points.length > 1 ? plotWidth / (points.length - 1) / 2 : plotWidth / 2)}
                  y={padding.top - 6}
                  width={points.length > 1 ? plotWidth / (points.length - 1) : plotWidth}
                  height={plotHeight + 12}
                  fill="#f8fafc"
                  rx="8"
                  className="pointer-events-none transition-all"
                />
              )}

              {/* Active Area Gradients */}
              {visibleSources.map(source => {
                const coords = getSourceCoords(source);
                const cfg = sourceConfig[source];
                return (
                  <path
                    key={`area-${source}`}
                    d={getMonotoneAreaPath(coords, baseY, padding.top)}
                    fill={`url(#${cfg.fillId})`}
                    className="pointer-events-none transition-opacity duration-300"
                  />
                );
              })}

              {/* Spline Stroke Lines */}
              {visibleSources.map(source => {
                const coords = getSourceCoords(source);
                const cfg = sourceConfig[source];
                return (
                  <path
                    key={`line-${source}`}
                    d={getMonotoneSplinePath(coords, baseY, padding.top)}
                    fill="none"
                    stroke={cfg.color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#shadow)"
                    className="pointer-events-none transition-all duration-200"
                  />
                );
              })}

              {/* Vertical Crosshair Line on Hover */}
              {hoveredIndex !== null && (
                <line
                  x1={toX(hoveredIndex)}
                  x2={toX(hoveredIndex)}
                  y1={padding.top}
                  y2={baseY}
                  stroke="#64748b"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  className="pointer-events-none"
                />
              )}
              {/* Data Point Markers on Curve */}
              {points.map((point, index) => {
                const isHovered = hoveredIndex === index;
                const isPeak = index === peakIndex;
                const x = toX(index);

                return (
                  <g key={`points-${index}`} className="pointer-events-none">
                    {visibleSources.map(source => {
                      const y = toY(point[source]);
                      const cfg = sourceConfig[source];
                      const val = point[source];
                      if (val === 0 && !isHovered) return null;

                      return (
                        <circle
                          key={`pt-${source}-${index}`}
                          cx={x}
                          cy={y}
                          r={isHovered ? 5.5 : isPeak ? 4 : 3}
                          fill="#ffffff"
                          stroke={cfg.color}
                          strokeWidth={isHovered ? 3 : 2}
                          className="transition-all duration-150"
                        />
                      );
                    })}
                  </g>
                );
              })}

              {/* X-Axis Labels */}
              {points.map((point, index) => {
                const isHovered = hoveredIndex === index;
                const isPeak = index === peakIndex;
                const x = toX(index);
                const label = mode === 'seasonality' ? monthLabels[index] : point.label;

                const shouldShowLabel = points.length <= 16 || index % 2 === 0 || isHovered || isPeak;

                if (!shouldShowLabel) return null;

                return (
                  <text
                    key={`label-${point.label}-${index}`}
                    x={x}
                    y={chartHeight - 12}
                    textAnchor="middle"
                    className={`text-[11px] font-bold font-mono transition-all duration-150 pointer-events-none ${
                      isHovered
                        ? 'fill-emerald-700 font-black text-[12px]'
                        : isPeak
                          ? 'fill-amber-700 font-black'
                          : 'fill-slate-500'
                    }`}
                  >
                    {label}
                  </text>
                );
              })}

              {/* Invisible Interactive Hit-Test Columns */}
              {points.map((_, index) => {
                const x = toX(index);
                const colWidth = points.length > 1 ? plotWidth / (points.length - 1) : plotWidth;
                return (
                  <rect
                    key={`hitbox-${index}`}
                    x={Math.max(padding.left, x - colWidth / 2)}
                    y={padding.top - 10}
                    width={colWidth}
                    height={plotHeight + 35}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onTouchStart={() => setHoveredIndex(index)}
                  />
                );
              })}
            </svg>

            {/* Floating Tooltip Box */}
            <AnimatePresence>
              {hoveredIndex !== null && hoveredPoint && (() => {
                const xPercent = (toX(hoveredIndex) / chartWidth) * 100;
                const isRightSide = hoveredIndex > points.length * 0.55 || xPercent > 55;
                const isLeftSide = hoveredIndex < points.length * 0.25 || xPercent < 25;

                const styleProps: React.CSSProperties = isRightSide
                  ? { right: `${Math.max(2, 100 - xPercent)}%`, top: '12px' }
                  : { left: `${Math.max(2, xPercent)}%`, top: '12px' };

                const xOffset = isRightSide ? -14 : isLeftSide ? 14 : '-50%';

                return (
                  <motion.div
                    key="chart-tooltip"
                    initial={{ opacity: 0, y: 6, x: xOffset, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, x: xOffset, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    style={styleProps}
                    className="pointer-events-none absolute z-30 min-w-[145px] sm:min-w-[195px] rounded-2xl border border-slate-200/90 bg-white/95 p-2 sm:p-3 shadow-xl backdrop-blur-md"
                  >
                    {/* Tooltip Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1.5">
                      <div className="flex items-center gap-1 font-black text-slate-900 text-[11px] sm:text-xs">
                        <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-600" />
                        <span>{getHoverLabel(hoveredIndex)}</span>
                      </div>
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.2 text-[9px] sm:text-[10px] font-black text-slate-700">
                        {hoveredTotal.toLocaleString()} {language === 'zh' ? '筆' : 'total'}
                      </span>
                    </div>

                    {/* Tooltip Data Breakdown */}
                    <div className="space-y-1 sm:space-y-1.5 text-xs">
                      {visibleSources.map(src => {
                        const cfg = sourceConfig[src];
                        const val = hoveredPoint[src] || 0;
                        const pct = hoveredTotal > 0 ? Math.round((val / hoveredTotal) * 100) : 0;

                        return (
                          <div key={`tt-${src}`} className="flex items-center justify-between gap-2 sm:gap-3">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full shadow-2xs shrink-0"
                                style={{ backgroundColor: cfg.color }}
                              />
                              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 truncate">
                                {cfg.shortName}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="font-mono font-black text-slate-900 text-[11px] sm:text-[12px]">
                                {cfg.isLoading ? (
                                  <Loader2 className="h-2.5 w-2.5 animate-spin text-slate-400 inline-block" />
                                ) : (
                                  val.toLocaleString()
                                )}
                              </span>
                              {!cfg.isLoading && (
                                <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium">
                                  ({pct}%)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Peak Marker Badge in Tooltip */}
                    {hoveredIndex === peakIndex && peakValue > 0 && (
                      <div className="mt-1.5 sm:mt-2.5 flex items-center gap-1 rounded-lg bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-amber-700">
                        <Sparkles className="h-3 w-3 text-amber-600 shrink-0" />
                        <span>{language === 'zh' ? '全時期最高觀測量' : 'Peak observation period'}</span>
                      </div>
                    )}
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}

const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY || '';
const CARTO_KEY_PARAM = CARTO_API_KEY ? `?key=${CARTO_API_KEY}` : '';

const MAP_SOURCES = {
  osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  esri: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  cartoLight: `https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png${CARTO_KEY_PARAM}`,
  cartoDark: `https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png${CARTO_KEY_PARAM}`,
  googleStreets: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
  googleSatellite: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
  googleHybrid: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
  googleTerrain: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
  hkImagery: 'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/imagery/wgs84/{z}/{x}/{y}.png',
  hkVector: 'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/basemap/wgs84/{z}/{x}/{y}.png',
  hkLabel: 'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/label/hk/en/wgs84/{z}/{x}/{y}.png'
};

const createRasterStyle = (sources: { id: string, tiles: string[], attribution?: string }[]) => ({
  version: 8,
  sources: sources.reduce((acc, s) => ({
    ...acc,
    [s.id]: {
      type: 'raster',
      tiles: s.tiles,
      tileSize: 256,
      attribution: s.attribution || ''
    }
  }), {}),
  layers: sources.map(s => ({
    id: s.id,
    type: 'raster',
    source: s.id,
    minzoom: 0,
    maxzoom: 20
  }))
});

const BASEMAPS = [
  {
    id: 'carto-light',
    name: { zh: 'Carto 亮色', en: 'Carto Light' },
    preview: `https://a.basemaps.cartocdn.com/light_all/13/6694/3574.png${CARTO_KEY_PARAM}`,
    attributionText: '© CARTO | MapLibre',
    style: createRasterStyle([{ id: 'carto-light', tiles: [MAP_SOURCES.cartoLight], attribution: '&copy; CARTO' }])
  },
  {
    id: 'carto-dark',
    name: { zh: 'Carto 深色', en: 'Carto Dark' },
    preview: `https://a.basemaps.cartocdn.com/dark_all/13/6694/3574.png${CARTO_KEY_PARAM}`,
    attributionText: '© CARTO | MapLibre',
    style: createRasterStyle([{ id: 'carto-dark', tiles: [MAP_SOURCES.cartoDark], attribution: '&copy; CARTO' }])
  },
  {
    id: 'osm',
    name: { zh: 'OpenStreetMap', en: 'OpenStreetMap' },
    preview: 'https://tile.openstreetmap.org/13/6694/3574.png',
    attributionText: '© OpenStreetMap | MapLibre',
    style: createRasterStyle([{ id: 'osm', tiles: [MAP_SOURCES.osm], attribution: '&copy; OSM' }])
  },
  {
    id: 'esri-sat',
    name: { zh: 'Esri 衛星圖', en: 'Esri Satellite' },
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/3574/6694',
    attributionText: '© Esri | MapLibre',
    style: createRasterStyle([{ id: 'esri-sat', tiles: [MAP_SOURCES.esri], attribution: '&copy; Esri' }])
  },
  {
    id: 'google-streets',
    name: { zh: 'Google 街道', en: 'Google Streets' },
    preview: 'https://mt1.google.com/vt/lyrs=m&x=6694&y=3574&z=13',
    attributionText: '© Google Maps | MapLibre',
    style: createRasterStyle([{ id: 'google-streets', tiles: [MAP_SOURCES.googleStreets], attribution: '&copy; Google' }])
  },
  {
    id: 'google-sat',
    name: { zh: 'Google 衛星', en: 'Google Satellite' },
    preview: 'https://mt1.google.com/vt/lyrs=s&x=6694&y=3574&z=13',
    attributionText: '© Google Maps | MapLibre',
    style: createRasterStyle([{ id: 'google-sat', tiles: [MAP_SOURCES.googleSatellite], attribution: '&copy; Google' }])
  },
  {
    id: 'google-hybrid',
    name: { zh: 'Google 混合', en: 'Google Hybrid' },
    preview: 'https://mt1.google.com/vt/lyrs=y&x=6694&y=3574&z=13',
    attributionText: '© Google Maps | MapLibre',
    style: createRasterStyle([{ id: 'google-hybrid', tiles: [MAP_SOURCES.googleHybrid], attribution: '&copy; Google' }])
  },
  {
    id: 'google-terrain',
    name: { zh: 'Google 地形', en: 'Google Terrain' },
    preview: 'https://mt1.google.com/vt/lyrs=p&x=6694&y=3574&z=13',
    attributionText: '© Google Maps | MapLibre',
    style: createRasterStyle([{ id: 'google-terrain', tiles: [MAP_SOURCES.googleTerrain], attribution: '&copy; Google' }])
  },
  {
    id: 'hk-vector', name: { zh: '香港政府向量', en: 'HK Vector' },
    preview: `https://a.basemaps.cartocdn.com/light_all/13/6694/3574.png${CARTO_KEY_PARAM}`,
    attributionText: '© Lands Department (HKSAR) | MapLibre',
    style: createRasterStyle([
      { id: 'hk-vector-base', tiles: [MAP_SOURCES.hkVector], attribution: '&copy; HKSAR' },
      { id: 'hk-vector-label', tiles: [MAP_SOURCES.hkLabel], attribution: '' }
    ])
  },
  {
    id: 'hk-imagery', name: { zh: '香港政府影像', en: 'HK Imagery' },
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/3574/6694',
    attributionText: '© Lands Department (HKSAR) | MapLibre',
    style: createRasterStyle([
      { id: 'hk-imagery-base', tiles: [MAP_SOURCES.hkImagery], attribution: '&copy; HKSAR' },
      { id: 'hk-imagery-label', tiles: [MAP_SOURCES.hkLabel], attribution: '' }
    ])
  },
];

const translations = {
  zh: {
    loadingTitle: '正在獲取分布數據',
    loadingDesc: '按數據源分步下載與處理數據...',
    stageInat: 'iNaturalist 研究級數據',
    stageBgis: 'BGIS / HKBIH 地理資訊',
    stageEbird: 'eBird 觀察記錄',
    stageGrid: '空間網格對齊與整合',
    statusPending: '等待中',
    statusLoading: '載入中...',
    statusDone: '已完成',
    statusSkipped: '未適用',
    obsLoaded: '已載入',
    obsUnit: '筆觀測記錄',
    densityTitle: '觀測密度 (Grid)',
    gridId: '網格',
    totalObs: '共發現',
    totalObsUnit: '筆觀測記錄',
    obsBy: '觀測者',
    viewDetails: '查看詳情',
    researchGrade: 'iNaturalist 研究級數據',
    noInatId: '無 iNaturalist ID',
    mapReady: '正在準備地圖渲染引擎...',
    tooltipObs: '筆觀測',
    basemapTitle: '底圖切換',
    layers: '圖層',
    bgisTitle: 'BGIS/HKBIH',
    bgisTotal: '共',
    recordsUnit: '筆',
    inatSectionTitle: 'iNaturalist 研究級數據',
    datasetFilterLabel: '資料來源',
    filterInat: 'iNaturalist',
    filterBgis: 'BGIS / HKBIH',
    filterEbird: 'eBird',
    ebirdSectionTitle: 'eBird 觀察記錄數據',
    ebirdLocationUnit: '個觀測點',
    creditTitle: 'BGIS / HKBIH 資料來源與條款聲明',
    dataSourceLabel: '資料來源：',
    dataSourceText: '香港特別行政區政府漁農自然護理署；香港生物多樣性資訊站 - 生物多樣性地理信息系統',
    ipOwnerLabel: '資料的知識產權擁有人：',
    ipOwnerText: '香港特別行政區政府漁農自然護理署',
    websiteLabel: '官方網站連結：',
    termsTitle: '根據 BGIS 條款及細則第 3 條使用：',
    termsSub: '你可免費瀏覽、下載、分發、複製和列印有關資料，以及為有關資料建立超連結，作非商業用途，惟須遵守以下條件：',
    term1: '你必須遵守本使用條款；',
    term2: '你必須在有關資料及其所有複製本(包括但不限於紙張複製本、數碼複製本及載於其他網站的複製本)上清楚註明政府及BGIS/HKBIH為資料來源並確認政府及有關機構為該等資料的知識產權擁有人；以及',
    term3: '你必須就因你直接或間接使用、複製及／或分發有關資料而引起任何有關侵犯他人權利的指稱或申索，以及政府及有關機構所涉及的費用、損失、損害及法律責任，向政府及有關機構作出彌償。',
    close: '關閉'
  },
  en: {
    loadingTitle: 'Fetching Distribution Data',
    loadingDesc: 'Fetching data step-by-step from sources...',
    stageInat: 'iNaturalist Research Grade Data',
    stageBgis: 'BGIS / HKBIH Geographic Information',
    stageEbird: 'eBird Observation Records',
    stageGrid: 'Spatial Grid Alignment & Aggregation',
    statusPending: 'Pending',
    statusLoading: 'Loading...',
    statusDone: 'Completed',
    statusSkipped: 'N/A',
    obsLoaded: 'Loaded',
    obsUnit: 'observations',
    densityTitle: 'Observation Density',
    gridId: 'Grid',
    totalObs: 'Total',
    totalObsUnit: 'observations found',
    obsBy: 'Observer',
    viewDetails: 'View Details',
    researchGrade: 'iNaturalist Research Grade Data',
    noInatId: 'No iNaturalist ID',
    mapReady: 'Preparing map engine...',
    tooltipObs: 'observations',
    basemapTitle: 'Basemap',
    layers: 'Layers',
    bgisTitle: 'BGIS/HKBIH',
    bgisTotal: 'Total',
    recordsUnit: 'obs',
    inatSectionTitle: 'iNaturalist Research Grade Data',
    datasetFilterLabel: 'Data Sources',
    filterInat: 'iNaturalist',
    filterBgis: 'BGIS / HKBIH',
    filterEbird: 'eBird',
    ebirdSectionTitle: 'eBird Observation Data',
    ebirdLocationUnit: 'location',
    creditTitle: 'BGIS / HKBIH Data Attribution & Terms',
    dataSourceLabel: 'Data Source:',
    dataSourceText: 'Agriculture, Fisheries and Conservation Department, The Government of the Hong Kong Special Administrative Region; Hong Kong Biodiversity Information Hub - Biodiversity Geographic Information System',
    ipOwnerLabel: 'Intellectual Property Rights Owner:',
    ipOwnerText: 'Agriculture, Fisheries and Conservation Department, The Government of the Hong Kong Special Administrative Region',
    websiteLabel: 'Official Website Link:',
    termsTitle: 'Used under Clause 3 of BGIS Terms of Use:',
    termsSub: 'You are allowed to browse, export reports, distribute, reproduce, hyperlink to and print the Data for non-commercial purposes on a free-of charge basis under the condition that:',
    term1: 'you shall comply with the Terms of Use;',
    term2: 'you shall identify clearly the Government and the BGIS/HKBIH as the source of the Data and acknowledge the Government and the relevant organisations\' ownership of the intellectual property rights in the Data and in all copies thereof including but not limited to paper copies, digital copies and copies placed on other websites; and',
    term3: 'you shall indemnify the Government and the relevant organisations against any allegations or claims of infringement of the rights of any person and all costs, losses, damages and liabilities incurred by the Government and the relevant organisations, which arise directly or indirectly in relation to your use, reproduction and/or distribution of the Data.',
    close: 'Close'
  }
};

// Component for rendering eBird observations grouped by Year with collapsible sections
function EbirdYearGroupList({
  sortedYears,
  groupsByYear,
  language
}: {
  sortedYears: string[];
  groupsByYear: Record<string, EbirdLocInfo[]>;
  language: string;
}) {
  // Store open/close status of each year. Default open the latest (first) year.
  const [openYears, setOpenYears] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    sortedYears.forEach((yr, idx) => {
      initialState[yr] = idx === 0; // 最新 (第0項) 設為 true (open), 其餘 false (collapse)
    });
    return initialState;
  });

  const toggleYear = (year: string) => {
    setOpenYears(prev => ({
      ...prev,
      [year]: !prev[year]
    }));
  };

  return (
    <div className="space-y-2 pt-1">
      {sortedYears.map((year) => {
        const records = groupsByYear[year];
        const isOpen = !!openYears[year];

        return (
          <div
            key={year}
            className="border border-emerald-200/80 rounded-2xl overflow-hidden bg-white/90 shadow-2xs transition-all"
          >
            {/* Year Collapsible Header */}
            <button
              type="button"
              onClick={() => toggleYear(year)}
              className="w-full flex items-center justify-between px-3 py-2 bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-950 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <span className="font-black text-xs text-emerald-950 tracking-tight">
                  {year} {language === 'zh' ? '年' : ''}
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-200">
                  {records.length} {language === 'zh' ? '筆記錄' : (records.length === 1 ? 'record' : 'records')}
                </span>
              </div>

              <div className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-700">
                <span>{isOpen ? (language === 'zh' ? '收起' : 'Collapse') : (language === 'zh' ? '展開' : 'Expand')}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-emerald-700 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Collapsible Content */}
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-2 space-y-2 bg-slate-50/50">
                    {records.map((info, idx) => (
                      <div
                        key={`${info.subID}-${idx}`}
                        className="bg-white border border-emerald-100/80 rounded-xl p-2.5 space-y-1.5 shadow-2xs hover:border-emerald-300 transition-colors"
                      >
                        {/* Date + Count row */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
                            <Calendar className="w-3 h-3 text-emerald-600" />
                            <span>{info.obsDt}</span>
                          </div>
                          <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                            ×{info.howMany}
                          </span>
                        </div>

                        {/* Observer */}
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="font-medium">{info.userDisplayName}</span>
                        </div>

                        {/* Evidence badge */}
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wide border ${info.evidence === 'P'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : info.evidence === 'A'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : info.evidence === 'V'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                          >
                            {getEbirdEvidenceLabel(info.evidence, language === 'zh' ? 'zh' : 'en')}
                          </span>
                          <a
                            href={`https://ebird.org/checklist/${info.subID}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-emerald-700 hover:underline font-mono"
                          >
                            {info.subID}
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export default function SpeciesMap({ taxonId, scientificName, chineseName, taxaGroup, ebirdSpeciesCode }: SpeciesMapProps) {
  const { language } = useLanguage();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const t = translations[language === 'zh' ? 'zh' : 'en'];

  const isBirdGroup = String(taxaGroup || '').trim().toUpperCase() === 'BIRD';

  const getRecordUnit = (count: number) => {
    if (language === 'zh') return '筆';
    return count === 1 ? 'record' : 'records';
  };

  type StepStatus = 'idle' | 'loading' | 'done' | 'skipped';

  const [observations, setObservations] = useState<InatObservation[]>([]);
  const [totalBgisCount, setTotalBgisCount] = useState<number>(0);
  const [ebirdRecords, setEbirdRecords] = useState<EbirdRecord[]>([]);
  const [showInat, setShowInat] = useState(true);
  const [showBgis, setShowBgis] = useState(true);
  const [showEbird, setShowEbird] = useState(true);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [allProcessedFeatures, setAllProcessedFeatures] = useState<any[]>([]);
  const [gridData, setGridData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const [inatStatus, setInatStatus] = useState<StepStatus>('idle');
  const [bgisStatus, setBgisStatus] = useState<StepStatus>('idle');
  const [ebirdStatus, setEbirdStatus] = useState<StepStatus>('idle');
  const [gridStatus, setGridStatus] = useState<StepStatus>('idle');
  const [stageCounts, setStageCounts] = useState<{ inat: number; bgis: number; ebird: number }>({ inat: 0, bgis: 0, ebird: 0 });

  const [selectedGrid, setSelectedGrid] = useState<GridFeatureProperties | null>(null);
  const [hoveredGrid, setHoveredGrid] = useState<{ id: string, count: number, bgisCount?: number, ebirdCount?: number, x: number, y: number } | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [cursorStyle, setCursorStyle] = useState<string>('auto');
  const [currentStyleId, setCurrentStyleId] = useState('carto-light');
  const [isBasemapPanelOpen, setIsBasemapPanelOpen] = useState(false);
  const [isBgisCreditOpen, setIsBgisCreditOpen] = useState(false);
  const [showAttribution, setShowAttribution] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const attributionRef = useRef<HTMLDivElement>(null);

  // eBird 位置詳情狀態
  const [ebirdLocDetails, setEbirdLocDetails] = useState<EbirdLocInfo[]>([]);
  const [isLoadingEbirdDetail, setIsLoadingEbirdDetail] = useState(false);
  const [showEbirdDetail, setShowEbirdDetail] = useState(false);
  const [ebirdDetailError, setEbirdDetailError] = useState<string | null>(null);
  const [showEbirdCitation, setShowEbirdCitation] = useState(false);
  const [isHoveringEbirdCitation, setIsHoveringEbirdCitation] = useState(false);

  // Cache fetched eBird location details per grid ID: { [grid_id]: EbirdLocInfo[] }
  const ebirdLocCacheRef = useRef<Record<string, EbirdLocInfo[]>>({});

  // When species changes (or component unmounts), reset cache
  useEffect(() => {
    ebirdLocCacheRef.current = {};
  }, [taxonId, scientificName, chineseName, ebirdSpeciesCode]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 點擊外部隱藏 Filter 下拉選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    if (isFilterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterDropdownOpen]);

  // 點擊外部隱藏版權資訊
  useEffect(() => {
    if (!isMobile) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (attributionRef.current && !attributionRef.current.contains(event.target as Node)) {
        setShowAttribution(false);
      }
    };

    if (showAttribution) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAttribution, isMobile]);

  const currentStyle = BASEMAPS.find(m => m.id === currentStyleId)?.style || BASEMAPS[0].style;

  // 動態根據選取的 Dataset Filter (iNaturalist / BGIS / eBird) 實時更新地圖 GeoJSON 網格資料
  useEffect(() => {
    if (allProcessedFeatures.length === 0) return;

    const filteredFeatures = allProcessedFeatures
      .map(f => {
        const inatCount = showInat ? (f.properties.count || 0) : 0;
        const bgisCount = showBgis ? (f.properties.bgisCount || 0) : 0;
        const ebirdCount = (isBirdGroup && showEbird) ? (f.properties.ebirdCount || 0) : 0;
        const activeTotal = inatCount + bgisCount + ebirdCount;

        return {
          ...f,
          properties: {
            ...f.properties,
            totalCount: activeTotal
          }
        };
      })
      .filter(f => f.properties.totalCount > 0);

    setGridData({
      type: 'FeatureCollection',
      features: filteredFeatures
    });
  }, [allProcessedFeatures, showInat, showBgis, showEbird, isBirdGroup]);

  // Load independent sources concurrently, then perform the spatial join.
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setInatStatus('idle');
      setBgisStatus('idle');
      setEbirdStatus('idle');
      setGridStatus('idle');
      setStageCounts({ inat: 0, bgis: 0, ebird: 0 });
      setProgress({ current: 0, total: 0 });

      console.log('SpeciesMap: 啟動分步載入程序...', { taxonId, scientificName, chineseName, ebirdSpeciesCode, isBirdGroup });

      try {
        const speciesDataKey = getSpeciesDataKey({ taxonId, scientificName, chineseName, taxaGroup, ebirdSpeciesCode });
        const cachedData = speciesMapCache[speciesDataKey];
        if (cachedData) {
          setObservations(cachedData.observations);
          setEbirdRecords(cachedData.ebirdRecords);
          setTotalBgisCount(cachedData.totalBgisCount);
          setStageCounts({
            inat: cachedData.observations.length,
            bgis: cachedData.totalBgisCount,
            ebird: cachedData.ebirdRecords.length
          });
          setInatStatus(taxonId && taxonId > 0 ? 'done' : 'skipped');
          setBgisStatus(scientificName || chineseName ? 'done' : 'skipped');
          setEbirdStatus(isBirdGroup && ebirdSpeciesCode ? 'done' : 'skipped');
          setGridStatus('done');
          setAllProcessedFeatures(cachedData.processedFeatures);
          setIsLoading(false);
          return;
        }

        const inatPromise = taxonId && taxonId > 0
          ? (setInatStatus('loading'), fetchAllInatObservations(taxonId, (current, total) => {
            setProgress({ current, total });
          }))
          : Promise.resolve([] as InatObservation[]);

        const bgisPromise = scientificName || chineseName
          ? (setBgisStatus('loading'), fetchBgisSpeciesList(scientificName || '', chineseName))
          : Promise.resolve([] as BgisGridRecord[]);

        const ebirdPromise = isBirdGroup && ebirdSpeciesCode
          ? (setEbirdStatus('loading'), fetchEbirdMapPoints(ebirdSpeciesCode))
          : Promise.resolve([] as EbirdRecord[]);

        const geoJsonPromise = fetch('/data/Common_1km_grid.geojson');
        const [obs, bgisList, ebirdPts, response] = await Promise.all([
          inatPromise,
          bgisPromise,
          ebirdPromise,
          geoJsonPromise
        ]);

        if (taxonId && taxonId > 0) {
          setInatStatus('done');
          setObservations(obs);
          setStageCounts(prev => ({ ...prev, inat: obs.length }));
        } else {
          setInatStatus('skipped');
        }

        const bgisMap: Record<string, BgisGridRecord> = {};
        let realBgisTotal = 0;

        if (scientificName || chineseName) {
          setBgisStatus('done');

          bgisList.forEach(item => {
            if (item.no !== undefined && item.no !== null) {
              const rawNoStr = String(item.no);
              const cleanNo = isNaN(Number(rawNoStr)) ? rawNoStr : String(parseFloat(rawNoStr));
              bgisMap[cleanNo] = item;
              realBgisTotal += (item.count || 0);
            }
          });
          setTotalBgisCount(realBgisTotal);
          setStageCounts(prev => ({ ...prev, bgis: realBgisTotal }));
        } else {
          setBgisStatus('skipped');
        }

        if (isBirdGroup && ebirdSpeciesCode) {
          setEbirdStatus('done');
          setEbirdRecords(ebirdPts);
          setStageCounts(prev => ({ ...prev, ebird: ebirdPts.length }));
        } else {
          setEbirdStatus('skipped');
        }

        setGridStatus('loading');
        if (!response.ok) {
          console.error('SpeciesMap: 無法下載 GeoJSON:', response.status, response.statusText);
          setGridStatus('done');
          return;
        }
        const geojson = await response.json();

        let totalInatCounted = 0;
        let totalBgisCounted = 0;
        let totalEbirdCounted = 0;

        // 建構 iNat 點位
        const obsPoints = obs.map((o) => {
          if (!o.location) return null;
          const parts = o.location.split(',').map(Number);
          if (parts.length < 2) return null;
          const [lat, lng] = parts;
          return turf.point([lng, lat], { ...o });
        }).filter(Boolean) as any;

        // 建構 eBird 點位
        const ebirdTurfPoints = ebirdPts.map((eb) => {
          if (eb.x === undefined || eb.y === undefined) return null;
          return turf.point([eb.x, eb.y], { ...eb });
        }).filter(Boolean) as any;

        // 遍歷所有網格並匹配兩者與 eBird 數據
        geojson.features.forEach((feature: any, idx: number) => {
          const rawId = feature.properties?.grid_no ?? feature.properties?.grid_id;
          const cleanId = rawId !== undefined && rawId !== null
            ? (isNaN(Number(rawId)) ? String(rawId) : String(parseFloat(String(rawId))))
            : String(idx + 1);

          feature.properties.grid_id = cleanId;
          feature.properties.grid_no = cleanId;

          // 1. iNaturalist 點位匹配
          const ptsInPoly = obsPoints.filter((pt: any) =>
            turf.booleanPointInPolygon(pt, feature)
          );
          feature.properties.count = ptsInPoly.length;
          feature.properties.observations = ptsInPoly.map((p: any) => p.properties);
          totalInatCounted += ptsInPoly.length;

          // 2. BGIS 數據匹配
          const bgisRecord = bgisMap[cleanId];
          if (bgisRecord) {
            feature.properties.bgisCount = bgisRecord.count;
            feature.properties.bgisDataset = bgisRecord.dataset;
            totalBgisCounted += bgisRecord.count;
          } else {
            feature.properties.bgisCount = 0;
            feature.properties.bgisDataset = [];
          }

          // 3. eBird 點位匹配
          const ebirdPtsInPoly = ebirdTurfPoints.filter((pt: any) =>
            turf.booleanPointInPolygon(pt, feature)
          );
          feature.properties.ebirdCount = ebirdPtsInPoly.length;
          feature.properties.ebirdRecords = ebirdPtsInPoly.map((p: any) => p.properties);
          totalEbirdCounted += ebirdPtsInPoly.length;

          // 綜合計數
          feature.properties.totalCount = feature.properties.count + feature.properties.bgisCount + feature.properties.ebirdCount;
        });

        console.log(`SpeciesMap: 數據聚合完成 (iNat 匹配點: ${totalInatCounted}, BGIS 總紀錄: ${realBgisTotal}, eBird 匹配紀錄: ${totalEbirdCounted})`);
        setStageCounts({
          inat: obs.length,
          bgis: realBgisTotal,
          ebird: ebirdPts.length
        });
        speciesMapCache[speciesDataKey] = {
          observations: obs,
          bgisList,
          ebirdRecords: ebirdPts,
          processedFeatures: geojson.features,
          totalBgisCount: realBgisTotal
        };
        setAllProcessedFeatures(geojson.features);
        setGridStatus('done');
      } catch (error) {
        console.error('SpeciesMap: 載入或聚合過程中發生錯誤:', error);
      } finally {
        setIsLoading(false);
      }
    }

    if (taxonId || scientificName || chineseName || ebirdSpeciesCode) {
      loadData();
    }
  }, [taxonId, scientificName, chineseName, isBirdGroup, ebirdSpeciesCode]);

  const containerRef = useRef<HTMLDivElement>(null);

  const onMapClick = (event: MapLayerMouseEvent) => {
    const feature = event.features && event.features[0];
    if (feature && feature.layer.id === 'grid-layer') {
      const props = feature.properties as any;
      const obsList = typeof props.observations === 'string'
        ? JSON.parse(props.observations)
        : (props.observations || []);

      const bgisDatasetList = typeof props.bgisDataset === 'string'
        ? JSON.parse(props.bgisDataset)
        : (props.bgisDataset || []);

      const ebirdRecordList = typeof props.ebirdRecords === 'string'
        ? JSON.parse(props.ebirdRecords)
        : (props.ebirdRecords || []);

      const rawId = props.grid_no ?? props.grid_id;
      const cleanId = rawId !== undefined && rawId !== null
        ? (isNaN(Number(rawId)) ? String(rawId) : String(parseFloat(String(rawId))))
        : '';

      const count = Number(props.count || 0);
      const bgisCount = Number(props.bgisCount || 0);
      const ebirdCount = Number(props.ebirdCount || 0);

      if (count > 0 || bgisCount > 0 || ebirdCount > 0) {
        // 檢查快取是否有該網格的 eBird 詳情
        const cached = ebirdLocCacheRef.current[cleanId];
        if (cached && cached.length > 0) {
          setEbirdLocDetails(cached);
          setShowEbirdDetail(true);
        } else {
          setShowEbirdDetail(false);
          setEbirdLocDetails([]);
        }
        setEbirdDetailError(null);
        setSelectedGrid({
          grid_id: cleanId,
          grid_no: cleanId,
          count: count,
          observations: obsList,
          bgisCount: bgisCount,
          bgisDataset: bgisDatasetList,
          ebirdCount: ebirdCount,
          ebirdRecords: ebirdRecordList
        });
      }
    } else {
      setShowEbirdDetail(false);
      setEbirdLocDetails([]);
      setEbirdDetailError(null);
      setSelectedGrid(null);
    }
  };

  const onMouseMove = (event: MapLayerMouseEvent) => {
    const feature = event.features && event.features[0];
    if (feature && feature.layer.id === 'grid-layer') {
      setCursorStyle('pointer');
      const rawId = feature.properties?.grid_no ?? feature.properties?.grid_id;
      const cleanId = rawId !== undefined && rawId !== null
        ? (isNaN(Number(rawId)) ? String(rawId) : String(parseFloat(String(rawId))))
        : '';
      setHoveredGrid({
        id: cleanId,
        count: Number(feature.properties?.count || 0),
        bgisCount: Number(feature.properties?.bgisCount || 0),
        ebirdCount: Number(feature.properties?.ebirdCount || 0),
        x: event.point.x,
        y: event.point.y
      });
    } else {
      setCursorStyle('auto');
      setHoveredGrid(null);
    }
  };

  const onMouseLeave = () => {
    setCursorStyle('auto');
    setHoveredGrid(null);
  };

  return (
    <div ref={containerRef} id="map-container" className="relative w-full h-[550px] rounded-[2.5rem] overflow-hidden bg-slate-100 border border-slate-200 shadow-inner group">
      <style jsx global>{`
        .maplibregl-ctrl-top-right { margin-top: 12px; margin-right: 12px; }
        .maplibregl-ctrl-bottom-right { margin-bottom: 12px; margin-right: 12px; }
        .maplibregl-ctrl-group { border-radius: 12px !important; border: none !important; box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important; }
      `}</style>
      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center select-none"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -8 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-white/95 backdrop-blur-2xl border border-slate-200/90 shadow-2xl rounded-3xl p-5 sm:p-6 text-left space-y-4"
            >
              {/* Header */}
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-600">
                  <Sparkles className="w-5 h-5 animate-pulse text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">{t.loadingTitle}</h3>
                  <p className="text-xs font-semibold text-slate-500">{t.loadingDesc}</p>
                </div>
              </div>

              {/* Steps List */}
              <div className="space-y-2">
                {/* Step 1: iNaturalist */}
                <div className={`p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center justify-between ${inatStatus === 'loading'
                  ? 'bg-emerald-50/90 border-emerald-300 ring-2 ring-emerald-400/20 shadow-xs'
                  : inatStatus === 'done'
                    ? 'bg-emerald-50/40 border-emerald-200/60'
                    : inatStatus === 'skipped'
                      ? 'bg-slate-50 border-slate-100 opacity-50'
                      : 'bg-slate-50/60 border-slate-100 text-slate-400'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl text-xs transition-colors ${inatStatus === 'loading' ? 'bg-emerald-600 text-white shadow-xs' :
                      inatStatus === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/80 text-slate-500'
                      }`}>
                      <Camera className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-800">
                        {t.stageInat}
                      </div>
                      {inatStatus === 'loading' && (
                        <div className="text-[11px] text-emerald-700 font-bold mt-0.5 flex items-center gap-1.5">
                          <span>{progress.current} / {progress.total}</span>
                          {progress.total > 0 && (
                            <span className="text-[10px] bg-emerald-200/80 text-emerald-900 px-1.5 py-0.2 rounded-full font-black">
                              {Math.round((progress.current / progress.total) * 100)}%
                            </span>
                          )}
                        </div>
                      )}
                      {inatStatus === 'done' && (
                        <div className="text-[10px] text-emerald-800 font-extrabold mt-0.5">
                          {stageCounts.inat} {getRecordUnit(stageCounts.inat)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    {inatStatus === 'loading' && <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />}
                    {inatStatus === 'done' && <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />}
                    {inatStatus === 'skipped' && <span className="text-[10px] font-bold text-slate-400">{t.statusSkipped}</span>}
                    {inatStatus === 'idle' && <span className="text-[10px] font-bold text-slate-400">{t.statusPending}</span>}
                  </div>
                </div>

                {/* Step 2: BGIS */}
                <div className={`p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center justify-between ${bgisStatus === 'loading'
                  ? 'bg-teal-50/90 border-teal-300 ring-2 ring-teal-400/20 shadow-xs'
                  : bgisStatus === 'done'
                    ? 'bg-teal-50/40 border-teal-200/60'
                    : bgisStatus === 'skipped'
                      ? 'bg-slate-50 border-slate-100 opacity-50'
                      : 'bg-slate-50/60 border-slate-100 text-slate-400'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl text-xs transition-colors ${bgisStatus === 'loading' ? 'bg-teal-600 text-white shadow-xs' :
                      bgisStatus === 'done' ? 'bg-teal-100 text-teal-700' : 'bg-slate-200/80 text-slate-500'
                      }`}>
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-800">
                        {t.stageBgis}
                      </div>
                      {bgisStatus === 'loading' && (
                        <div className="text-[11px] text-teal-700 font-bold mt-0.5">
                          {t.statusLoading}
                        </div>
                      )}
                      {bgisStatus === 'done' && (
                        <div className="text-[10px] text-teal-800 font-extrabold mt-0.5">
                          {stageCounts.bgis} {getRecordUnit(stageCounts.bgis)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    {bgisStatus === 'loading' && <Loader2 className="w-4 h-4 text-teal-600 animate-spin" />}
                    {bgisStatus === 'done' && <CheckCircle2 className="w-4.5 h-4.5 text-teal-600" />}
                    {bgisStatus === 'skipped' && <span className="text-[10px] font-bold text-slate-400">{t.statusSkipped}</span>}
                    {bgisStatus === 'idle' && <span className="text-[10px] font-bold text-slate-400">{t.statusPending}</span>}
                  </div>
                </div>

                {/* Step 3: eBird (Bird group only) */}
                {isBirdGroup && (
                  <div className={`p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center justify-between ${ebirdStatus === 'loading'
                    ? 'bg-sky-50/90 border-sky-300 ring-2 ring-sky-400/20 shadow-xs'
                    : ebirdStatus === 'done'
                      ? 'bg-sky-50/40 border-sky-200/60'
                      : ebirdStatus === 'skipped'
                        ? 'bg-slate-50 border-slate-100 opacity-50'
                        : 'bg-slate-50/60 border-slate-100 text-slate-400'
                    }`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl text-xs transition-colors ${ebirdStatus === 'loading' ? 'bg-sky-600 text-white shadow-xs' :
                        ebirdStatus === 'done' ? 'bg-sky-100 text-sky-700' : 'bg-slate-200/80 text-slate-500'
                        }`}>
                        <Bird className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-800">
                          {t.stageEbird}
                        </div>
                        {ebirdStatus === 'loading' && (
                          <div className="text-[11px] text-sky-700 font-bold mt-0.5">
                            {t.statusLoading}
                          </div>
                        )}
                        {ebirdStatus === 'done' && (
                          <div className="text-[10px] text-sky-800 font-extrabold mt-0.5">
                            {stageCounts.ebird} {getRecordUnit(stageCounts.ebird)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      {ebirdStatus === 'loading' && <Loader2 className="w-4 h-4 text-sky-600 animate-spin" />}
                      {ebirdStatus === 'done' && <CheckCircle2 className="w-4.5 h-4.5 text-sky-600" />}
                      {ebirdStatus === 'skipped' && <span className="text-[10px] font-bold text-slate-400">{t.statusSkipped}</span>}
                      {ebirdStatus === 'idle' && <span className="text-[10px] font-bold text-slate-400">{t.statusPending}</span>}
                    </div>
                  </div>
                )}

                {/* Step 4: Spatial Grid Alignment */}
                <div className={`p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center justify-between ${gridStatus === 'loading'
                  ? 'bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-400/20 shadow-xs'
                  : gridStatus === 'done'
                    ? 'bg-indigo-50/40 border-indigo-200/60'
                    : 'bg-slate-50/60 border-slate-100 text-slate-400'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl text-xs transition-colors ${gridStatus === 'loading' ? 'bg-indigo-600 text-white shadow-xs' :
                      gridStatus === 'done' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200/80 text-slate-500'
                      }`}>
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-800">
                        {t.stageGrid}
                      </div>
                      {gridStatus === 'loading' && (
                        <div className="text-[11px] text-indigo-700 font-bold mt-0.5">
                          {t.statusLoading}
                        </div>
                      )}
                      {gridStatus === 'done' && (
                        <div className="text-[10px] text-indigo-800 font-extrabold mt-0.5">
                          {t.statusDone}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    {gridStatus === 'loading' && <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />}
                    {gridStatus === 'done' && <CheckCircle2 className="w-4.5 h-4.5 text-indigo-600" />}
                    {gridStatus === 'idle' && <span className="text-[10px] font-bold text-slate-400">{t.statusPending}</span>}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Left Dataset Filter Control */}
      {!isLoading && (() => {
        const hasInatData = stageCounts.inat > 0;
        const hasBgisData = stageCounts.bgis > 0;
        const hasEbirdData = isBirdGroup && stageCounts.ebird > 0;
        const hasAnyData = hasInatData || hasBgisData || hasEbirdData;

        if (!hasAnyData) return null;

        return (
          <div ref={filterRef} className="absolute top-3 left-3 z-30 flex items-center">
            {/* Desktop Filter Bar (sm:flex) - Compact Glass Pill */}
            <div className="hidden sm:flex bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-md rounded-full p-1 items-center gap-1">
              {/* iNaturalist Button */}
              {hasInatData && (
                <button
                  onClick={() => setShowInat(!showInat)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${showInat
                    ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-500/30'
                    : 'bg-slate-100/80 text-slate-400 hover:bg-slate-200/70 hover:text-slate-600'
                    }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${showInat ? 'bg-white animate-pulse' : 'bg-slate-300'}`} />
                  {t.filterInat}
                </button>
              )}

              {/* BGIS Button */}
              {hasBgisData && (
                <button
                  onClick={() => setShowBgis(!showBgis)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${showBgis
                    ? 'bg-teal-600 text-white shadow-xs ring-1 ring-teal-500/30'
                    : 'bg-slate-100/80 text-slate-400 hover:bg-slate-200/70 hover:text-slate-600'
                    }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${showBgis ? 'bg-white animate-pulse' : 'bg-slate-300'}`} />
                  {t.filterBgis}
                </button>
              )}

              {/* eBird Button (Bird Only) */}
              {hasEbirdData && (
                <button
                  onClick={() => setShowEbird(!showEbird)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${showEbird
                    ? 'bg-sky-600 text-white shadow-xs ring-1 ring-sky-500/30'
                    : 'bg-slate-100/80 text-slate-400 hover:bg-slate-200/70 hover:text-slate-600'
                    }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${showEbird ? 'bg-white animate-pulse' : 'bg-slate-300'}`} />
                  {t.filterEbird}
                </button>
              )}
            </div>

            {/* Mobile Dropdown Control (sm:hidden) */}
            <div className="sm:hidden relative">
              <button
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                className="bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-md rounded-2xl px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer active:scale-95 transition-all"
              >
                <Filter className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[11px]">
                  {[(hasInatData && showInat) ? 'iNat' : null, (hasBgisData && showBgis) ? 'BGIS' : null, (hasEbirdData && showEbird) ? 'eBird' : null].filter(Boolean).join(' + ') || (language === 'zh' ? '無選擇' : 'None')}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isFilterDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-10 left-0 w-44 bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-2xl p-1.5 flex flex-col gap-1 z-50"
                  >
                    {hasInatData && (
                      <button
                        onClick={() => setShowInat(!showInat)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${showInat ? 'bg-emerald-50 text-emerald-800' : 'text-slate-500 hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${showInat ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                          <span>{t.filterInat}</span>
                        </div>
                        {showInat && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                      </button>
                    )}

                    {hasBgisData && (
                      <button
                        onClick={() => setShowBgis(!showBgis)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${showBgis ? 'bg-teal-50 text-teal-800' : 'text-slate-500 hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${showBgis ? 'bg-teal-500 animate-pulse' : 'bg-slate-300'}`} />
                          <span>{t.filterBgis}</span>
                        </div>
                        {showBgis && <Check className="w-3.5 h-3.5 text-teal-600" />}
                      </button>
                    )}

                    {hasEbirdData && (
                      <button
                        onClick={() => setShowEbird(!showEbird)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${showEbird ? 'bg-sky-50 text-sky-800' : 'text-slate-500 hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${showEbird ? 'bg-sky-500 animate-pulse' : 'bg-slate-300'}`} />
                          <span>{t.filterEbird}</span>
                        </div>
                        {showEbird && <Check className="w-3.5 h-3.5 text-sky-600" />}
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        );
      })()}

      {/* Map View */}
      <Map
        initialViewState={{
          longitude: 114.135,
          latitude: 22.365,
          zoom: 10
        }}
        mapStyle={currentStyle as any}
        onClick={onMapClick}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        cursor={cursorStyle}
        interactiveLayerIds={['grid-layer']}
        attributionControl={false}
        onLoad={(e) => {
          setMapLoaded(true);
          const map = e.target;
          // 自動縮放置中至香港地理全境範圍
          map.fitBounds(
            [[113.82, 22.14], [114.44, 22.58]],
            { padding: isMobile ? 20 : 36, duration: 800 }
          );
        }}
      >
        {!isMobile && <MapNavControl position="top-right" showCompass={false} />}
        <FullscreenControl containerId="map-container" position="top-right" />

        {gridData && (
          <Source id="grid-source" type="geojson" data={gridData}>
            {/* Grid Fill Layer (Chloropleth) - GBIF green.poly style */}
            <Layer
              id="grid-layer"
              type="fill"
              paint={{
                'fill-color': [
                  'interpolate',
                  ['linear'],
                  ['get', 'totalCount'],
                  1, '#cf7fcf',
                  3, '#c35fc3',
                  6, '#b73fb7',
                  12, '#ab1fab',
                  25, '#a000a0'
                ],
                'fill-opacity': 0.85,
                'fill-outline-color': 'rgba(0, 0, 0, 0.12)'
              }}
            />
          </Source>
        )}
      </Map>

      {/* Basemap Switcher Panel */}
      <div className={`absolute ${isMobile ? 'top-[54px]' : 'top-[130px]'} right-[22px] z-40`}>
        <div className="relative">
          <button
            onClick={() => setIsBasemapPanelOpen(!isBasemapPanelOpen)}
            className={`w-[29px] h-[29px] flex items-center justify-center rounded-lg shadow-md border transition-all duration-300 ${isBasemapPanelOpen ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            title={t.basemapTitle}
          >
            <Layers className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {isBasemapPanelOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 0, x: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 0, x: 10 }}
                className="absolute top-0 right-10 w-64 bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-2xl p-3 max-h-[440px] overflow-y-auto custom-scrollbar"
              >
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">{t.basemapTitle}</h4>
                <div className="grid grid-cols-1 gap-2">
                  {BASEMAPS.map((basemap) => (
                    <button
                      key={basemap.id}
                      onClick={() => {
                        setCurrentStyleId(basemap.id);
                        setIsBasemapPanelOpen(false);
                      }}
                      className={`flex items-center gap-3 p-2 rounded-xl transition-all border ${currentStyleId === basemap.id
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold'
                        : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-100'
                        }`}
                    >
                      <div className={`w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 border relative ${currentStyleId === basemap.id ? 'border-emerald-300' : 'border-slate-200'
                        }`}>
                        {/* Map Preview Image */}
                        <div
                          className="absolute inset-0 bg-cover bg-center"
                          style={{ backgroundImage: `url(${basemap.preview})` }}
                        />
                        {/* Overlay if needed */}
                        {currentStyleId === basemap.id && (
                          <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-glow animate-pulse" />
                          </div>
                        )}
                      </div>
                      <span className="text-xs truncate">{basemap.name[language === 'zh' ? 'zh' : 'en']}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Selected Grid Popup Drawer / Mobile Bottom Sheet */}
      <AnimatePresence>
        {selectedGrid && (
          <motion.div
            initial={isMobile ? { y: '100%' } : { opacity: 0, x: 20, scale: 0.95 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, x: 0, scale: 1 }}
            exit={isMobile ? { y: '100%' } : { opacity: 0, x: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            drag={isMobile ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.8 }}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 80 || info.velocity.y > 250) {
                setSelectedGrid(null);
              }
            }}
            onWheel={(e) => e.stopPropagation()}
            className={
              isMobile
                ? "fixed inset-x-0 bottom-0 max-h-[82vh] z-50 bg-white backdrop-blur-2xl rounded-t-[2.5rem] shadow-2xl border-t border-slate-200/80 flex flex-col pointer-events-auto overflow-hidden"
                : "absolute top-4 right-4 bottom-4 w-85 z-40 bg-white backdrop-blur-2xl border border-slate-200 shadow-2xl rounded-2xl flex flex-col pointer-events-auto overflow-hidden"
            }
          >
            {/* Seamless Solid Header Banner (Integrating Mobile Drag Indicator) */}
            <div className="bg-emerald-800 text-white flex flex-col flex-shrink-0 shadow-sm rounded-t-[2.5rem] sm:rounded-t-3xl pt-2 px-4 pb-4 sm:px-5 sm:pb-4 sm:pt-4 cursor-grab active:cursor-grabbing">
              {/* Mobile Drag Indicator Handle */}
              {isMobile && (
                <div className="w-12 h-1.5 bg-white/40 hover:bg-white/60 rounded-full mx-auto mb-2 flex-shrink-0 transition-colors" />
              )}

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-base sm:text-lg flex items-center gap-2 tracking-tight">
                    <MapPin className="w-4 h-4 text-emerald-300" />
                    {isAdmin
                      ? `${t.gridId} ${selectedGrid.grid_id}`
                      : (language === 'zh' ? '網格觀測紀錄' : 'Grid Observations')}
                    {isAdmin && (
                      <span className="text-[10px] font-mono font-normal opacity-75 text-emerald-200">
                        (ID: {selectedGrid.grid_id})
                      </span>
                    )}
                  </h4>
                  <p className="text-emerald-100 text-[11px] sm:text-xs opacity-90 font-medium pt-0.5">
                    {[
                      showInat && selectedGrid.count > 0 ? `iNat: ${selectedGrid.count} ${getRecordUnit(selectedGrid.count)}` : null,
                      showBgis && (selectedGrid.bgisCount || 0) > 0 ? `BGIS: ${selectedGrid.bgisCount} ${getRecordUnit(selectedGrid.bgisCount || 0)}` : null,
                      (isBirdGroup && showEbird && (selectedGrid.ebirdCount || 0) > 0)
                        ? `eBird: ${selectedGrid.ebirdCount} ${language === 'zh'
                          ? `個觀測點`
                          : `${selectedGrid.ebirdCount === 1 ? 'location' : 'locations'}`
                        }` : null
                    ].filter(Boolean).join(' | ') || (language === 'zh' ? '無觀測記錄' : 'No Records')}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedGrid(null)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors cursor-pointer text-white/90 hover:text-white active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 custom-scrollbar">
              {/* eBird Section */}
              {isBirdGroup && showEbird && (selectedGrid.ebirdCount || 0) > 0 && (
                <div className="bg-emerald-50/60 border border-emerald-200/70 rounded-2xl p-3.5 space-y-2.5 shadow-xs">
                  {/* Header row */}
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-950 border-b border-emerald-200/60 pb-2">
                    <div className="flex items-center gap-1.5">
                      <Bird className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{t.ebirdSectionTitle}</span>

                      {/* Info Icon */}
                      <button
                        type="button"
                        onMouseEnter={() => setIsHoveringEbirdCitation(true)}
                        onMouseLeave={() => setIsHoveringEbirdCitation(false)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowEbirdCitation((prev) => !prev);
                        }}
                        className="p-0.5 text-emerald-600 hover:text-emerald-800 cursor-pointer rounded transition-colors focus:outline-none"
                        title={language === 'zh' ? '參考引用來源' : 'Reference Citation'}
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="font-extrabold text-emerald-600 text-[11px] bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-200">
                      {selectedGrid.ebirdCount} {language === 'zh' ? '個觀測點' : `${(selectedGrid.ebirdCount || 0) === 1 ? 'location' : 'locations'}`}
                    </span>
                  </div>

                  {/* Citation Box (Shows on hover on Info Icon OR click to toggle) */}
                  {(isHoveringEbirdCitation || showEbirdCitation) && (
                    <div
                      onMouseEnter={() => setIsHoveringEbirdCitation(true)}
                      onMouseLeave={() => setIsHoveringEbirdCitation(false)}
                      className="p-3 bg-slate-900/95 text-slate-100 text-[11px] leading-relaxed rounded-xl shadow-md border border-slate-700/60 backdrop-blur-xs w-full max-w-full break-words relative animate-in fade-in zoom-in-95 duration-150"
                    >
                      <div className="font-semibold text-emerald-400 mb-1 flex items-center justify-between">
                        <span>{language === 'zh' ? '參考引用來源 (Citation)' : 'Reference Citation'}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowEbirdCitation(false);
                            setIsHoveringEbirdCitation(false);
                          }}
                          className="text-slate-400 hover:text-white text-xs cursor-pointer px-1"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-slate-200 font-normal break-words selection:bg-emerald-500 selection:text-slate-900 leading-snug">
                        eBird. 2021. eBird: An online database of bird distribution and abundance [web application]. eBird, Cornell Lab of Ornithology, Ithaca, New York. Available: <a href="http://www.ebird.org" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline hover:text-emerald-300">http://www.ebird.org</a>. (Accessed: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}).
                      </p>
                    </div>
                  )}

                  <div className="text-[11px] text-emerald-900/80 leading-relaxed font-medium">
                    {language === 'zh'
                      ? '在目前網格內記錄到觀測地點。'
                      : 'Observation location points recorded within this grid.'}
                  </div>

                  {/* Action buttons row */}
                  <div className="flex items-center flex-wrap gap-2 pt-0.5">
                    {/* Show Detail Button */}
                    <button
                      onClick={async () => {
                        if (showEbirdDetail) {
                          setShowEbirdDetail(false);
                          return;
                        }

                        const gridKey = String(selectedGrid.grid_id);
                        // Check if we already fetched and cached data for this grid
                        if (ebirdLocCacheRef.current[gridKey] && ebirdLocCacheRef.current[gridKey].length > 0) {
                          setEbirdLocDetails(ebirdLocCacheRef.current[gridKey]);
                          setShowEbirdDetail(true);
                          return;
                        }

                        if (!ebirdSpeciesCode || !selectedGrid.ebirdRecords) return;
                        setIsLoadingEbirdDetail(true);
                        setEbirdDetailError(null);
                        try {
                          // 逐一對每個 eBird 位置 ID 查詢 locinfo
                          const locIDs = [...new Set(
                            (selectedGrid.ebirdRecords || []).map(r => r.n).filter(Boolean)
                          )];
                          const allInfoList: EbirdLocInfo[] = [];
                          for (const locID of locIDs) {
                            const result = await fetchEbirdLocInfo(locID, ebirdSpeciesCode);
                            if (result?.infoList) {
                              allInfoList.push(...result.infoList);
                            }
                          }
                          // 按日期降序排列
                          allInfoList.sort((a, b) => b.obsDt.localeCompare(a.obsDt));

                          // 保存至 Cache
                          ebirdLocCacheRef.current[gridKey] = allInfoList;
                          setEbirdLocDetails(allInfoList);
                          setShowEbirdDetail(true);
                        } catch (err) {
                          setEbirdDetailError(language === 'zh' ? '載入詳細記錄失敗' : 'Failed to load details');
                        } finally {
                          setIsLoadingEbirdDetail(false);
                        }
                      }}
                      disabled={isLoadingEbirdDetail}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl font-bold text-[11px] transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      {isLoadingEbirdDetail ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ChevronDown className={`w-3 h-3 transition-transform ${showEbirdDetail ? 'rotate-180' : ''}`} />
                      )}
                      <span>
                        {isLoadingEbirdDetail
                          ? (language === 'zh' ? '載入中...' : 'Loading...')
                          : showEbirdDetail
                            ? (language === 'zh' ? '收起詳情' : 'Collapse')
                            : (language === 'zh' ? '顯示詳情' : 'Show Details')}
                      </span>
                    </button>

                    {ebirdSpeciesCode && (
                      <a
                        href={`https://ebird.org/species/${ebirdSpeciesCode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>{language === 'zh' ? 'eBird 物種頁面' : 'Species on eBird'}</span>
                      </a>
                    )}
                  </div>

                  {/* Error */}
                  {ebirdDetailError && (
                    <div className="text-[11px] text-red-600 font-medium">{ebirdDetailError}</div>
                  )}

                  {/* Detail List grouped by Year */}
                  {showEbirdDetail && !isLoadingEbirdDetail && ebirdLocDetails.length > 0 && (() => {
                    // Group eBird records by Year (extracted from obsDt "YYYY-MM-DD" or similar format)
                    const groupsByYear = ebirdLocDetails.reduce<Record<string, EbirdLocInfo[]>>((acc, item) => {
                      const yearStr = item.obsDt ? item.obsDt.slice(0, 4) : (language === 'zh' ? '未知年份' : 'Unknown');
                      if (!acc[yearStr]) acc[yearStr] = [];
                      acc[yearStr].push(item);
                      return acc;
                    }, {});

                    // Sort years descending (e.g. 2024, 2023, 2022)
                    const sortedYears = Object.keys(groupsByYear).sort((a, b) => b.localeCompare(a));

                    return (
                      <EbirdYearGroupList
                        sortedYears={sortedYears}
                        groupsByYear={groupsByYear}
                        language={language}
                      />
                    );
                  })()}

                  {showEbirdDetail && !isLoadingEbirdDetail && ebirdLocDetails.length === 0 && (
                    <div className="text-[11px] text-amber-700 font-medium py-1">
                      {language === 'zh' ? '此網格內無法取得詳細記錄。' : 'No detail records available for this grid.'}
                    </div>
                  )}
                </div>
              )}

              {/* BGIS Dataset Info Section */}
              {showBgis && selectedGrid.bgisDataset && selectedGrid.bgisDataset.length > 0 && (selectedGrid.bgisCount || 0) > 0 && (
                <div className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-3.5 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-200/50 pb-2">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      <span>{t.bgisTitle}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsBgisCreditOpen(true);
                        }}
                        className="p-0.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100/60 rounded-full transition-colors cursor-pointer ml-0.5"
                        title={t.creditTitle}
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 pt-0.5">
                    {selectedGrid.bgisDataset
                      .filter(ds => ds.count > 0)
                      .map((ds, idx) => {
                        const meta = BGIS_DATASETS[ds.datasetID];
                        const dsName = meta ? meta[language === 'zh' ? 'zh' : 'en'] : `Dataset ${ds.datasetID}`;
                        return (
                          <div key={idx} className="flex items-center justify-between bg-white px-3 py-2.5 rounded-xl text-[11px] text-slate-700 shadow-2xs border border-slate-100 hover:border-emerald-200 transition-colors">
                            <div className="flex flex-col min-w-0 pr-2">
                              <span className="font-bold text-slate-800 truncate">{dsName}</span>
                              {isAdmin && (
                                <span className="font-mono text-[9px] text-slate-400">ID: {ds.datasetID}</span>
                              )}
                            </div>
                            <span className="font-extrabold text-emerald-600 flex-shrink-0 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">{ds.count} {getRecordUnit(ds.count)}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* iNaturalist Observation List */}
              {showInat && selectedGrid.observations && selectedGrid.observations.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 px-1 text-xs font-bold text-slate-700">
                    <Camera className="w-4 h-4 text-emerald-600" />
                    <span>{t.inatSectionTitle}</span>
                  </div>
                  {selectedGrid.observations.map((obs, idx) => (
                    <div key={`${obs.id}-${idx}`} className="group/item bg-white hover:bg-emerald-50/50 rounded-2xl p-3 border border-slate-200/80 hover:border-emerald-300/80 transition-all shadow-2xs">
                      <div className="flex gap-3">
                        {/* Square Image */}
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 border border-slate-200/60">
                          {obs.photos?.[0] ? (
                            <Image
                              src={getInatRewriteUrl(obs.photos[0].url, 'square')}
                              alt="observation"
                              fill
                              unoptimized
                              sizes="64px"
                              className="object-cover group-hover/item:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <Camera className="w-5 h-5" />
                            </div>
                          )}
                        </div>

                        {/* Obs Info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                          <div>
                            <p className="text-xs font-extrabold text-slate-800 truncate mb-1">
                              {t.obsBy}: {obs.user.name || obs.user.login}
                            </p>
                            <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{obs.observed_on_details.date}</span>
                            </div>
                          </div>
                          <div className="pt-1">
                            <a
                              href={obs.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              <span>{t.viewDetails}</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state prompt if all selected filters are hidden or empty */}
              {((!showInat && !showBgis && (!isBirdGroup || !showEbird)) ||
                (showInat && (!selectedGrid.observations || selectedGrid.observations.length === 0) &&
                  (!showBgis || (!selectedGrid.bgisDataset || selectedGrid.bgisDataset.length === 0)) &&
                  (!isBirdGroup || !showEbird || (!selectedGrid.ebirdCount)))) && (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <Info className="w-8 h-8 mx-auto text-slate-300 opacity-60" />
                    <p className="text-xs font-bold">
                      {language === 'zh' ? '當前過濾條件下無相關觀測記錄' : 'No observation records under current filter'}
                    </p>
                  </div>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BGIS / HKBIH Credit & Terms Modal */}
      <AnimatePresence>
        {isBgisCreditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-5 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 text-white flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20">
                    <Info className="w-5 h-5 text-emerald-100" />
                  </div>
                  <div>
                    <h3 className="font-black text-base md:text-lg tracking-tight">
                      {t.creditTitle}
                    </h3>
                    <p className="text-emerald-100/80 text-xs font-mono">
                      BGIS / HKBIH Terms & Data Attribution
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsBgisCreditOpen(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors text-white/90 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-700 text-sm custom-scrollbar">
                {/* Data Source & IP Owner Section */}
                <div className="grid grid-cols-1 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <div>
                    <span className="font-bold block mb-1 text-xs uppercase tracking-wider text-emerald-700">
                      {t.dataSourceLabel}
                    </span>
                    <p className="text-slate-700 font-medium leading-relaxed">
                      {t.dataSourceText}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-200/60">
                    <span className="font-bold block mb-1 text-xs uppercase tracking-wider text-emerald-700">
                      {t.ipOwnerLabel}
                    </span>
                    <p className="text-slate-700 font-medium leading-relaxed">
                      {t.ipOwnerText}
                    </p>
                  </div>
                </div>

                {/* Website Link */}
                <div className="bg-emerald-50/60 border border-emerald-200/60 p-4 rounded-2xl flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <span className="font-bold text-emerald-950 text-xs block mb-0.5">{t.websiteLabel}</span>
                    <a
                      href={language === 'zh' ? 'https://bih.gov.hk/tc/bgis/index.html' : 'https://bih.gov.hk/en/bgis/index.html'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-emerald-700 hover:text-emerald-800 underline truncate block"
                    >
                      {language === 'zh' ? 'https://bih.gov.hk/tc/bgis/index.html' : 'https://bih.gov.hk/en/bgis/index.html'}
                    </a>
                  </div>
                  <a
                    href={language === 'zh' ? 'https://bih.gov.hk/tc/bgis/index.html' : 'https://bih.gov.hk/en/bgis/index.html'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex-shrink-0 cursor-pointer"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>{language === 'zh' ? '開啟連結' : 'Visit Site'}</span>
                  </a>
                </div>

                {/* Clause 3 Terms */}
                <div className="space-y-3 pt-1">
                  <h4 className="font-black text-slate-900 text-sm md:text-base flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    {t.termsTitle}
                  </h4>
                  <p className="text-slate-600 text-xs leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
                    {t.termsSub}
                  </p>
                  <ul className="space-y-2.5 text-xs text-slate-600 pl-1">
                    <li className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      <span>{t.term1}</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      <span>{t.term2}</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      <span>{t.term3}</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setIsBgisCreditOpen(false)}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-sm"
                >
                  {t.close}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hover Tooltip */}
      <AnimatePresence>
        {hoveredGrid && !selectedGrid && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{
              left: hoveredGrid.x + 12,
              top: hoveredGrid.y + 12
            }}
            className="absolute z-50 pointer-events-none bg-slate-900/90 backdrop-blur-md text-white px-3.5 py-2 rounded-2xl shadow-xl border border-white/10 flex flex-col gap-1 min-w-[120px]"
          >
            {isAdmin && (
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-tight flex items-center gap-1 border-b border-white/10 pb-1">
                <span>{t.gridId} {hoveredGrid.id}</span>
                <span className="opacity-75 font-mono text-[9px] text-slate-300">
                  (ID: {hoveredGrid.id})
                </span>
              </div>
            )}
            <div className="text-xs font-bold space-y-0.5 pt-0.5">
              {showInat && hoveredGrid.count > 0 && (
                <div className="flex items-center justify-between gap-3 text-emerald-300">
                  <span className="text-[10px] opacity-80">iNat:</span>
                  <span>{hoveredGrid.count} {getRecordUnit(hoveredGrid.count)}</span>
                </div>
              )}
              {showBgis && (hoveredGrid.bgisCount || 0) > 0 && (
                <div className="flex items-center justify-between gap-3 text-teal-200">
                  <span className="text-[10px] opacity-80">BGIS:</span>
                  <span>{hoveredGrid.bgisCount} {getRecordUnit(hoveredGrid.bgisCount || 0)}</span>
                </div>
              )}
              {isBirdGroup && showEbird && (hoveredGrid.ebirdCount || 0) > 0 && (
                <div className="flex items-center justify-between gap-3 text-sky-300">
                  <span className="text-[10px] opacity-80">eBird:</span>
                  <span>{hoveredGrid.ebirdCount} {language === 'zh' ? '個觀測點' : `${(hoveredGrid.ebirdCount || 0) === 1 ? 'loc' : 'locs'}`}</span>
                </div>
              )}
              {((!showInat || hoveredGrid.count === 0) &&
                (!showBgis || (hoveredGrid.bgisCount || 0) === 0) &&
                (!isBirdGroup || !showEbird || (hoveredGrid.ebirdCount || 0) === 0)) && (
                  <div className="text-[10px] text-slate-400 font-medium py-0.5">
                    {!showInat && !showBgis && (!isBirdGroup || !showEbird)
                      ? (language === 'zh' ? '未勾選來源' : 'No Source Selected')
                      : (language === 'zh' ? '無觀測記錄' : 'No Records')}
                  </div>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Record Count Badge (Bottom Right) */}
      <div className={`absolute ${isMobile ? 'bottom-3 right-3 px-2.5 py-1.5' : 'bottom-4 right-4 px-3 py-2'} z-20 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-lg flex items-center gap-2 pointer-events-auto`}>
        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-glow animate-pulse flex-shrink-0" />
        <span className="text-[11px] font-extrabold text-slate-700 whitespace-nowrap">
          {language === 'zh'
            ? `已載入 ${(showInat ? observations.length : 0) + (showBgis ? totalBgisCount : 0) + ((isBirdGroup && showEbird) ? ebirdRecords.length : 0)} 筆記錄`
            : `Loaded ${(showInat ? observations.length : 0) + (showBgis ? totalBgisCount : 0) + ((isBirdGroup && showEbird) ? ebirdRecords.length : 0)} Records`}
        </span>
      </div>

      {/* Attribution info icon (Bottom Left) */}
      <div
        ref={attributionRef}
        className={`absolute ${isMobile ? 'bottom-4 left-4' : 'bottom-6 left-6'} z-40`}
        onMouseEnter={() => !isMobile && setShowAttribution(true)}
        onMouseLeave={() => !isMobile && setShowAttribution(false)}
      >
        <div className="relative flex flex-col items-start">
          <AnimatePresence>
            {showAttribution && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                className="mb-2 p-3 bg-slate-900/90 backdrop-blur-md border border-white/10 text-white text-[10px] rounded-2xl shadow-2xl flex flex-col gap-2 whitespace-nowrap min-w-[220px]"
              >
                {/* Line 1: BGIS Attribution & Terms Button */}
                <div className="flex items-center justify-between gap-3 pb-1.5 border-b border-white/10">
                  <span className="text-emerald-400 font-bold">&copy; AFCD, HKSAR; BGIS/HKBIH</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsBgisCreditOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-[9px] transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    <span>{language === 'zh' ? '條款細則' : 'Terms & Credits'}</span>
                  </button>
                </div>

                {/* Line 2: Dynamic Basemap Attribution */}
                <div className="text-slate-300 text-[9px] opacity-80 font-mono">
                  {(BASEMAPS.find(m => m.id === currentStyleId) || BASEMAPS[0]).attributionText}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => isMobile && setShowAttribution(!showAttribution)}
            className={`${isMobile ? 'w-7 h-7' : 'w-8 h-8'} bg-white/90 backdrop-blur-md border border-slate-200 rounded-full flex items-center justify-center text-slate-500 shadow-lg hover:bg-white transition-colors active:scale-95 cursor-pointer`}
          >
            <Info className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
          </button>
        </div>
      </div>

      {/* Placeholder text if map fails to load or styles are missing */}
      {!mapLoaded && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          {t.mapReady}
        </div>
      )}
    </div>
  );
}
