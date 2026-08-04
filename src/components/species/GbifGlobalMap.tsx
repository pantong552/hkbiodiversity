'use client';

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Globe2, Loader2, AlertCircle, Layers } from 'lucide-react';
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
    style: createRasterStyle([{ id: 'carto-light', tiles: [MAP_SOURCES.cartoLight] }])
  },
  {
    id: 'carto-dark',
    name: { zh: 'Carto 深色', en: 'Carto Dark' },
    preview: 'https://a.basemaps.cartocdn.com/dark_all/13/6694/3574.png',
    style: createRasterStyle([{ id: 'carto-dark', tiles: [MAP_SOURCES.cartoDark] }])
  },
  {
    id: 'osm',
    name: { zh: 'OpenStreetMap', en: 'OpenStreetMap' },
    preview: 'https://tile.openstreetmap.org/13/6694/3574.png',
    style: createRasterStyle([{ id: 'osm', tiles: [MAP_SOURCES.osm] }])
  },
  {
    id: 'esri-sat',
    name: { zh: 'Esri 衛星圖', en: 'Esri Satellite' },
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/3574/6694',
    style: createRasterStyle([{ id: 'esri-sat', tiles: [MAP_SOURCES.esri] }])
  },
  {
    id: 'google-streets',
    name: { zh: 'Google 街道', en: 'Google Streets' },
    preview: 'https://mt1.google.com/vt/lyrs=m&x=6694&y=3574&z=13',
    style: createRasterStyle([{ id: 'google-streets', tiles: [MAP_SOURCES.googleStreets] }])
  },
  {
    id: 'google-sat',
    name: { zh: 'Google 衛星', en: 'Google Satellite' },
    preview: 'https://mt1.google.com/vt/lyrs=s&x=6694&y=3574&z=13',
    style: createRasterStyle([{ id: 'google-sat', tiles: [MAP_SOURCES.googleSatellite] }])
  },
  {
    id: 'google-hybrid',
    name: { zh: 'Google 混合', en: 'Google Hybrid' },
    preview: 'https://mt1.google.com/vt/lyrs=y&x=6694&y=3574&z=13',
    style: createRasterStyle([{ id: 'google-hybrid', tiles: [MAP_SOURCES.googleHybrid] }])
  },
  {
    id: 'google-terrain',
    name: { zh: 'Google 地形', en: 'Google Terrain' },
    preview: 'https://mt1.google.com/vt/lyrs=p&x=6694&y=3574&z=13',
    style: createRasterStyle([{ id: 'google-terrain', tiles: [MAP_SOURCES.googleTerrain] }])
  },
];

