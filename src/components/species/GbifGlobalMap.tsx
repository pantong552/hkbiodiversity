'use client';

import React, { useEffect, useRef, useState } from 'react';
import Map, { Source, Layer, NavigationControl as MapNavControl, FullscreenControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Globe2, Loader2, AlertCircle, Layers, Info, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';

interface GbifGlobalMapProps {
  scientificName: string;
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
};

const createRasterStyle = (sources: { id: string; tiles: string[]; attribution?: string }[]) => ({
  version: 8 as const,
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
    style: createRasterStyle([{ id: 'carto-light', tiles: [MAP_SOURCES.cartoLight] }])
  },
  {
    id: 'carto-dark',
    name: { zh: 'Carto 深色', en: 'Carto Dark' },
    preview: 'https://a.basemaps.cartocdn.com/dark_all/13/6694/3574.png',
    attributionText: '© CARTO | MapLibre',
    style: createRasterStyle([{ id: 'carto-dark', tiles: [MAP_SOURCES.cartoDark] }])
  },
  {
    id: 'osm',
    name: { zh: 'OpenStreetMap', en: 'OpenStreetMap' },
    preview: 'https://tile.openstreetmap.org/13/6694/3574.png',
    attributionText: '© OpenStreetMap | MapLibre',
    style: createRasterStyle([{ id: 'osm', tiles: [MAP_SOURCES.osm] }])
  },
  {
    id: 'esri-sat',
    name: { zh: 'Esri 衛星圖', en: 'Esri Satellite' },
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/3574/6694',
    attributionText: '© Esri | MapLibre',
    style: createRasterStyle([{ id: 'esri-sat', tiles: [MAP_SOURCES.esri] }])
  },
  {
    id: 'google-streets',
    name: { zh: 'Google 街道', en: 'Google Streets' },
    preview: 'https://mt1.google.com/vt/lyrs=m&x=6694&y=3574&z=13',
    attributionText: '© Google Maps | MapLibre',
    style: createRasterStyle([{ id: 'google-streets', tiles: [MAP_SOURCES.googleStreets] }])
  },
  {
    id: 'google-sat',
    name: { zh: 'Google 衛星', en: 'Google Satellite' },
    preview: 'https://mt1.google.com/vt/lyrs=s&x=6694&y=3574&z=13',
    attributionText: '© Google Maps | MapLibre',
    style: createRasterStyle([{ id: 'google-sat', tiles: [MAP_SOURCES.googleSatellite] }])
  },
  {
    id: 'google-hybrid',
    name: { zh: 'Google 混合', en: 'Google Hybrid' },
    preview: 'https://mt1.google.com/vt/lyrs=y&x=6694&y=3574&z=13',
    attributionText: '© Google Maps | MapLibre',
    style: createRasterStyle([{ id: 'google-hybrid', tiles: [MAP_SOURCES.googleHybrid] }])
  },
  {
    id: 'google-terrain',
    name: { zh: 'Google 地形', en: 'Google Terrain' },
    preview: 'https://mt1.google.com/vt/lyrs=p&x=6694&y=3574&z=13',
    attributionText: '© Google Maps | MapLibre',
    style: createRasterStyle([{ id: 'google-terrain', tiles: [MAP_SOURCES.googleTerrain] }])
  },
];

export default function GbifGlobalMap({ scientificName }: GbifGlobalMapProps) {
  const { language } = useLanguage();
  const mapRef = useRef<any>(null);
  const attributionRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStyleId, setCurrentStyleId] = useState('carto-light');
  const [isBasemapPanelOpen, setIsBasemapPanelOpen] = useState(false);
  const [showAttribution, setShowAttribution] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });
  const [taxonKey, setTaxonKey] = useState<number | null>(null);

  // 實時監聽 window resize 事件以動態切換 isMobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 點擊外部隱藏版權資訊 (Mobile 模式)
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
  const currentAttribution = (BASEMAPS.find(m => m.id === currentStyleId) || BASEMAPS[0]).attributionText;

  // 僅依據 scientificName 獲取 GBIF taxonKey (僅發送 1 次 API 請求)
  useEffect(() => {
    let isMounted = true;
    if (!scientificName) return;

    async function fetchGbifData() {
      try {
        setLoading(true);
        setError(null);

        const matchRes = await fetch(
          `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(scientificName)}`
        );
        const matchData = await matchRes.json();

        if (!matchData.usageKey) {
          if (isMounted) {
            setError(language === 'zh' ? '於 GBIF 找不到該物種之全球數據' : 'No GBIF taxon key found');
            setLoading(false);
          }
          return;
        }

        if (isMounted) {
          setTaxonKey(matchData.usageKey);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(language === 'zh' ? '無法載入 GBIF 地圖數據' : 'Failed to load GBIF map');
          setLoading(false);
        }
      }
    }

    fetchGbifData();

    return () => {
      isMounted = false;
    };
  }, [scientificName]);

  return (
    <div id="gbif-map-container" className="relative w-full h-[550px] rounded-[2.5rem] overflow-hidden bg-slate-100 border border-slate-200 shadow-inner group">
      <style jsx global>{`
        .maplibregl-ctrl-top-right { margin-top: 12px; margin-right: 12px; }
        .maplibregl-ctrl-bottom-right { margin-bottom: 12px; margin-right: 12px; }
        .maplibregl-ctrl-group { border-radius: 12px !important; border: none !important; box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important; }
      `}</style>

      {/* 左上角標題 Badge */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2 bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-lg rounded-2xl px-3 py-1.5 text-xs font-bold text-slate-800">
        <Globe2 className="w-4 h-4 text-emerald-600" />
        <span>{language === 'zh' ? 'GBIF 全球分布地圖' : 'GBIF Global Distribution Map'}</span>
      </div>

      {/* 地圖 View */}
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: 15,
          latitude: 20,
          zoom: isMobile ? 0 : 0.6
        }}
        maxZoom={7}
        mapStyle={currentStyle as any}
        attributionControl={false}
      >
        {!isMobile && <MapNavControl position="top-right" showCompass={false} />}
        <FullscreenControl containerId="gbif-map-container" position="top-right" />

        {taxonKey && (
          <Source
            id="gbif-raster-green"
            type="raster"
            tiles={[`https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@2x.png?srs=EPSG:3857&taxonKey=${taxonKey}&style=purpleWhite.poly&bin=square&squareSize=128`]}
            tileSize={256}
            minzoom={0}
            maxzoom={7}
          >
            <Layer
              id="gbif-green-layer"
              type="raster"
              paint={{
                'raster-opacity': 0.85,
                'raster-resampling': 'nearest'
              }}
            />
          </Source>
        )}
      </Map>

      {/* 右上角底圖切換器 */}
      <div className={`absolute ${isMobile ? 'top-[54px]' : 'top-[130px]'} right-[22px] z-40`}>
        <div className="relative">
          <button
            onClick={() => setIsBasemapPanelOpen(!isBasemapPanelOpen)}
            className={`w-[29px] h-[29px] flex items-center justify-center rounded-lg shadow-md border transition-all duration-300 cursor-pointer ${isBasemapPanelOpen
              ? 'bg-emerald-500 border-emerald-400 text-white'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            title={language === 'zh' ? '底圖切換' : 'Basemap Switcher'}
          >
            <Layers className="w-4 h-4" />
          </button>

          {/* Basemap Selection Panel */}
          <AnimatePresence>
            {isBasemapPanelOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 0, x: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 0, x: 10 }}
                className="absolute top-0 right-10 w-64 bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-2xl p-3 max-h-[380px] overflow-y-auto custom-scrollbar"
              >
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">
                  {language === 'zh' ? '底圖切換' : 'Basemap'}
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {BASEMAPS.map((basemap) => (
                    <button
                      key={basemap.id}
                      onClick={() => {
                        setCurrentStyleId(basemap.id);
                        setIsBasemapPanelOpen(false);
                      }}
                      className={`flex items-center gap-3 p-2 rounded-xl transition-all border cursor-pointer ${currentStyleId === basemap.id
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold'
                        : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-100'
                        }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 border relative ${currentStyleId === basemap.id ? 'border-emerald-300' : 'border-slate-200'
                          }`}
                      >
                        <div
                          className="absolute inset-0 bg-cover bg-center"
                          style={{ backgroundImage: `url(${basemap.preview})` }}
                        />
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

      {/* 左下角 Attribution Info 按鈕 (與 SpeciesMap.tsx 同款) */}
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
                {/* GBIF Occurrence Data Attribution */}
                <div className="flex items-center justify-between gap-3 pb-1.5 border-b border-white/10">
                  <span className="text-emerald-400 font-bold">&copy; GBIF Occurrence Data</span>
                  <a
                    href="https://www.gbif.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[9px] transition-all shadow-xs"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    <span>GBIF.org</span>
                  </a>
                </div>

                {/* Basemap Credit */}
                <div className="text-slate-300 text-[9px] opacity-80 font-mono">
                  {currentAttribution}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => isMobile && setShowAttribution(!showAttribution)}
            className={`${isMobile ? 'w-7 h-7' : 'w-8 h-8'} bg-white/90 backdrop-blur-md border border-slate-200 rounded-full flex items-center justify-center text-slate-500 shadow-lg hover:bg-white transition-colors active:scale-95 cursor-pointer`}
            title={language === 'zh' ? '數據來源與條款聲明' : 'Data Credit & Terms'}
          >
            <Info className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
          </button>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-40 bg-slate-900/30 backdrop-blur-xs flex flex-col items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-xl border border-slate-200 shadow-xl rounded-2xl px-5 py-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
            <span className="text-xs font-bold text-slate-700">
              {language === 'zh' ? '正在載入 GBIF 全球數據...' : 'Loading GBIF distribution data...'}
            </span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="absolute inset-0 z-40 bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
          <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
          <p className="text-xs font-bold text-slate-600">{error}</p>
        </div>
      )}
    </div>
  );
}
