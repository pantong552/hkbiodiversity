'use client';

import { useState } from 'react';
import Map, {
  FullscreenControl,
  Layer,
  NavigationControl,
  ScaleControl,
  Source,
} from 'react-map-gl/maplibre';
import { addProtocol, type StyleSpecification } from 'maplibre-gl';
import mlcontour from 'maplibre-contour';
import { Check, Layers, Mountain } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { BASEMAPS } from '@/constants/basemaps';
import 'maplibre-gl/dist/maplibre-gl.css';

const INITIAL_VIEW_STATE = {
  longitude: 114.19434,
  latitude: 22.34826,
  zoom: 11.99,
};

const CONTOUR_THRESHOLDS: Record<number, [number, number]> = {
  10: [100, 500],
  11: [100, 500],
  12: [50, 200],
  13: [50, 200],
  14: [20, 100],
  15: [10, 50],
};
const MAP_ICON_BUTTON_CLASS = 'pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/80 bg-white/95 text-slate-700 shadow-lg backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500';

type ContourDemSource = InstanceType<typeof mlcontour.DemSource>;
let contourDemSource: ContourDemSource | null = null;

function getContourDemSource() {
  if (!contourDemSource) {
    contourDemSource = new mlcontour.DemSource({
      url: 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp',
      encoding: 'terrarium',
      maxzoom: 12,
      worker: true,
      cacheSize: 100,
    });
    contourDemSource.setupMaplibre({ addProtocol });
  }
  return contourDemSource;
}

