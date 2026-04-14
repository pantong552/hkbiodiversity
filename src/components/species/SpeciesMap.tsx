'use client';

import React, { useState, useEffect, useRef } from 'react';
import Map, { Source, Layer, MapLayerMouseEvent, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as turf from '@turf/turf';
import { fetchAllInatObservations, InatObservation } from '@/utils/inaturalist';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, User, ExternalLink, MapPin, Loader2, Info } from 'lucide-react';
import Image from 'next/image';

interface SpeciesMapProps {
  taxonId: number;
}

interface GridFeatureProperties {
  grid_id: string;
  count: number;
  observations: InatObservation[];
}

const OSM_STYLE = {
  version: 8,
  sources: {
    'osm': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors'
    }
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

export default function SpeciesMap({ taxonId }: SpeciesMapProps) {
  const [observations, setObservations] = useState<InatObservation[]>([]);
  const [gridData, setGridData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [selectedGrid, setSelectedGrid] = useState<GridFeatureProperties | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

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

  const onMapClick = (event: MapLayerMouseEvent) => {
    const feature = event.features && event.features[0];
    if (feature && feature.layer.id === 'grid-layer') {
      const props = feature.properties as any;
      // Parse observations if they are stringified (MapLibre sometimes stringifies complex objects in properties)
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

  return (
    <div className="relative w-full h-[500px] rounded-[2.5rem] overflow-hidden bg-slate-100 border border-slate-200 shadow-inner group">
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
            <h3 className="text-xl font-black text-slate-800 mb-2">正在獲取分佈數據</h3>
            <p className="text-slate-500 text-sm max-w-xs">
              正在從 iNaturalist 抓取所有觀測紀錄並進行 1km 網格運算...
              <br />
              <span className="mt-2 inline-block px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full font-bold text-[10px]">
                {progress.current} / {progress.total} 筆紀錄
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
        mapStyle={OSM_STYLE as any}
        onClick={onMapClick}
        interactiveLayerIds={['grid-layer']}
        onLoad={() => setMapLoaded(true)}
      >
        <NavigationControl position="top-right" />

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
                  1, '#a7f3d0',
                  5, '#34d399',
                  10, '#059669',
                  20, '#064e3b'
                ],
                'fill-opacity': 0.7,
                'fill-outline-color': '#ffffff'
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
            已載入 {observations.length} 筆觀測紀錄
          </div>
        )}
      </AnimatePresence>

      {/* Floating Info Window */}
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
                  網格 {selectedGrid.grid_id}
                </h4>
                <p className="text-emerald-50 text-xs opacity-80">
                  共發現 {selectedGrid.count} 筆觀測紀錄
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
                        觀測者: {obs.user.name || obs.user.login}
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
                        查看詳情
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                iNaturalist Research Grade Data
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-20 bg-white/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-200 shadow-lg pointer-events-none">
        <h5 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-2">觀測密度 (Grid)</h5>
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-gradient-to-r from-emerald-50 via-emerald-500 to-emerald-900 rounded-full" />
          <span className="text-[9px] font-bold text-slate-500">1 — 20+</span>
        </div>
      </div>

      {/* Placeholder text if map fails to load or styles are missing */}
      {!mapLoaded && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          正在準備地圖渲染引擎...
        </div>
      )}
    </div>
  );
}
