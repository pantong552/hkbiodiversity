'use client';

import React, { useState, useEffect, useRef } from 'react';
import Map, { Source, Layer, MapLayerMouseEvent, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as turf from '@turf/turf';
import { fetchAllInatObservations, InatObservation } from '@/utils/inaturalist';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, User, ExternalLink, MapPin, Loader2, Info, Maximize, MousePointer2, Layers } from 'lucide-react';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';
import { FullscreenControl, NavigationControl as MapNavControl, Popup } from 'react-map-gl/maplibre';

interface SpeciesMapProps {
  taxonId: number;
}

interface GridFeatureProperties {
  grid_id: string;
  count: number;
  observations: InatObservation[];
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
    style: createRasterStyle([{ id: 'carto-light', tiles: [MAP_SOURCES.cartoLight], attribution: '&copy; CARTO' }]) 
  },
  { 
    id: 'carto-dark', 
    name: { zh: 'Carto 深色', en: 'Carto Dark' }, 
    preview: 'https://a.basemaps.cartocdn.com/dark_all/13/6694/3574.png',
    style: createRasterStyle([{ id: 'carto-dark', tiles: [MAP_SOURCES.cartoDark], attribution: '&copy; CARTO' }]) 
  },
  { 
    id: 'osm', 
    name: { zh: 'OpenStreetMap', en: 'OpenStreetMap' }, 
    preview: 'https://tile.openstreetmap.org/13/6694/3574.png',
    style: createRasterStyle([{ id: 'osm', tiles: [MAP_SOURCES.osm], attribution: '&copy; OSM' }]) 
  },
  { 
    id: 'esri-sat', 
    name: { zh: 'Esri 衛星圖', en: 'Esri Satellite' }, 
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/3574/6694', 
    style: createRasterStyle([{ id: 'esri-sat', tiles: [MAP_SOURCES.esri], attribution: '&copy; Esri' }]) 
  },
  { 
    id: 'google-streets', 
    name: { zh: 'Google 街道', en: 'Google Streets' }, 
    preview: 'https://mt1.google.com/vt/lyrs=m&x=6694&y=3574&z=13',
    style: createRasterStyle([{ id: 'google-streets', tiles: [MAP_SOURCES.googleStreets], attribution: '&copy; Google' }]) 
  },
  { 
    id: 'google-sat', 
    name: { zh: 'Google 衛星', en: 'Google Satellite' }, 
    preview: 'https://mt1.google.com/vt/lyrs=s&x=6694&y=3574&z=13',
    style: createRasterStyle([{ id: 'google-sat', tiles: [MAP_SOURCES.googleSatellite], attribution: '&copy; Google' }]) 
  },
  { 
    id: 'google-hybrid', 
    name: { zh: 'Google 混合', en: 'Google Hybrid' }, 
    preview: 'https://mt1.google.com/vt/lyrs=y&x=6694&y=3574&z=13',
    style: createRasterStyle([{ id: 'google-hybrid', tiles: [MAP_SOURCES.googleHybrid], attribution: '&copy; Google' }]) 
  },
  { 
    id: 'google-terrain', 
    name: { zh: 'Google 地形', en: 'Google Terrain' }, 
    preview: 'https://mt1.google.com/vt/lyrs=p&x=6694&y=3574&z=13',
    style: createRasterStyle([{ id: 'google-terrain', tiles: [MAP_SOURCES.googleTerrain], attribution: '&copy; Google' }]) 
  },
  {
    id: 'hk-vector', name: { zh: '香港政府向量', en: 'HK Vector' }, 
    preview: 'https://a.basemaps.cartocdn.com/light_all/13/6694/3574.png',
    style: createRasterStyle([
      { id: 'hk-vector-base', tiles: [MAP_SOURCES.hkVector], attribution: '&copy; HKSAR' },
      { id: 'hk-vector-label', tiles: [MAP_SOURCES.hkLabel], attribution: '' }
    ])
  },
  {
    id: 'hk-imagery', name: { zh: '香港政府影像', en: 'HK Imagery' },
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/3574/6694',
    style: createRasterStyle([
      { id: 'hk-imagery-base', tiles: [MAP_SOURCES.hkImagery], attribution: '&copy; HKSAR' },
      { id: 'hk-imagery-label', tiles: [MAP_SOURCES.hkLabel], attribution: '' }
    ])
  },
];