export default function GbifGlobalMap({ scientificName }: GbifGlobalMapProps) {
  const { language } = useLanguage();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStyleId, setCurrentStyleId] = useState('carto-light');
  const [isBasemapPanelOpen, setIsBasemapPanelOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const taxonKeyRef = useRef<number | null>(null);

  const applyGbifLayer = (map: maplibregl.Map, key: number) => {
    if (!map.getSource('gbif-occurrence')) {
      map.addSource('gbif-occurrence', {
        type: 'vector',
        tiles: [
          `https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}.mvt?taxonKey=${key}`
        ],
        minzoom: 0,
        maxzoom: 16
      });
    }

    if (!map.getLayer('gbif-points')) {
      map.addLayer({
        id: 'gbif-points',
        type: 'circle',
        source: 'gbif-occurrence',
        'source-layer': 'occurrence',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            0, 1.2,
            5, 2.0,
            10, 4.0
          ],
          'circle-color': '#047857', // 網站主色系深綠色 (emerald-700 / #047857)
          'circle-opacity': 0.75,
          'circle-stroke-width': [
            'interpolate', ['linear'], ['zoom'],
            0, 0.5,
            10, 1.0
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.85
        }
      });
    }
  };

  const handleStyleChange = (basemapId: string) => {
    setCurrentStyleId(basemapId);
    setIsBasemapPanelOpen(false);
    const basemap = BASEMAPS.find(m => m.id === basemapId);
    if (basemap && mapRef.current) {
      mapRef.current.setStyle(basemap.style as any);
      mapRef.current.once('style.load', () => {
        if (mapRef.current && taxonKeyRef.current) {
          applyGbifLayer(mapRef.current, taxonKeyRef.current);
        }
      });
    }
  };

  // 僅依據 scientificName 初始化 GBIF 數據 (切換語言不會觸發 re-fetch)
  useEffect(() => {
    let isMounted = true;
    if (!scientificName) return;

    async function initGbifMap() {
      try {
        setLoading(true);
        setError(null);

        // 並行 1: 立即開始發起 GBIF 網絡 API 查詢 (不阻塞 Map 實例建立)
        const fetchGbifDataPromise = (async () => {
          const matchRes = await fetch(
            `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(scientificName)}`
          );
          const matchData = await matchRes.json();

          if (!matchData.usageKey) {
            return { taxonKey: null, bounds: null };
          }

          const taxonKey = matchData.usageKey;

          let bounds: maplibregl.LngLatBoundsLike | null = null;
          try {
            const occRes = await fetch(
              `https://api.gbif.org/v1/occurrence/search?taxonKey=${taxonKey}&hasCoordinate=true&limit=300`
            );
            const occData = await occRes.json();
            if (occData.results && occData.results.length > 0) {
              const lats = occData.results.map((r: any) => r.decimalLatitude).filter((v: any) => typeof v === 'number');
              const lngs = occData.results.map((r: any) => r.decimalLongitude).filter((v: any) => typeof v === 'number');
              if (lats.length > 0 && lngs.length > 0) {
                const minLat = Math.min(...lats);
                const maxLat = Math.max(...lats);
                const minLng = Math.min(...lngs);
                const maxLng = Math.max(...lngs);
                bounds = [[minLng, minLat], [maxLng, maxLat]];
              }
            }
          } catch (e) {
            console.warn('GBIF Bounds calculation fallback used', e);
          }

          return { taxonKey, bounds };
        })();

        if (!mapContainerRef.current) return;

        const defaultStyle = BASEMAPS[0].style;

        // 並行 2: 立即建立 MapLibre 地圖實例，不等待 API 回傳
        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: defaultStyle as any,
          center: [20, 20],
          zoom: 1.5,
          attributionControl: false
        });

        // 加入控制項
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.addControl(new maplibregl.FullscreenControl({ container: wrapperRef.current || undefined }), 'top-right');

        // 等待地圖載入與 GBIF 數據 fetch 同步完成
        const [{ taxonKey, bounds }] = await Promise.all([
          fetchGbifDataPromise,
          new Promise((resolve) => {
            if (map.isStyleLoaded()) {
              resolve(true);
            } else {
              map.once('load', () => resolve(true));
            }
          })
        ]);

        if (!isMounted) return;

        if (!taxonKey) {
          setError(language === 'zh' ? '於 GBIF 找不到該物種之全球數據' : 'No GBIF taxon key found');
          setLoading(false);
          return;
        }

        taxonKeyRef.current = taxonKey;
        applyGbifLayer(map, taxonKey);

        if (bounds) {
          map.fitBounds(bounds, {
            padding: { top: 40, bottom: 40, left: 40, right: 40 },
            maxZoom: 6
          });
        }

        setLoading(false);
        mapRef.current = map;
      } catch (err) {
        if (isMounted) {
          setError(language === 'zh' ? '無法載入 GBIF 地圖數據' : 'Failed to load GBIF map');
          setLoading(false);
        }
      }
    }

    initGbifMap();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [scientificName]); // 不放 language，語言切換時不會重新 fetch

  return (
    <div ref={wrapperRef} id="gbif-map-container" className="relative w-full h-[550px] rounded-[2.5rem] overflow-hidden bg-slate-100 border border-slate-200 shadow-inner group">
      <style jsx global>{`
        .maplibregl-ctrl-top-right { margin-top: 12px; margin-right: 12px; }
        .maplibregl-ctrl-group { border-radius: 12px !important; border: none !important; box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important; }
      `}</style>

      {/* 左上角標題 Badge */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2 bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-lg rounded-2xl px-3 py-1.5 text-xs font-bold text-slate-800">
        <Globe2 className="w-4 h-4 text-emerald-600" />
        <span>{language === 'zh' ? 'GBIF 全球分布地圖' : 'GBIF Global Distribution Map'}</span>
      </div>

      {/* 右上角底圖切換器 (位置與 SpeciesMap.tsx 完美對齊 top-[130px] right-[22px]) */}
      <div className={`absolute ${isMobile ? 'top-[54px]' : 'top-[130px]'} right-[22px] z-40`}>
        <div className="relative">
          <button
            onClick={() => setIsBasemapPanelOpen(!isBasemapPanelOpen)}
            className={`w-[29px] h-[29px] flex items-center justify-center rounded-lg shadow-md border transition-all duration-300 cursor-pointer ${
              isBasemapPanelOpen
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
                      onClick={() => handleStyleChange(basemap.id)}
                      className={`flex items-center gap-3 p-2 rounded-xl transition-all border cursor-pointer ${
                        currentStyleId === basemap.id
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold'
                          : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-100'
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 border relative ${
                          currentStyleId === basemap.id ? 'border-emerald-300' : 'border-slate-200'
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

      {/* MapLibre Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