export default function MapPageClient() {
  const { language } = useLanguage();
  const [currentStyleId, setCurrentStyleId] = useState('openmaptiles-topo');
  const [isBasemapPickerOpen, setIsBasemapPickerOpen] = useState(false);
  const [isTerrainPickerOpen, setIsTerrainPickerOpen] = useState(false);
  const [isHillshadeEnabled, setIsHillshadeEnabled] = useState(false);
  const [areContoursEnabled, setAreContoursEnabled] = useState(true);
  const [terrainReady, setTerrainReady] = useState(false);

  const currentBasemap = BASEMAPS.find((basemap) => basemap.id === currentStyleId) || BASEMAPS[0];
  const isTopoBasemap = currentStyleId === 'openmaptiles-topo';
  const showGeneratedContours = !isTopoBasemap && areContoursEnabled && terrainReady;
  const contourTiles = showGeneratedContours
    ? getContourDemSource().contourProtocolUrl({
      multiplier: 1,
      thresholds: CONTOUR_THRESHOLDS,
      elevationKey: 'ele',
      levelKey: 'level',
      contourLayer: 'contours',
      overzoom: 1,
    })
    : undefined;
  const mapStyle: string | StyleSpecification = currentBasemap.styleUrl || {
    ...currentBasemap.style,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-slate-100">
      <Map
        initialViewState={INITIAL_VIEW_STATE}
        mapStyle={mapStyle}
        maxZoom={18}
        minZoom={3}
        reuseMaps
        onLoad={() => {
          getContourDemSource();
          setTerrainReady(true);
        }}
      >
        {isHillshadeEnabled && terrainReady && (
          <Source
            id="terrain-dem"
            type="raster-dem"
            tiles={[getContourDemSource().sharedDemProtocolUrl]}
            encoding="terrarium"
            maxzoom={12}
            tileSize={256}
            attribution="Elevation data © Mapterhorn"
          >
            <Layer
              id="terrain-hillshade"
              type="hillshade"
              source="terrain-dem"
              paint={{ 'hillshade-exaggeration': 0.25 }}
            />
          </Source>
        )}
        {contourTiles && (
          <Source
            id="terrain-contours"
            type="vector"
            tiles={[contourTiles]}
            maxzoom={16}
            attribution="Elevation data © Mapterhorn"
          >
            <Layer
              id="terrain-contour-lines"
              type="line"
              source="terrain-contours"
              source-layer="contours"
              paint={{
                'line-color': 'rgb(126, 124, 121)',
                'line-opacity': 0.3,
                'line-width': 0.5,
              }}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            />
            <Layer
              id="terrain-contour-index-lines"
              type="line"
              source="terrain-contours"
              source-layer="contours"
              filter={['==', ['%', ['get', 'ele'], 100], 0]}
              paint={{
                'line-color': 'rgb(124, 122, 121)',
                'line-opacity': 0.1,
                'line-width': 1,
              }}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            />
            <Layer
              id="terrain-contour-labels"
              type="symbol"
              source="terrain-contours"
              source-layer="contours"
              filter={['>', ['get', 'level'], 0]}
              layout={{
                'symbol-placement': 'line',
                'text-anchor': 'center',
                'text-size': ['interpolate', ['linear'], ['zoom'], 11, 6, 18, 10],
                'text-allow-overlap': false,
                'symbol-avoid-edges': true,
                'text-ignore-placement': false,
                'text-field': ['concat', ['to-string', ['get', 'ele']], 'm'],
                'text-font': ['Noto Sans Bold'],
                'text-padding': 0,
              }}
              paint={{
                'text-color': '#5c5c5c',
                'text-halo-color': 'rgba(255,255,255,0.85)',
                'text-halo-width': 1.25,
              }}
            />
          </Source>
        )}
        <NavigationControl position="bottom-right" showCompass={false} />
        <FullscreenControl position="bottom-right" />
        <ScaleControl position="bottom-left" />
      </Map>

      <div className="absolute right-6 top-16 z-20 flex flex-col gap-2 md:right-8">
        <div className="relative">
        <button
          type="button"
          aria-label={language === 'zh' ? '選擇底圖' : 'Choose a basemap'}
          aria-expanded={isBasemapPickerOpen}
          aria-controls="map-basemap-picker"
          onClick={() => {
            setIsBasemapPickerOpen((open) => !open);
            setIsTerrainPickerOpen(false);
          }}
          className={MAP_ICON_BUTTON_CLASS}
        >
          <Layers className="h-5 w-5 text-emerald-700" />
        </button>

        {isBasemapPickerOpen && (
          <section
            id="map-basemap-picker"
            aria-label={language === 'zh' ? '選擇底圖' : 'Choose a basemap'}
            className="pointer-events-auto absolute right-full top-0 mr-3 w-[min(20rem,calc(100vw-6rem))] overflow-hidden rounded-3xl border border-white/70 bg-white/95 p-3 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-2 px-2 py-1">
              <h2 className="text-sm font-black text-slate-900">
                {language === 'zh' ? '選擇地圖底圖' : 'Choose a basemap'}
              </h2>
            </div>
            <div className="custom-scrollbar grid max-h-[min(55vh,28rem)] grid-cols-2 gap-2 overflow-y-auto p-1">
              {BASEMAPS.map((basemap) => {
                const isSelected = currentStyleId === basemap.id;
                return (
                  <button
                    key={basemap.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setCurrentStyleId(basemap.id);
                      setIsBasemapPickerOpen(false);
                    }}
                    className={`group overflow-hidden rounded-2xl border text-left transition ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:border-emerald-300'
                    }`}
                  >
                    <div
                      className="relative h-20 bg-cover bg-center"
                      style={{ backgroundImage: `url("${basemap.preview}")` }}
                    >
                      {isSelected && (
                        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white shadow">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                    <span className="block truncate px-2.5 py-2 text-xs font-bold text-slate-700">
                      {basemap.name[language]}
                    </span>
                  </button>
                );
              })}
            </div>
            </section>
        )}
        </div>

        <div className="relative">
            <button
              type="button"
              aria-label={language === 'zh' ? '地形圖層設定' : 'Terrain layer settings'}
              aria-expanded={isTerrainPickerOpen}
              aria-controls="map-terrain-picker"
              onClick={() => {
                setIsTerrainPickerOpen((open) => !open);
                setIsBasemapPickerOpen(false);
              }}
              className={MAP_ICON_BUTTON_CLASS}
            >
              <Mountain className="h-5 w-5 text-emerald-700" />
            </button>

            {isTerrainPickerOpen && (
              <section
                id="map-terrain-picker"
                aria-label={language === 'zh' ? '地形圖層設定' : 'Terrain layer settings'}
                className="pointer-events-auto absolute right-full top-0 mr-3 w-[min(18rem,calc(100vw-6rem))] rounded-2xl border border-white/70 bg-white/95 p-4 shadow-2xl backdrop-blur-xl"
              >
                <h2 className="mb-3 text-sm font-black text-slate-900">
                  {language === 'zh' ? '地形圖層' : 'Terrain layers'}
                </h2>
                <div className="space-y-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isHillshadeEnabled}
                    onClick={() => setIsHillshadeEnabled((enabled) => !enabled)}
                    className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <span>{language === 'zh' ? '陰影地形' : 'Hillshade'}</span>
                    <span className={`relative h-5 w-9 rounded-full transition ${isHillshadeEnabled ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${isHillshadeEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                    </span>
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isTopoBasemap || areContoursEnabled}
                    aria-label={language === 'zh' ? '等高線' : 'Contour lines'}
                    disabled={isTopoBasemap}
                    onClick={() => setAreContoursEnabled((enabled) => !enabled)}
                    className={`flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm font-semibold ${
                      isTopoBasemap ? 'cursor-not-allowed text-slate-400' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{language === 'zh' ? '等高線' : 'Contour lines'}</span>
                    <span className={`relative h-5 w-9 rounded-full transition ${
                      isTopoBasemap || areContoursEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}>
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
                        isTopoBasemap || areContoursEnabled ? 'left-[18px]' : 'left-0.5'
                      }`} />
                    </span>
                  </button>
                </div>
                {isTopoBasemap && (
                  <p className="mt-2 px-2 text-xs leading-relaxed text-slate-500">
                    {language === 'zh' ? '此底圖已內建等高線' : 'Contours are built into this basemap'}
                  </p>
                )}
              </section>
            )}
        </div>
      </div>

    </div>
  );
}
