'use client';

import { useEffect, useRef, useState } from 'react';
import Map, {
  type MapRef,
  FullscreenControl,
  Layer,
  NavigationControl,
  ScaleControl,
  Source,
  useControl,
} from 'react-map-gl/maplibre';
import {
  addProtocol,
  AttributionControl,
  type Map as MapLibreMap,
  type Marker as MapLibreMarker,
  type StyleSpecification,
} from 'maplibre-gl';
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
const DEFAULT_BASEMAP_ID = 'openmaptiles-bright';
const BASEMAP_PREVIEW_TILE_ZOOM = 13;
const BASEMAP_PREVIEW_TILE_X = 6694;
const BASEMAP_PREVIEW_TILE_Y = 3574;
const BASEMAP_PREVIEW_TILE_COUNT = 2 ** BASEMAP_PREVIEW_TILE_ZOOM;
const BASEMAP_PREVIEW_CENTER: [number, number] = [
  ((BASEMAP_PREVIEW_TILE_X + 0.5) / BASEMAP_PREVIEW_TILE_COUNT) * 360 - 180,
  Math.atan(Math.sinh(Math.PI * (1 - 2 * (BASEMAP_PREVIEW_TILE_Y + 0.5) / BASEMAP_PREVIEW_TILE_COUNT)))
    * 180 / Math.PI,
];

function getBasemapPreviewZoom(width: number) {
  return Math.log2(width * BASEMAP_PREVIEW_TILE_COUNT / 512);
}

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
    name: { zh: 'Mapterhorn', en: 'Mapterhorn' },
    url: 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp',
    maxzoom: 12,
    attribution: 'Elevation data © Mapterhorn',
  },
  awsTerrain: {
    name: { zh: 'Mapzen', en: 'Mapzen' },
    url: '/api/map/dem/aws/{z}/{x}/{y}.png',
    maxzoom: 15,
    attribution: '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">AWS Terrain Tiles (Mapzen)</a> | SRTM and GMTED2010 data courtesy of USGS | <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Data source attributions</a>',
  },
} as const;
type DemSourceId = keyof typeof DEM_SOURCES;
const LIBERTY_BUILDING_SOURCE_ID = 'liberty-buildings';
const LIBERTY_BUILDING_LAYER_ID = 'liberty-buildings-3d';
const THREE_D_TERRAIN_SOURCE_ID = 'terrain-dem-3d';
const THREE_D_TERRAIN_EXAGGERATION = 1.25;

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

function getBasemapStyle(
  basemap: (typeof BASEMAPS)[number],
  language: 'zh' | 'en',
): string | StyleSpecification {
  if (basemap.styleUrl) {
    return `${basemap.styleUrl}?language=${language}`;
  }
  if (!basemap.style) {
    throw new Error(`Basemap ${basemap.id} does not have a style`);
  }
  return {
    ...basemap.style,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  };
}

function preserveTerrainLayers(
  previousStyle: StyleSpecification | undefined,
  nextStyle: StyleSpecification,
): StyleSpecification {
  if (!previousStyle) return nextStyle;

  const terrainSources = Object.fromEntries(
    Object.entries(previousStyle.sources).filter(([id]) => (
      id.startsWith('terrain-dem-')
      || id.startsWith('terrain-contours-')
      || id === LIBERTY_BUILDING_SOURCE_ID
    )),
  );
  const existingLayerIds = new Set(nextStyle.layers.map((layer) => layer.id));
  const terrainLayers = previousStyle.layers
    .filter((layer) => (
      layer.id.startsWith('terrain-hillshade-')
      || layer.id.startsWith('terrain-contour-')
      || layer.id === LIBERTY_BUILDING_LAYER_ID
    ))
    .filter((layer) => !existingLayerIds.has(layer.id));
  const layers = [...nextStyle.layers];
  const firstSymbolLayerIndex = layers.findIndex((layer) => layer.type === 'symbol');
  layers.splice(
    firstSymbolLayerIndex === -1 ? layers.length : firstSymbolLayerIndex,
    0,
    ...terrainLayers,
  );

  return {
    ...nextStyle,
    sources: { ...nextStyle.sources, ...terrainSources },
    layers,
  };
}

