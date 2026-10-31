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

const DEM_SOURCES = {
  mapterhorn: {
    name: { zh: 'Mapterhorn（全球地形）', en: 'Mapterhorn (Global)' },
    url: 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp',
    maxzoom: 12,
    attribution: 'Elevation data © Mapterhorn',
  },
  awsTerrain: {
    name: { zh: 'AWS Terrain Tiles（Mapzen）', en: 'AWS Terrain Tiles (Mapzen)' },
    url: '/api/map/dem/aws/{z}/{x}/{y}.png',
    maxzoom: 15,
    attribution: '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">AWS Terrain Tiles (Mapzen)</a> | SRTM and GMTED2010 data courtesy of USGS | <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Data source attributions</a>',
  },
} as const;
type DemSourceId = keyof typeof DEM_SOURCES;

type ContourDemSource = InstanceType<typeof mlcontour.DemSource>;
const contourDemSources: Partial<Record<DemSourceId, ContourDemSource>> = {};

function getContourDemSource(id: DemSourceId) {
  if (!contourDemSources[id]) {
    const config = DEM_SOURCES[id];
    contourDemSources[id] = new mlcontour.DemSource({
      id: `terrain-${id}`,
      url: config.url.startsWith('/')
        ? `${window.location.origin}${config.url}`
        : config.url,
      encoding: 'terrarium',
      maxzoom: config.maxzoom,
      worker: true,
      cacheSize: 100,
    });
    contourDemSources[id].setupMaplibre({ addProtocol });
  }
  return contourDemSources[id]!;
}

function initializeContourDemSources() {
  (Object.keys(DEM_SOURCES) as DemSourceId[]).forEach(getContourDemSource);
}

export default function MapPageClient() {
  const { language } = useLanguage();
  const [currentStyleId, setCurrentStyleId] = useState('openmaptiles-topo');
  const [isBasemapPickerOpen, setIsBasemapPickerOpen] = useState(false);
  const [isTerrainPickerOpen, setIsTerrainPickerOpen] = useState(false);
  const [isHillshadeEnabled, setIsHillshadeEnabled] = useState(false);
  const [areContoursEnabled, setAreContoursEnabled] = useState(true);
  const [demSourceId, setDemSourceId] = useState<DemSourceId>('mapterhorn');
  const [terrainReady, setTerrainReady] = useState(false);

  const currentBasemap = BASEMAPS.find((basemap) => basemap.id === currentStyleId) || BASEMAPS[0];
  const isTopoBasemap = currentStyleId === 'openmaptiles-topo';
  const demSourceConfig = DEM_SOURCES[demSourceId];
  const demSource = terrainReady ? getContourDemSource(demSourceId) : null;
  const showGeneratedContours = !isTopoBasemap && areContoursEnabled && terrainReady;
  const contourTiles = showGeneratedContours && demSource
    ? demSource.contourProtocolUrl({
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
          initializeContourDemSources();
          setTerrainReady(true);
        }}
      >
        {isHillshadeEnabled && demSource && (
          <Source
            key={`terrain-dem-${demSourceId}`}
            id={`terrain-dem-${demSourceId}`}
            type="raster-dem"
            tiles={[demSource.sharedDemProtocolUrl]}
            encoding="terrarium"
            maxzoom={demSourceConfig.maxzoom}
            tileSize={256}
            attribution={demSourceConfig.attribution}
          >
            <Layer
              id={`terrain-hillshade-${demSourceId}`}
              type="hillshade"
              source={`terrain-dem-${demSourceId}`}
              paint={{ 'hillshade-exaggeration': 0.25 }}
            />
          </Source>
        )}
        {contourTiles && (
          <Source
            key={`terrain-contours-${demSourceId}`}
            id={`terrain-contours-${demSourceId}`}
            type="vector"
            tiles={[contourTiles]}
            maxzoom={16}
            attribution={demSourceConfig.attribution}
          >
            <Layer
              id={`terrain-contour-lines-${demSourceId}`}
              type="line"
              source={`terrain-contours-${demSourceId}`}
              source-layer="contours"
              paint={{
                'line-color': 'rgb(126, 124, 121)',
                'line-opacity': 0.3,
                'line-width': 0.5,
              }}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            />
            <Layer
              id={`terrain-contour-index-lines-${demSourceId}`}
              type="line"
              source={`terrain-contours-${demSourceId}`}
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
              id={`terrain-contour-labels-${demSourceId}`}
              type="symbol"
              source={`terrain-contours-${demSourceId}`}
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
                  <fieldset role="radiogroup" className="space-y-1 border-b border-slate-100 pb-3">
                    <legend className="px-2 pb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                      {language === 'zh' ? '高程資料來源' : 'Elevation data'}
                    </legend>
                    {(Object.keys(DEM_SOURCES) as DemSourceId[]).map((id) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={demSourceId === id}
                        onClick={() => setDemSourceId(id)}
                        className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <span>{DEM_SOURCES[id].name[language]}</span>
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                          demSourceId === id ? 'border-emerald-600' : 'border-slate-300'
                        }`}>
                          {demSourceId === id && <span className="h-2 w-2 rounded-full bg-emerald-600" />}
                        </span>
                      </button>
                    ))}
                    <p className="px-2 pt-1 text-xs text-slate-500">
                      {language === 'zh' ? '高度及等高線標籤均使用公尺（m）' : 'Elevations and contour labels use meters (m)'}
                    </p>
                  </fieldset>
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