const translations = {
  zh: {
    loadingTitle: '正在獲取分佈數據',
    loadingDesc: '正在從 iNaturalist 抓取觀測紀錄...',
    obsLoaded: '已載入',
    obsUnit: '筆觀測紀錄',
    densityTitle: '觀測密度 (Grid)',
    gridId: '網格',
    totalObs: '共發現',
    totalObsUnit: '筆觀測紀錄',
    obsBy: '觀測者',
    viewDetails: '查看詳情',
    researchGrade: 'iNaturalist 研究級數據',
    noInatId: '無 iNaturalist ID',
    mapReady: '正在準備地圖渲染引擎...',
    tooltipObs: '筆觀測'
  },
  en: {
    loadingTitle: 'Fetching Distribution Data',
    loadingDesc: 'Fetching observation records from iNaturalist...',
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
    layers: 'Layers'
  }
};

export default function SpeciesMap({ taxonId }: SpeciesMapProps) {
  const { language } = useLanguage();
  const t = translations[language === 'zh' ? 'zh' : 'en'];

  const [observations, setObservations] = useState<InatObservation[]>([]);
  const [gridData, setGridData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [selectedGrid, setSelectedGrid] = useState<GridFeatureProperties | null>(null);
  const [hoveredGrid, setHoveredGrid] = useState<{ id: string, count: number, x: number, y: number } | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [cursorStyle, setCursorStyle] = useState<string>('auto');
  const [currentStyleId, setCurrentStyleId] = useState('carto-light');
  const [isBasemapPanelOpen, setIsBasemapPanelOpen] = useState(false);

  const currentStyle = BASEMAPS.find(m => m.id === currentStyleId)?.style || BASEMAPS[0].style;

  // Initial Data Loading
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      console.log('SpeciesMap: 正在啟動載入程序, TaxonID:', taxonId);

      // 1. Fetch Observations
      const obs = await fetchAllInatObservations(taxonId, (current, total) => {
        setProgress({ current, total });
      });
      console.log(`SpeciesMap: 成功抓取到 ${obs.length} 筆觀測紀錄 (總數: ${progress.total})`);
      setObservations(obs);

      // 2. Fetch HK Grid GeoJSON
      try {
        console.log('SpeciesMap: 正在獲取 1km_grid.geojson...');
        const response = await fetch('/data/1km_grid.geojson');
        if (!response.ok) {
          console.error('SpeciesMap: 無法下載 GeoJSON:', response.status, response.statusText);
          return;
        }
        const geojson = await response.json();
        console.log(`SpeciesMap: GeoJSON 已載入, 共有 ${geojson.features?.length} 個網格特徵`);

        // 3. Process Aggregation (Point in Polygon)
        let totalCounted = 0;
        const processedObsPoints: any[] = [];

        if (obs.length > 0) {
          const obsPoints = obs.map((o, idx) => {
            if (!o.location) return null;
            const parts = o.location.split(',').map(Number);
            if (parts.length < 2) return null;
            const [lat, lng] = parts;
            const pt = turf.point([lng, lat], { ...o });

            if (idx < 5) {
              console.log(`SpeciesMap: 點位 ${idx} 座標: [${lng}, ${lat}] (iNat ID: ${o.id})`);
            }
            return pt;
          }).filter(Boolean) as any;

          processedObsPoints.push(...obsPoints);
          console.log(`SpeciesMap: 準備進行 ${obsPoints.length} 個點的網格匹配`);

          // Iterate through grids and count points
          geojson.features.forEach((feature: any, idx: number) => {
            const ptsInPoly = obsPoints.filter((pt: any) =>
              turf.booleanPointInPolygon(pt, feature)
            );

            feature.properties.count = ptsInPoly.length;
            feature.properties.observations = ptsInPoly.map((p: any) => p.properties);
            totalCounted += ptsInPoly.length;
          });
        }

        setObservations([...obs]);
        console.log(`SpeciesMap: 聚合完成, 共有 ${totalCounted} 筆點位成功匹配到網格`);

        // Filter out grids with zero observations to keep the map clean
        const activeGrids = geojson.features.filter((f: any) => f.properties.count > 0);
        console.log(`SpeciesMap: 顯示 ${activeGrids.length} 個有資料的網格`);

        const newGridData = {
          type: 'FeatureCollection',
          features: activeGrids
        };
        setGridData(newGridData);
      } catch (error) {
        console.error('SpeciesMap: 載入或聚合過程中發生錯誤:', error);
      } finally {
        setIsLoading(false);
      }
    }


    if (taxonId) {
      loadData();
    }
  }, [taxonId]);

  const containerRef = useRef<HTMLDivElement>(null);

  const onMapClick = (event: MapLayerMouseEvent) => {
    const feature = event.features && event.features[0];
    if (feature && feature.layer.id === 'grid-layer') {
      const props = feature.properties as any;
      const obsList = typeof props.observations === 'string'
        ? JSON.parse(props.observations)
        : props.observations;

      if (obsList && obsList.length > 0) {
        setSelectedGrid({
          grid_id: props.grid_id,
          count: props.count,
          observations: obsList
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
      setHoveredGrid({
        id: feature.properties?.grid_id,
        count: feature.properties?.count,
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
        onLoad={() => setMapLoaded(true)}
      >
        <MapNavControl position="top-right" showCompass={false} />
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
                  ['get', 'count'],
                  1, '#ecfdf5', // emerald-50 (更淡的起始色，增加層次感)
                  5, '#10b981', // emerald-500
                  10, '#059669', // emerald-600
                  20, '#064e3b'  // emerald-900
                ],
                'fill-opacity': 0.8,
                'fill-outline-color': '#b1b1b1ff'
              }}
            />
          </Source>
        )}
      </Map>

      {/* Info Status Overlay */}
      <AnimatePresence>
        {observations.length > 0 && !selectedGrid && (
          <div className="absolute top-4 left-4 z-40 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full text-[10px] font-bold text-emerald-800 shadow-sm border border-emerald-100 flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            {t.obsLoaded} {observations.length} {t.obsUnit}
          </div>
        )}
      </AnimatePresence>

      {/* Basemap Switcher Panel */}
      <div className="absolute top-[130px] right-[22px] z-40">
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

      {/* Placeholder text if map fails to load or styles are missing */}
      <AnimatePresence>
        {selectedGrid && (
          <motion.div
            initial={{ opacity: 0, x: 20, y: 0, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute top-4 right-4 bottom-4 w-80 z-40 bg-white/90 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white flex items-center justify-between">
              <div>
                <h4 className="font-black text-lg flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {t.gridId} {selectedGrid.grid_id}
                </h4>
                <p className="text-emerald-50 text-xs opacity-80">
                  {t.totalObs} {selectedGrid.count} {t.totalObsUnit}
                </p>
              </div>
              <button
                onClick={() => setSelectedGrid(null)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {selectedGrid.observations.map((obs, idx) => (
                <div key={`${obs.id}-${idx}`} className="group/item bg-slate-50/50 hover:bg-emerald-50 rounded-2xl p-3 border border-slate-100 transition-all">
                  <div className="flex gap-3">
                    {/* Square Image */}
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-slate-200">
                      {obs.photos?.[0] ? (
                        <Image
                          src={obs.photos[0].url.replace('square', 'medium')}
                          alt="observation"
                          fill
                          sizes="64px"
                          className="object-cover group-hover/item:scale-110 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Info className="w-4 h-4 text-slate-400" />
                        </div>
                      )}
                    </div>

                    {/* Obs Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate mb-1">
                        {t.obsBy}: {obs.user.name || obs.user.login}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
                        <Calendar className="w-3 h-3" />
                        {obs.observed_on_details.date}
                      </div>
                      <a
                        href={obs.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 underline underline-offset-2"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        {t.viewDetails}
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {t.researchGrade}
              </span>
            </div>
          </motion.div>
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
              left: hoveredGrid.x + 10,
              top: hoveredGrid.y + 10
            }}
            className="absolute z-50 pointer-events-none bg-slate-900/90 backdrop-blur text-white px-3 py-1.5 rounded-xl shadow-xl border border-white/10 flex flex-col gap-0.5"
          >
            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">
              {t.gridId} {hoveredGrid.id}
            </div>
            <div className="text-xs font-black">
              {hoveredGrid.count} {t.tooltipObs}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend Overlay */}
      <div className="absolute bottom-6 left-6 z-20 bg-white/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-200 shadow-lg pointer-events-none">
        <h5 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-2">{t.densityTitle}</h5>
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-gradient-to-r from-[#ecfdf5] via-[#10b981] to-[#064e3b] rounded-full" />
          <span className="text-[9px] font-bold text-slate-500">1 — 20+</span>
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
