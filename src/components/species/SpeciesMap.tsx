'use client';

import React, { useState, useEffect, useRef } from 'react';
import Map, { Source, Layer, MapLayerMouseEvent, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as turf from '@turf/turf';
import { fetchAllInatObservations, InatObservation } from '@/utils/inaturalist';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, User, ExternalLink, MapPin, Loader2, Info, Maximize, MousePointer2, Layers, Shield, Link as LinkIcon, Filter, Building2, Camera, ChevronDown, Check } from 'lucide-react';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { FullscreenControl, NavigationControl as MapNavControl, Popup } from 'react-map-gl/maplibre';

import { fetchBgisSpeciesList, BgisGridRecord, BgisDatasetItem, BGIS_DATASETS } from '@/utils/bgis';

interface SpeciesMapProps {
  taxonId?: number;
  scientificName?: string;
  chineseName?: string;
}

interface GridFeatureProperties {
  grid_id: string | number;
  grid_no?: string;
  count: number;
  observations: InatObservation[];
  bgisCount?: number;
  bgisDataset?: BgisDatasetItem[];
}

const MAP_SOURCES = {
  osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  esri: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  cartoLight: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
  cartoDark: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
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
    preview: 'https://a.basemaps.cartocdn.com/light_all/13/6694/3574.png',
    attributionText: '© CARTO | MapLibre',
    style: createRasterStyle([{ id: 'carto-light', tiles: [MAP_SOURCES.cartoLight], attribution: '&copy; CARTO' }])
  },
  {
    id: 'carto-dark',
    name: { zh: 'Carto 深色', en: 'Carto Dark' },
    preview: 'https://a.basemaps.cartocdn.com/dark_all/13/6694/3574.png',
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
    preview: 'https://a.basemaps.cartocdn.com/light_all/13/6694/3574.png',
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
    loadingDesc: '正在獲取分佈紀錄與網格數據...',
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
    loadingDesc: 'Fetching observation records and grid data...',
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

export default function SpeciesMap({ taxonId, scientificName, chineseName }: SpeciesMapProps) {
  const { language } = useLanguage();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const t = translations[language === 'zh' ? 'zh' : 'en'];

  const getRecordUnit = (count: number) => {
    if (language === 'zh') return '筆';
    return count === 1 ? 'record' : 'records';
  };

  const [observations, setObservations] = useState<InatObservation[]>([]);
  const [totalBgisCount, setTotalBgisCount] = useState<number>(0);
  const [showInat, setShowInat] = useState(true);
  const [showBgis, setShowBgis] = useState(true);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [allProcessedFeatures, setAllProcessedFeatures] = useState<any[]>([]);
  const [gridData, setGridData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [selectedGrid, setSelectedGrid] = useState<GridFeatureProperties | null>(null);
  const [hoveredGrid, setHoveredGrid] = useState<{ id: string, count: number, bgisCount?: number, x: number, y: number } | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [cursorStyle, setCursorStyle] = useState<string>('auto');
  const [currentStyleId, setCurrentStyleId] = useState('carto-light');
  const [isBasemapPanelOpen, setIsBasemapPanelOpen] = useState(false);
  const [isBgisCreditOpen, setIsBgisCreditOpen] = useState(false);
  const [showAttribution, setShowAttribution] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const attributionRef = useRef<HTMLDivElement>(null);

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

  // 動態根據選取的 Dataset Filter (iNaturalist / BGIS) 實時更新地圖 GeoJSON 網格資料
  useEffect(() => {
    if (allProcessedFeatures.length === 0) return;

    const filteredFeatures = allProcessedFeatures
      .map(f => {
        const inatCount = showInat ? (f.properties.count || 0) : 0;
        const bgisCount = showBgis ? (f.properties.bgisCount || 0) : 0;
        const activeTotal = inatCount + bgisCount;

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
  }, [allProcessedFeatures, showInat, showBgis]);

  // Initial Data Loading
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      console.log('SpeciesMap: 正在啟動載入程序...', { taxonId, scientificName, chineseName });

      try {
        // 並行獲取 iNaturalist 觀測 與 BGIS 網格數據
        const [obs, bgisList] = await Promise.all([
          taxonId && taxonId > 0
            ? fetchAllInatObservations(taxonId, (current, total) => {
                setProgress({ current, total });
              })
            : Promise.resolve([]),
          (scientificName || chineseName)
            ? fetchBgisSpeciesList(scientificName || '', chineseName)
            : Promise.resolve([])
        ]);

        console.log(`SpeciesMap: 成功抓取到 ${obs.length} 筆 iNat 紀錄, ${bgisList.length} 筆 BGIS 網格紀錄`);
        setObservations(obs);

        // 將 BGIS list 建立網格編號對照物件 (對 item.no 執行嚴格規格化轉碼)
        const bgisMap: Record<string, BgisGridRecord> = {};
        let realBgisTotal = 0;

        bgisList.forEach(item => {
          if (item.no !== undefined && item.no !== null) {
            const rawNoStr = String(item.no);
            const cleanNo = isNaN(Number(rawNoStr)) ? rawNoStr : String(parseFloat(rawNoStr));
            bgisMap[cleanNo] = item;
            realBgisTotal += (item.count || 0);
          }
        });

        setTotalBgisCount(realBgisTotal);

        // 載入 Common_1km_grid GeoJSON
        const response = await fetch('/data/Common_1km_grid.geojson');
        if (!response.ok) {
          console.error('SpeciesMap: 無法下載 GeoJSON:', response.status, response.statusText);
          return;
        }
        const geojson = await response.json();

        let totalInatCounted = 0;
        let totalBgisCounted = 0;

        // 建構 iNat 點位
        const obsPoints = obs.map((o, idx) => {
          if (!o.location) return null;
          const parts = o.location.split(',').map(Number);
          if (parts.length < 2) return null;
          const [lat, lng] = parts;
          return turf.point([lng, lat], { ...o });
        }).filter(Boolean) as any;

        // 遍歷所有網格並匹配兩者數據
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

          // 綜合計數
          feature.properties.totalCount = feature.properties.count + feature.properties.bgisCount;
        });

        console.log(`SpeciesMap: 數據聚合完成 (iNat 匹配點: ${totalInatCounted}, BGIS 總紀錄: ${realBgisTotal}, 網格內匹配紀錄: ${totalBgisCounted})`);
        setAllProcessedFeatures(geojson.features);
      } catch (error) {
        console.error('SpeciesMap: 載入或聚合過程中發生錯誤:', error);
      } finally {
        setIsLoading(false);
      }
    }

    if (taxonId || scientificName || chineseName) {
      loadData();
    }
  }, [taxonId, scientificName, chineseName]);

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

      const rawId = props.grid_no ?? props.grid_id;
      const cleanId = rawId !== undefined && rawId !== null
        ? (isNaN(Number(rawId)) ? String(rawId) : String(parseFloat(String(rawId))))
        : '';

      const count = Number(props.count || 0);
      const bgisCount = Number(props.bgisCount || 0);

      if (count > 0 || bgisCount > 0) {
        setSelectedGrid({
          grid_id: cleanId,
          grid_no: cleanId,
          count: count,
          observations: obsList,
          bgisCount: bgisCount,
          bgisDataset: bgisDatasetList
        });
      }
    } else {
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
            className="absolute inset-0 z-50 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="relative w-20 h-20 mb-6">
              <Loader2 className="w-20 h-20 text-emerald-500 animate-spin absolute inset-0" />
              <div className="absolute inset-0 flex items-center justify-center font-black text-emerald-600 text-xs">
                {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%
              </div>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">{t.loadingTitle}</h3>
            <p className="text-slate-500 text-sm max-w-xs">
              {t.loadingDesc}
              <br />
              <span className="mt-2 inline-block px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full font-bold text-[10px]">
                {progress.current} / {progress.total}
              </span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Left Dataset Filter Control */}
      {!isLoading && (
        <div ref={filterRef} className="absolute top-4 left-4 z-30 flex items-center">
          {/* Desktop Filter Bar (sm:flex) */}
          <div className="hidden sm:flex bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-lg rounded-2xl p-1.5 items-center gap-1.5">
            {/* Filter Label */}
            <div className="px-2 py-1 flex items-center gap-1.5 text-xs font-bold text-slate-700 border-r border-slate-200/60 pr-2.5">
              <Filter className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t.datasetFilterLabel}</span>
            </div>

            {/* iNaturalist Button */}
            <button
              onClick={() => setShowInat(!showInat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                showInat
                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20'
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200/70 hover:text-slate-600'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showInat ? 'bg-white animate-pulse' : 'bg-slate-300'}`} />
              {t.filterInat}
            </button>

            {/* BGIS Button */}
            <button
              onClick={() => setShowBgis(!showBgis)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                showBgis
                  ? 'bg-teal-600 text-white shadow-sm ring-2 ring-teal-500/20'
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200/70 hover:text-slate-600'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showBgis ? 'bg-white animate-pulse' : 'bg-slate-300'}`} />
              {t.filterBgis}
            </button>
          </div>

          {/* Mobile Dropdown Control (sm:hidden) */}
          <div className="sm:hidden relative">
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-md rounded-2xl px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer active:scale-95 transition-all"
            >
              <Filter className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[11px]">
                {[showInat ? 'iNat' : null, showBgis ? 'BGIS' : null].filter(Boolean).join(' + ') || (language === 'zh' ? '無選擇' : 'None')}
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
                  <button
                    onClick={() => {
                      setShowInat(!showInat);
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      showInat ? 'bg-emerald-50 text-emerald-800' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${showInat ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                      <span>{t.filterInat}</span>
                    </div>
                    {showInat && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </button>

                  <button
                    onClick={() => {
                      setShowBgis(!showBgis);
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      showBgis ? 'bg-teal-50 text-teal-800' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${showBgis ? 'bg-teal-500 animate-pulse' : 'bg-slate-300'}`} />
                      <span>{t.filterBgis}</span>
                    </div>
                    {showBgis && <Check className="w-3.5 h-3.5 text-teal-600" />}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Map View */}
      <Map
        initialViewState={{
          longitude: 114.1694,
          latitude: 22.3193,
          zoom: 9.5
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
          // 行動端偵測並自動縮放至香港範圍
          if (isMobile) {
            map.fitBounds(
              [[113.8, 22.15], [114.4, 22.58]], // 香港經緯度範圍 [西南, 東北]
              { padding: 20, duration: 1000 }
            );
          }
        }}
      >
        {!isMobile && <MapNavControl position="top-right" showCompass={false} />}
        <FullscreenControl containerId="map-container" position="top-right" />

        {gridData && (
          <Source id="grid-source" type="geojson" data={gridData}>
            {/* Grid Fill Layer (Chloropleth) */}
            <Layer
              id="grid-layer"
              type="fill"
              paint={{
                'fill-color': [
                  'interpolate',
                  ['linear'],
                  ['get', 'totalCount'],
                  1, '#d1fae5', // emerald-100
                  5, '#10b981', // emerald-500
                  10, '#059669', // emerald-600
                  20, '#064e3b'  // emerald-900
                ],
                'fill-opacity': 0.8,
                'fill-outline-color': '#333333'
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
                : "absolute top-4 right-4 bottom-4 w-85 z-40 bg-white backdrop-blur-2xl border border-slate-200/80 shadow-2xl rounded-3xl overflow-hidden flex flex-col pointer-events-auto"
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
                      showBgis && (selectedGrid.bgisCount || 0) > 0 ? `BGIS: ${selectedGrid.bgisCount} ${getRecordUnit(selectedGrid.bgisCount || 0)}` : null
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
                              src={obs.photos[0].url.replace('square', 'medium')}
                              alt="observation"
                              fill
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
              {((!showInat && !showBgis) ||
                (!showInat && showBgis && (!selectedGrid.bgisDataset || selectedGrid.bgisDataset.length === 0)) ||
                (showInat && !showBgis && (!selectedGrid.observations || selectedGrid.observations.length === 0)) ||
                (showInat && showBgis && (!selectedGrid.observations || selectedGrid.observations.length === 0) && (!selectedGrid.bgisDataset || selectedGrid.bgisDataset.length === 0))) && (
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
              {((!showInat || hoveredGrid.count === 0) && (!showBgis || (hoveredGrid.bgisCount || 0) === 0)) && (
                <div className="text-[10px] text-slate-400 font-medium py-0.5">
                  {!showInat && !showBgis
                    ? (language === 'zh' ? '未勾選來源' : 'No Source Selected')
                    : (language === 'zh' ? '無觀測記錄' : 'No Records')}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Combined Compact Info & Density Legend Box (Bottom Right) */}
      <div className={`absolute ${isMobile ? 'bottom-4 right-4 p-2.5 max-w-[180px]' : 'bottom-6 right-6 p-3 min-w-[200px]'} z-20 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl flex flex-col gap-2 pointer-events-auto`}>
        {/* Record Count Badge */}
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-glow animate-pulse flex-shrink-0" />
          <span className="text-[11px] font-extrabold text-slate-700 truncate">
            {language === 'zh'
              ? `已載入 ${(showInat ? observations.length : 0) + (showBgis ? totalBgisCount : 0)} 筆記錄`
              : `Loaded ${(showInat ? observations.length : 0) + (showBgis ? totalBgisCount : 0)} Records`}
          </span>
        </div>

        {/* Density Scale Legend */}
        <div className="flex flex-col gap-1">
          <div className="text-[9px] font-bold text-slate-500">
            <span>{t.densityTitle}</span>
          </div>
          <div className="w-full h-1.5 bg-gradient-to-r from-[#d1fae5] via-[#10b981] to-[#064e3b] rounded-full shadow-inner" />
        </div>
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