async function updateBrightLabelLanguage(
  map: ReturnType<MapRef['getMap']>,
  language: 'zh' | 'en',
) {
  const response = await fetch(`/api/map/osm-bright?language=${language}`);
  if (!response.ok) {
    throw new Error(`Unable to load localized OSM Bright labels: ${response.status}`);
  }

  const style: unknown = await response.json();
  if (!isRecord(style) || !Array.isArray(style.layers)) {
    throw new Error('Invalid localized OSM Bright style response');
  }

  for (const layer of style.layers) {
    if (
      isRecord(layer)
      && typeof layer.id === 'string'
      && layer.source === 'openmaptiles'
      && isRecord(layer.layout)
      && Object.hasOwn(layer.layout, 'text-field')
      && map.getLayer(layer.id)
    ) {
      map.setLayoutProperty(layer.id, 'text-field', layer.layout['text-field']);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type LiveLocationControlProps = {
  language: 'zh' | 'en';
  onTrackingChange: (isTracking: boolean) => void;
  onError: (code: number) => void;
  onLocationUpdate: () => void;
};

function LiveLocationControl({
  language,
  onTrackingChange,
  onError,
  onLocationUpdate,
}: LiveLocationControlProps) {
  const propsRef = useRef({ language, onTrackingChange, onError, onLocationUpdate });
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const control = useControl(({ mapLib }) => {
    let map: MapLibreMap | null = null;
    let watchId: number | null = null;
    let isTracking = false;
    let locationMarker: MapLibreMarker | null = null;
    let accuracyMarker: MapLibreMarker | null = null;
    let accuracyElement: HTMLDivElement | null = null;
    let locationAccuracy = 0;
    let button: HTMLButtonElement;

    const updateAccuracyCircle = () => {
      if (!map || !locationMarker || !accuracyElement || locationAccuracy <= 0) return;

      const location = locationMarker.getLngLat();
      const point = map.project(location);
      const metersPerPixel = map.unproject([point.x + 100, point.y]).distanceTo(location) / 100;
      if (metersPerPixel <= 0) return;

      const diameter = (2 * locationAccuracy) / metersPerPixel;
      accuracyElement.style.width = `${diameter}px`;
      accuracyElement.style.height = `${diameter}px`;
    };

    const stopTracking = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      isTracking = false;
      locationMarker?.remove();
      accuracyMarker?.remove();
      locationMarker = null;
      accuracyMarker = null;
      accuracyElement = null;
      locationAccuracy = 0;
      button?.classList.remove(
        'maplibregl-ctrl-geolocate-active',
        'maplibregl-ctrl-geolocate-waiting',
      );
      button?.setAttribute('aria-pressed', 'false');
      if (button) updateButtonLabel(false);
      propsRef.current.onTrackingChange(false);
    };

    const reportError = (error: GeolocationPositionError) => {
      if (error.code === error.PERMISSION_DENIED) {
        stopTracking();
      }
      propsRef.current.onError(error.code);
    };

    const updateButtonLabel = (tracking: boolean) => {
      const currentLanguage = propsRef.current.language;
      const isSupported = window.isSecureContext && 'geolocation' in navigator;
      const label = !isSupported
        ? (currentLanguage === 'zh' ? '定位服務不可用' : 'Location unavailable')
        : tracking
          ? (currentLanguage === 'zh' ? '停止即時定位' : 'Stop live location')
          : (currentLanguage === 'zh' ? '實時定位' : 'Live location');
      button.setAttribute('aria-label', label);
      button.title = label;
    };

    const updateLocation = (position: GeolocationPosition) => {
      if (!map || !isTracking) return;

      const { longitude, latitude, accuracy } = position.coords;
      const center: [number, number] = [longitude, latitude];
      locationAccuracy = accuracy;
      const isFirstLocation = !locationMarker;
      if (isFirstLocation) {
        const dot = document.createElement('div');
        dot.className = 'maplibregl-user-location-dot';
        locationMarker = new mapLib.Marker({ element: dot, anchor: 'center' })
          .setLngLat(center)
          .addTo(map);

        accuracyElement = document.createElement('div');
        accuracyElement.className = 'maplibregl-user-location-accuracy-circle';
        accuracyMarker = new mapLib.Marker({ element: accuracyElement, anchor: 'center' })
          .setLngLat(center)
          .addTo(map);
      } else {
        locationMarker?.setLngLat(center);
        accuracyMarker?.setLngLat(center);
      }

      updateAccuracyCircle();

      map.easeTo({
        center,
        zoom: Math.max(map.getZoom(), Math.min(16, map.getMaxZoom())),
        duration: isFirstLocation ? 800 : 500,
      });
      button.classList.remove('maplibregl-ctrl-geolocate-waiting');
      propsRef.current.onLocationUpdate();
    };

    return {
      onAdd(nextMap) {
        map = nextMap;
        map.on('zoom', updateAccuracyCircle);
        map.on('move', updateAccuracyCircle);
        map.on('rotate', updateAccuracyCircle);
        map.on('pitch', updateAccuracyCircle);
        map.getContainer()
          .querySelectorAll<HTMLButtonElement>('.maplibregl-ctrl-geolocate')
          .forEach((existingButton) => {
            existingButton.closest('.maplibregl-ctrl-group')?.remove();
          });
        const container = document.createElement('div');
        container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
        button = document.createElement('button');
        buttonRef.current = button;
        button.type = 'button';
        button.className = 'maplibregl-ctrl-geolocate';
        button.setAttribute('aria-pressed', 'false');
        const icon = document.createElement('span');
        icon.className = 'maplibregl-ctrl-icon';
        icon.setAttribute('aria-hidden', 'true');
        button.append(icon);
        container.append(button);

        const isSupported = window.isSecureContext && 'geolocation' in navigator;
        updateButtonLabel(false);
        button.disabled = !isSupported;
        button.addEventListener('click', () => {
          if (isTracking) {
            stopTracking();
            return;
          }
          if (!map || !isSupported) return;

          isTracking = true;
          button.classList.add(
            'maplibregl-ctrl-geolocate-active',
            'maplibregl-ctrl-geolocate-waiting',
          );
          button.setAttribute('aria-pressed', 'true');
          updateButtonLabel(true);
          propsRef.current.onTrackingChange(true);

          navigator.geolocation.getCurrentPosition(
            updateLocation,
            (error) => {
              if (error.code === error.PERMISSION_DENIED) reportError(error);
            },
            { enableHighAccuracy: false, maximumAge: 30000, timeout: 10000 },
          );
          watchId = navigator.geolocation.watchPosition(
            updateLocation,
            reportError,
            { enableHighAccuracy: true, maximumAge: 0, timeout: 60000 },
          );
        });

        return container;
      },
      onRemove() {
        stopTracking();
        map?.off('zoom', updateAccuracyCircle);
        map?.off('move', updateAccuracyCircle);
        map?.off('rotate', updateAccuracyCircle);
        map?.off('pitch', updateAccuracyCircle);
        buttonRef.current = null;
        map = null;
      },
    };
  }, { position: 'bottom-right' });

  useEffect(() => {
    propsRef.current = { language, onTrackingChange, onError, onLocationUpdate };
    const button = buttonRef.current;
    if (!button) return;
    const isSupported = window.isSecureContext && 'geolocation' in navigator;
    const isTracking = button.getAttribute('aria-pressed') === 'true';
    const label = !isSupported
      ? (language === 'zh' ? '定位服務不可用' : 'Location unavailable')
      : isTracking
        ? (language === 'zh' ? '停止即時定位' : 'Stop live location')
        : (language === 'zh' ? '實時定位' : 'Live location');
    button.setAttribute('aria-label', label);
    button.title = label;
  }, [control, language, onError, onLocationUpdate, onTrackingChange]);

  return null;
}

export default function MapPageClient() {
  const { language, setLanguage } = useLanguage();
  const [currentStyleId, setCurrentStyleId] = useState(DEFAULT_BASEMAP_ID);
  const [isBasemapPickerOpen, setIsBasemapPickerOpen] = useState(false);
  const [isTerrainPickerOpen, setIsTerrainPickerOpen] = useState(false);
  const [isHillshadeEnabled, setIsHillshadeEnabled] = useState(false);
  const [is3DModeEnabled, setIs3DModeEnabled] = useState(false);
  const [areContoursEnabled, setAreContoursEnabled] = useState(true);
  const [demSourceId, setDemSourceId] = useState<DemSourceId>('mapterhorn');
  const [terrainReady, setTerrainReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocationTracking, setIsLocationTracking] = useState(false);
  const mapRef = useRef<MapRef>(null);
  const [initialStyle] = useState(() => getBasemapStyle(
    BASEMAPS.find((basemap) => basemap.id === DEFAULT_BASEMAP_ID) || BASEMAPS[0],
    language,
  ));
  const appliedBasemapId = useRef(DEFAULT_BASEMAP_ID);
  const appliedLocalizedBasemapLanguage = useRef(language);

  useEffect(() => {
    const mobileViewport = window.matchMedia('(max-width: 639px)');
    const updateViewport = () => setIsMobileViewport(mobileViewport.matches);
    updateViewport();
    mobileViewport.addEventListener('change', updateViewport);
    return () => mobileViewport.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!mapReady || !map) return;

    const attributionControl = new AttributionControl({ compact: isMobileViewport });
    map.addControl(attributionControl, 'bottom-right');

    const attribution = map.getContainer().querySelector('details.maplibregl-ctrl-attrib');
    const bottomRightControls = map.getContainer().querySelector('.maplibregl-ctrl-bottom-right');
    if (attribution && bottomRightControls) {
      bottomRightControls.append(attribution);
    }

    if (isMobileViewport) {
      attribution?.classList.remove('maplibregl-compact-show');
      attribution?.removeAttribute('open');
    }

    return () => {
      map.removeControl(attributionControl);
    };
  }, [isMobileViewport, mapReady]);

  const currentBasemap = BASEMAPS.find((basemap) => basemap.id === currentStyleId) || BASEMAPS[0];
  const demSourceConfig = DEM_SOURCES[demSourceId];
  const demSource = terrainReady ? getContourDemSource(demSourceId) : null;
  const contourTiles = areContoursEnabled && terrainReady && demSource
    ? demSource.contourProtocolUrl({
      multiplier: 1,
      thresholds: CONTOUR_THRESHOLDS,
      elevationKey: 'ele',
      levelKey: 'level',
      contourLayer: 'contours',
      overzoom: 1,
    })
    : undefined;

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!mapReady || !map) return;

    if (appliedBasemapId.current !== currentStyleId) {
      appliedBasemapId.current = currentStyleId;
      appliedLocalizedBasemapLanguage.current = language;
      if (is3DModeEnabled && map.isStyleLoaded() && map.getTerrain()) {
        map.setTerrain(null);
      }
      map.setStyle(getBasemapStyle(currentBasemap, language), {
        diff: !is3DModeEnabled,
        transformStyle: (previousStyle, nextStyle) => preserveTerrainLayers(previousStyle, nextStyle),
      });
      return;
    }

    if (
      currentStyleId === 'landsd-vector'
      && appliedLocalizedBasemapLanguage.current !== language
    ) {
      appliedLocalizedBasemapLanguage.current = language;
      if (is3DModeEnabled && map.isStyleLoaded() && map.getTerrain()) {
        map.setTerrain(null);
      }
      map.setStyle(getBasemapStyle(currentBasemap, language), {
        diff: !is3DModeEnabled,
        transformStyle: (previousStyle, nextStyle) => preserveTerrainLayers(previousStyle, nextStyle),
      });
      return;
    }

    if (
      currentStyleId !== 'openmaptiles-bright'
      || appliedLocalizedBasemapLanguage.current === language
    ) return;

    let active = true;
    const updateLabels = async () => {
      try {
        await updateBrightLabelLanguage(map, language);
        if (active) appliedLocalizedBasemapLanguage.current = language;
      } catch (error) {
        if (active) console.error('Failed to update OpenMapTiles OSM Bright label language:', error);
      }
    };

    if (map.isStyleLoaded()) {
      void updateLabels();
    } else {
      map.once('style.load', updateLabels);
    }

    return () => {
      active = false;
      map.off('style.load', updateLabels);
    };
  }, [currentBasemap, currentStyleId, is3DModeEnabled, language, mapReady]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!mapReady || !map || !terrainReady) return;

    const terrainDemSource = getContourDemSource(demSourceId);
    const apply3DMode = (styleLoaded = false) => {
      if (!styleLoaded && !map.isStyleLoaded()) return;

      if (is3DModeEnabled) {
        const terrainSource = map.getStyle().sources[THREE_D_TERRAIN_SOURCE_ID];
        const terrainTileUrl = terrainSource && 'tiles' in terrainSource
          ? terrainSource.tiles?.[0]
          : undefined;
        if (
          map.getSource(THREE_D_TERRAIN_SOURCE_ID)
          && terrainTileUrl !== terrainDemSource.sharedDemProtocolUrl
        ) {
          if (map.getTerrain()?.source === THREE_D_TERRAIN_SOURCE_ID) {
            map.setTerrain(null);
          }
          map.removeSource(THREE_D_TERRAIN_SOURCE_ID);
        }
        if (!map.getSource(THREE_D_TERRAIN_SOURCE_ID)) {
          map.addSource(THREE_D_TERRAIN_SOURCE_ID, {
            type: 'raster-dem',
            tiles: [terrainDemSource.sharedDemProtocolUrl],
            encoding: 'terrarium',
            maxzoom: DEM_SOURCES[demSourceId].maxzoom,
            tileSize: 256,
            attribution: DEM_SOURCES[demSourceId].attribution,
          });
        }

        if (!map.getSource(LIBERTY_BUILDING_SOURCE_ID)) {
          map.addSource(LIBERTY_BUILDING_SOURCE_ID, {
            type: 'vector',
            url: 'https://tiles.openfreemap.org/planet',
            attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> | <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>',
          });
        }

        if (!map.getLayer(LIBERTY_BUILDING_LAYER_ID)) {
          const firstSymbolLayerId = map.getStyle().layers.find(
            (layer) => layer.type === 'symbol',
          )?.id;
          map.addLayer({
            id: LIBERTY_BUILDING_LAYER_ID,
            type: 'fill-extrusion',
            source: LIBERTY_BUILDING_SOURCE_ID,
            'source-layer': 'building',
            minzoom: 13,
            paint: {
              'fill-extrusion-color': '#a7a7a5',
              'fill-extrusion-height': [
                'to-number',
                ['get', 'render_height'],
                ['to-number', ['get', 'height'], 0],
              ],
              'fill-extrusion-base': [
                'to-number',
                ['get', 'render_min_height'],
                ['to-number', ['get', 'min_height'], 0],
              ],
              'fill-extrusion-opacity': 0.85,
              'fill-extrusion-vertical-gradient': true,
            },
          }, firstSymbolLayerId);
        }
      }

      const desiredVisibility = is3DModeEnabled ? 'visible' : 'none';
      if (
        map.getLayer(LIBERTY_BUILDING_LAYER_ID)
        && map.getLayoutProperty(LIBERTY_BUILDING_LAYER_ID, 'visibility') !== desiredVisibility
      ) {
        map.setLayoutProperty(LIBERTY_BUILDING_LAYER_ID, 'visibility', desiredVisibility);
      }

      if (is3DModeEnabled && map.getSource(THREE_D_TERRAIN_SOURCE_ID)) {
        const terrain = map.getTerrain();
        if (
          terrain?.source !== THREE_D_TERRAIN_SOURCE_ID
          || terrain.exaggeration !== THREE_D_TERRAIN_EXAGGERATION
        ) {
          map.setTerrain({
            source: THREE_D_TERRAIN_SOURCE_ID,
            exaggeration: THREE_D_TERRAIN_EXAGGERATION,
          });
        }
      } else if (!is3DModeEnabled && map.getTerrain()) {
        map.setTerrain(null);
      }
    };

    const apply3DModeAfterStyleLoad = () => apply3DMode(true);
    map.on('style.load', apply3DModeAfterStyleLoad);
    map.on('styledata', apply3DMode);
    apply3DMode();

    return () => {
      map.off('style.load', apply3DModeAfterStyleLoad);
      map.off('styledata', apply3DMode);
    };
  }, [currentStyleId, demSourceId, is3DModeEnabled, mapReady, terrainReady]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!mapReady || !map) return;
    map.easeTo({
      pitch: is3DModeEnabled ? 55 : 0,
      zoom: is3DModeEnabled ? Math.max(map.getZoom(), 13) : map.getZoom(),
      duration: 650,
    });
  }, [is3DModeEnabled, mapReady]);

  return (
    <div className="map-page relative h-dvh w-full overflow-hidden bg-slate-100">
      <Map
        ref={mapRef}
        initialViewState={INITIAL_VIEW_STATE}
        mapStyle={initialStyle}
        attributionControl={false}
        maxZoom={currentStyleId === 'landsd-vector' ? 18.9 : 18}
        minZoom={3}
        reuseMaps
        onClick={() => {
          setIsBasemapPickerOpen(false);
          setIsTerrainPickerOpen(false);
        }}
        onLoad={() => {
          initializeContourDemSources();
          if (!window.isSecureContext || !('geolocation' in navigator)) {
            setLocationError(language === 'zh'
              ? '即時定位需要 HTTPS 安全連線及可用的瀏覽器定位服務。'
              : 'Live location requires a secure HTTPS connection and browser location services.');
          }
          setTerrainReady(true);
          setMapReady(true);
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
            {isHillshadeEnabled && (
              <Layer
                id={`terrain-hillshade-${demSourceId}`}
                type="hillshade"
                source={`terrain-dem-${demSourceId}`}
                paint={{ 'hillshade-exaggeration': 0.25 }}
              />
            )}
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
              layout={{
                'line-join': 'round',
                'line-cap': 'round',
                visibility: 'visible',
              }}
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
              layout={{
                'line-join': 'round',
                'line-cap': 'round',
                visibility: 'visible',
              }}
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
                visibility: 'visible',
              }}
              paint={{
                'text-color': '#5c5c5c',
                'text-halo-color': 'rgba(255,255,255,0.85)',
                'text-halo-width': 1.25,
              }}
            />
          </Source>
        )}
        <NavigationControl position="bottom-right" showCompass showZoom={false} />
        <LiveLocationControl
          language={language}
          onTrackingChange={setIsLocationTracking}
          onError={(code) => {
            setLocationError(
              code === 1
                ? (language === 'zh'
                  ? '定位權限被拒絕，請在瀏覽器設定中允許此網站使用位置。'
                  : 'Location access was denied. Allow location access in your browser settings.')
                : code === 2
                  ? (language === 'zh'
                    ? '目前無法取得位置，請確認裝置的定位服務已開啟。'
                    : 'Your location is unavailable. Check that location services are enabled.')
                  : (language === 'zh'
                    ? '定位逾時，正在繼續嘗試取得高精度位置。'
                    : 'Location timed out. Continuing to look for a high-accuracy fix.'),
            );
          }}
          onLocationUpdate={() => setLocationError(null)}
        />
        <FullscreenControl position="bottom-right" />
        <ScaleControl position="bottom-left" />
      </Map>

      {locationError && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-xl border border-slate-200/80 bg-white/95 px-4 py-2.5 text-center text-sm font-medium text-slate-700 shadow-lg backdrop-blur"
        >
          {locationError}
        </div>
      )}
      {isLocationTracking && (
        <span className="sr-only" aria-live="polite">
          {language === 'zh' ? '正在持續追蹤位置' : 'Live location tracking is active'}
        </span>
      )}

      <div className="absolute right-2.5 top-[4.25rem] z-20 flex flex-col gap-2">
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
            <div className="mb-2 flex items-center justify-between gap-2 px-2 py-1">
              <h2 className="text-sm font-black text-slate-900">
                {language === 'zh' ? '選擇地圖底圖' : 'Choose a basemap'}
              </h2>
              <div className="flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  aria-label="中文"
                  aria-pressed={language === 'zh'}
                  onClick={() => setLanguage('zh')}
                  className={`rounded-full px-2 py-1 text-xs font-bold transition ${
                    language === 'zh' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  中
                </button>
                <button
                  type="button"
                  aria-label="English"
                  aria-pressed={language === 'en'}
                  onClick={() => setLanguage('en')}
                  className={`rounded-full px-2 py-1 text-xs font-bold transition ${
                    language === 'en' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  英
                </button>
              </div>
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
                    }}
                    className={`group overflow-hidden rounded-2xl border text-left transition ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:border-emerald-300'
                    }`}
                  >
                    <div
                      className="relative h-20 overflow-hidden bg-slate-100"
                      style={basemap.preview ? { backgroundImage: `url("${basemap.preview}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                    >
                      {basemap.previewStyleUrl && (
                        <Map
                          initialViewState={{
                            longitude: BASEMAP_PREVIEW_CENTER[0],
                            latitude: BASEMAP_PREVIEW_CENTER[1],
                            zoom: 11,
                          }}
                          mapStyle={`${basemap.previewStyleUrl}?language=${language}`}
                          attributionControl={false}
                          interactive={false}
                          style={{ width: '100%', height: '100%' }}
                          onLoad={(event) => {
                            const map = event.target;
                            map.jumpTo({
                              center: BASEMAP_PREVIEW_CENTER,
                              zoom: getBasemapPreviewZoom(map.getContainer().clientWidth),
                            });
                          }}
                          onResize={(event) => {
                            const map = event.target;
                            map.setZoom(getBasemapPreviewZoom(map.getContainer().clientWidth));
                          }}
                        />
                      )}
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
                    aria-checked={areContoursEnabled}
                    aria-label={language === 'zh' ? '等高線' : 'Contour lines'}
                    onClick={() => setAreContoursEnabled((enabled) => !enabled)}
                    className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <span>{language === 'zh' ? '等高線' : 'Contour lines'}</span>
                    <span className={`relative h-5 w-9 rounded-full transition ${areContoursEnabled ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${areContoursEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                    </span>
                  </button>
                </div>
              </section>
            )}
        </div>

        <button
          type="button"
          aria-label={language === 'zh'
            ? (is3DModeEnabled ? '退出 3D 模式' : '進入 3D 模式')
            : (is3DModeEnabled ? 'Exit 3D mode' : 'Enter 3D mode')}
          aria-pressed={is3DModeEnabled}
          title={language === 'zh'
            ? (is3DModeEnabled ? '退出 3D 模式' : '進入 3D 模式')
            : (is3DModeEnabled ? 'Exit 3D mode' : 'Enter 3D mode')}
          onClick={() => {
            setIs3DModeEnabled((enabled) => {
              if (!enabled) setIsHillshadeEnabled(true);
              return !enabled;
            });
            setIsTerrainPickerOpen(false);
          }}
          className={`${MAP_ICON_BUTTON_CLASS} ${
            is3DModeEnabled
              ? '!border-emerald-600 !bg-emerald-600 !text-white hover:!bg-emerald-700'
              : ''
          }`}
        >
          <span className="text-sm font-black tracking-tight">3D</span>
        </button>
      </div>

    </div>
  );
}
