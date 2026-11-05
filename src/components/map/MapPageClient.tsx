'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
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
  Marker as MapLibreMarkerConstructor,
  type Marker as MapLibreMarker,
  type CalculateTileZoomFunction,
  type Source as MapLibreSource,
  type StyleSpecification,
} from 'maplibre-gl';
import mlcontour from 'maplibre-contour';
import { AnimatePresence, motion, useSpring, useTransform } from 'framer-motion';
import CustomDropdown from '@/components/ui/CustomDropdown';
import useOfflineRouting from '@/hooks/useOfflineRouting';
import { Check, ChevronDown, ChevronLeft, ChevronUp, Layers, LoaderCircle, Mountain, Plus, RefreshCw, Route as RouteIcon, Search, Download, Trash2, X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { BASEMAPS } from '@/constants/basemaps';
import 'maplibre-gl/dist/maplibre-gl.css';

const INITIAL_VIEW_STATE = {
  longitude: 114.19434,
  latitude: 22.34826,
  zoom: 11.99,
};
const ROUTE_DIRECTION_IMAGE_ID = 'route-direction-arrow';

function ensureRouteDirectionImage(map: MapLibreMap) {
  if (map.hasImage(ROUTE_DIRECTION_IMAGE_ID)) return;

  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 24;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create route direction arrow image');

  context.beginPath();
  context.moveTo(11, 10);
  context.lineTo(19, 10);
  context.lineTo(19, 5);
  context.lineTo(30, 12);
  context.lineTo(19, 19);
  context.lineTo(19, 14);
  context.lineTo(11, 14);
  context.closePath();
  context.lineJoin = 'round';
  context.strokeStyle = 'rgba(15, 23, 42, 0.65)';
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = '#ffffff';
  context.fill();

  map.addImage(
    ROUTE_DIRECTION_IMAGE_ID,
    context.getImageData(0, 0, canvas.width, canvas.height),
    { pixelRatio: 2 },
  );
}
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
type RoutePoint = [number, number];
type RouteCoordinate = [number, number] | [number, number, number];
type LocationSearchResult = {
  id: string;
  name: string;
  address: string;
  coordinates: RoutePoint;
};
type WaypointMenuState =
  | { type: 'waypoint'; index: number; x: number; y: number }
  | { type: 'location'; id: string; x: number; y: number };
type PlannedRoute = {
  id: string;
  name: string;
  enabled: boolean;
  allowPrivateRoads: boolean;
  profile: 'foot' | 'bike';
  anchors: RoutePoint[];
  routedAnchors: RoutePoint[];
  coordinates: RouteCoordinate[];
  busy: boolean;
  error: string | null;
  useOfflineRouting: boolean;
};
const INACTIVE_ROUTE_COLORS = ['#059669', '#7c3aed', '#ea580c', '#0891b2'];
const HONG_KONG_SEARCH_BOUNDS = {
  west: 113.75,
  south: 22.15,
  east: 114.52,
  north: 22.58,
};

function getStringProperty(properties: Record<string, unknown>, key: string) {
  const value = properties[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isHongKongLabel(value: string | null) {
  return value !== null && (value.includes('Hong Kong') || value.includes('香港'));
}

function parseLocationSearchResults(data: unknown): LocationSearchResult[] {
  if (!isRecord(data) || !Array.isArray(data.features)) {
    throw new Error('Invalid location search response');
  }

  const results: LocationSearchResult[] = [];
  const seenIds = new Set<string>();

  data.features.forEach((feature) => {
    if (!isRecord(feature) || !isRecord(feature.geometry) || !Array.isArray(feature.geometry.coordinates)) return;
    if (!isRecord(feature.properties)) return;

    const [longitude, latitude] = feature.geometry.coordinates;
    if (
      typeof longitude !== 'number'
      || typeof latitude !== 'number'
      || longitude < HONG_KONG_SEARCH_BOUNDS.west
      || longitude > HONG_KONG_SEARCH_BOUNDS.east
      || latitude < HONG_KONG_SEARCH_BOUNDS.south
      || latitude > HONG_KONG_SEARCH_BOUNDS.north
    ) return;

    const properties = feature.properties;
    const countryCode = getStringProperty(properties, 'countrycode')?.toUpperCase();
    const country = getStringProperty(properties, 'country');
    const city = getStringProperty(properties, 'city');
    const state = getStringProperty(properties, 'state');
    const isHongKong = countryCode === 'HK'
      || isHongKongLabel(country)
      || isHongKongLabel(city)
      || isHongKongLabel(state);
    if (!isHongKong) return;

    const name = getStringProperty(properties, 'name')
      ?? getStringProperty(properties, 'street')
      ?? getStringProperty(properties, 'locality');
    if (!name) return;

    const address = [
      getStringProperty(properties, 'street'),
      getStringProperty(properties, 'district'),
      getStringProperty(properties, 'city'),
      getStringProperty(properties, 'county'),
      getStringProperty(properties, 'state'),
      country === 'China' ? null : country,
    ].filter((part, index, parts): part is string => Boolean(part) && part !== name && parts.indexOf(part) === index)
      .join(' · ');
    const osmType = getStringProperty(properties, 'osm_type') ?? 'location';
    const osmId = properties.osm_id;
    const id = osmId !== undefined && osmId !== null
      ? `${osmType}-${String(osmId)}`
      : `${name}-${longitude}-${latitude}`;
    if (seenIds.has(id)) return;
    seenIds.add(id);

    results.push({ id, name, address, coordinates: [longitude, latitude] });
  });

  return results;
}

function getRouteColor(routeId: string, activeRouteId: string, index: number) {
  return routeId === activeRouteId ? '#2563eb' : INACTIVE_ROUTE_COLORS[index % INACTIVE_ROUTE_COLORS.length];
}

function closestRoutePoint(point: RoutePoint, route: RouteCoordinate[]): RoutePoint {
  if (route.length === 0) return point;
  const latitudeScale = Math.cos((point[1] * Math.PI) / 180);
  if (route.length === 1) return [route[0][0], route[0][1]];
  let closest: RoutePoint = [route[0][0], route[0][1]];
  let closestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < route.length - 1; index++) {
    const start = route[index];
    const end = route[index + 1];
    const startX = (start[0] - point[0]) * latitudeScale;
    const startY = start[1] - point[1];
    const segmentX = (end[0] - start[0]) * latitudeScale;
    const segmentY = end[1] - start[1];
    const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
    const fraction = segmentLengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, -(startX * segmentX + startY * segmentY) / segmentLengthSquared));
    const candidate: RoutePoint = [
      start[0] + (end[0] - start[0]) * fraction,
      start[1] + (end[1] - start[1]) * fraction,
    ];
    const dx = (candidate[0] - point[0]) * latitudeScale;
    const dy = candidate[1] - point[1];
    const distance = dx * dx + dy * dy;
    if (distance < closestDistance) {
      closest = candidate;
      closestDistance = distance;
    }
  }
  return closest;
}

function closestRouteIndex(point: RoutePoint, route: ReadonlyArray<ReadonlyArray<number>>): number {
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;
  const latitudeScale = Math.cos((point[1] * Math.PI) / 180);
  route.forEach((candidate, index) => {
    const dx = (candidate[0] - point[0]) * latitudeScale;
    const dy = candidate[1] - point[1];
    const distance = dx * dx + dy * dy;
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });
  return closestIndex;
}

function getSegmentDistanceMeters(start: RoutePoint, end: RoutePoint) {
  const radians = Math.PI / 180;
  const lat1 = start[1] * radians;
  const lat2 = end[1] * radians;
  const deltaLat = (end[1] - start[1]) * radians;
  const deltaLon = (end[0] - start[0]) * radians;
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function interpolateRouteElevation(coordinates: number[][], segmentEndIndex: number, fraction: number) {
  const previous = coordinates[Math.max(0, segmentEndIndex - 2)][2] ?? 0;
  const start = coordinates[segmentEndIndex - 1][2] ?? 0;
  const end = coordinates[segmentEndIndex][2] ?? 0;
  const next = coordinates[Math.min(coordinates.length - 1, segmentEndIndex + 1)][2] ?? 0;
  const fractionSquared = fraction * fraction;
  const fractionCubed = fractionSquared * fraction;
  const elevation = 0.5 * (
    2 * start
    + (-previous + end) * fraction
    + (2 * previous - 5 * start + 4 * end - next) * fractionSquared
    + (-previous + 3 * start - 3 * end + next) * fractionCubed
  );
  return Math.max(Math.min(start, end), Math.min(Math.max(start, end), elevation));
}

function AnimatedMetric({
  value,
  format,
  className,
}: {
  value: number;
  format: (value: number) => string;
  className: string;
}) {
  const spring = useSpring(value, { stiffness: 110, damping: 24, mass: 0.7 });
  const display = useTransform(spring, format);
  useEffect(() => spring.set(value), [spring, value]);
  return <motion.span className={className}>{display}</motion.span>;
}

function RouteTabs({
  tabs,
  activeRouteId,
  language,
  onSelect,
  onAdd,
  onRemove,
}: {
  tabs: { id: string; name: string; busy: boolean; color: string }[];
  activeRouteId: string;
  language: 'zh' | 'en';
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove?: (id: string) => void;

}) {
  return (
    <div role="tablist" aria-label={language === 'zh' ? '路線' : 'Routes'} className="flex min-w-0 items-center gap-1.5 overflow-x-auto overscroll-y-none touch-pan-x">
      {tabs.map((tab) => <div key={tab.id} style={{ backgroundColor: activeRouteId === tab.id ? tab.color : `${tab.color}18`, color: activeRouteId === tab.id ? '#fff' : tab.color, borderColor: `${tab.color}55` }} className={`group inline-flex shrink-0 items-center rounded-lg border transition ${activeRouteId === tab.id ? 'shadow-sm' : 'hover:brightness-95'}`}>
        <button type="button" role="tab" aria-selected={activeRouteId === tab.id} onClick={() => onSelect(tab.id)} className="inline-flex items-center gap-2 py-1.5 pl-3 pr-2 text-xs font-bold">
          {tab.name}{tab.busy && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-300" />}
        </button>
        {onRemove && <button type="button" aria-label={language === 'zh' ? `移除${tab.name}` : `Remove ${tab.name}`} title={language === 'zh' ? `移除${tab.name}` : `Remove ${tab.name}`} onClick={() => onRemove(tab.id)} className={`mr-1 inline-flex h-5 w-5 items-center justify-center rounded-md bg-transparent transition hover:bg-transparent hover:text-red-600 ${activeRouteId === tab.id ? 'text-white' : 'text-slate-500'}`}>
          <Trash2 className="h-3 w-3" />
        </button>}
      </div>)}
      <button type="button" onClick={onAdd} aria-label={language === 'zh' ? '新增路線' : 'Add route'} title={language === 'zh' ? '新增路線' : 'Add route'} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"><Plus className="h-4 w-4" /></button>
    </div>
  );
}

function RouteElevationPanel({
  coordinates,
  anchors,
  language,
  tabs,
  activeRouteId,
  onSelectRoute,
  onAddRoute,
  onRemoveRoute,
  onHoverRoutePoint,
  mapRef,
  mapReady,
  isMobileViewport,
  isLocationTracking,
}: {
  coordinates: number[][];
  anchors: RoutePoint[];
  language: 'zh' | 'en';
  tabs: { id: string; name: string; busy: boolean; color: string }[];
  activeRouteId: string;
  onSelectRoute: (id: string) => void;
  onAddRoute: () => void;
  onRemoveRoute: (id: string) => void;
  onHoverRoutePoint: (point: { coordinate: RoutePoint; distance: number; elevation: number } | null) => void;
  mapRef: { current: MapRef | null };
  mapReady: boolean;
  isMobileViewport: boolean;
  isLocationTracking: boolean;
}) {
  const hasChart = coordinates.length > 1;
  const chartContainerRef = useRef<SVGSVGElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const panelContentRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const [chartHover, setChartHover] = useState<{ x: number; y: number; distance: number; elevation: number } | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const handlePointerStartRef = useRef<{ y: number; contentHeight: number; startHeight: number } | null>(null);
  const suppressHandleClickRef = useRef(false);
  const [handleDragHeight, setHandleDragHeight] = useState<number | null>(null);
  const [panelContentHeight, setPanelContentHeight] = useState(0);
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  useEffect(() => {
    const element = chartContainerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setChartSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasChart]);
  useEffect(() => {
    if (!mapReady) return;
    const panel = panelRef.current;
    const map = mapRef.current?.getMap();
    if (!panel || !map) return;

    const controls = map.getContainer().querySelectorAll<HTMLElement>(
      '.maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right',
    );
    const updateControlPosition = () => {
      const offset = `${panel.getBoundingClientRect().height}px`;
      controls.forEach((control) => {
        control.style.bottom = offset;
      });
    };

    updateControlPosition();
    const observer = new ResizeObserver(updateControlPosition);
    observer.observe(panel);
    return () => {
      observer.disconnect();
      controls.forEach((control) => control.style.removeProperty('bottom'));
    };
  }, [mapReady, mapRef]);

  const stats = useMemo(() => {
    const cumulativeDistances = [0];
    let ascent = 0;
    let descent = 0;
    for (let index = 1; index < coordinates.length; index++) {
      const previous = coordinates[index - 1];
      const current = coordinates[index];
      cumulativeDistances.push(cumulativeDistances[index - 1] + getSegmentDistanceMeters(
        [previous[0], previous[1]],
        [current[0], current[1]],
      ));
      const elevationChange = (current[2] ?? 0) - (previous[2] ?? 0);
      if (elevationChange > 0) ascent += elevationChange;
      else descent -= elevationChange;
    }

    const elevations = coordinates.map((point) => point[2] ?? 0);
    const { minElevation, maxElevation } = elevations.reduce(
      (range, elevation) => ({
        minElevation: Math.min(range.minElevation, elevation),
        maxElevation: Math.max(range.maxElevation, elevation),
      }),
      { minElevation: Number.POSITIVE_INFINITY, maxElevation: Number.NEGATIVE_INFINITY },
    );
    const elevationRange = Math.max(maxElevation - minElevation, 1);
    const chartWidth = 1000;
    const chartSamples = coordinates.flatMap((point, index) => {
      if (index === 0) return [{ distance: cumulativeDistances[index], elevation: point[2] ?? 0 }];
      const segmentDistance = cumulativeDistances[index] - cumulativeDistances[index - 1];
      return Array.from({ length: 4 }, (_, sampleIndex) => {
        const fraction = (sampleIndex + 1) / 4;
        return {
          distance: cumulativeDistances[index - 1] + segmentDistance * fraction,
          elevation: interpolateRouteElevation(coordinates, index, fraction),
        };
      });
    });
    const points = chartSamples.map((sample) => ({
      x: (sample.distance / Math.max(cumulativeDistances.at(-1) ?? 1, 1)) * chartWidth,
      y: 88 - ((sample.elevation - minElevation) / elevationRange) * 70,
    }));
    const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
    const areaPath = `${linePath} L ${chartWidth} 94 L 0 94 Z`;
    const waypointMarks = anchors.map((anchor, index) => {
      const routeIndex = closestRouteIndex(anchor, coordinates);
      return { index, distance: cumulativeDistances[routeIndex], ...points[routeIndex * 4] };
    });

    return {
      distance: cumulativeDistances.at(-1) ?? 0,
      cumulativeDistances,
      ascent,
      descent,
      minElevation,
      maxElevation,
      linePath,
      areaPath,
      waypointMarks,
    };
  }, [anchors, coordinates]);

  const formatDistance = (meters: number) => meters >= 1000
    ? `${(meters / 1000).toFixed(2)} km`
    : `${Math.round(meters)} m`;
  const labels = language === 'zh'
    ? { distance: '全長距離', ascent: '總爬升', descent: '總下降' }
    : { distance: 'Distance', ascent: 'Total ascent', descent: 'Total descent' };

  const handleChartPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const targetDistance = fraction * stats.distance;
    let segmentIndex = stats.cumulativeDistances.findIndex((distance, index) => (
      index > 0 && distance >= targetDistance
    ));
    if (segmentIndex < 0) segmentIndex = coordinates.length - 1;
    const startIndex = Math.max(0, segmentIndex - 1);
    const startDistance = stats.cumulativeDistances[startIndex];
    const endDistance = stats.cumulativeDistances[segmentIndex];
    const segmentFraction = endDistance === startDistance
      ? 0
      : (targetDistance - startDistance) / (endDistance - startDistance);
    const start = coordinates[startIndex];
    const end = coordinates[segmentIndex];
    const elevation = interpolateRouteElevation(coordinates, segmentIndex, segmentFraction);
    const elevationRange = Math.max(stats.maxElevation - stats.minElevation, 1);
    const y = 88 - ((elevation - stats.minElevation) / elevationRange) * 70;
    setChartHover({ x: fraction * 1000, y, distance: targetDistance, elevation });
    onHoverRoutePoint({
      coordinate: [
        start[0] + (end[0] - start[0]) * segmentFraction,
        start[1] + (end[1] - start[1]) * segmentFraction,
      ],
      distance: targetDistance,
      elevation,
    });
  };
  const setPanelCollapsed = (collapsed: boolean) => {
    setPanelContentHeight(panelContentRef.current?.scrollHeight ?? panelContentHeight);
    setIsCollapsed(collapsed);
    setChartHover(null);
    onHoverRoutePoint(null);
  };

  return (
    <section
      ref={panelRef}
      aria-label={language === 'zh' ? '路線高度資料' : 'Route elevation profile'}
      className={`absolute inset-x-0 ${isMobileViewport && isLocationTracking ? 'bottom-14' : 'bottom-0'} z-20 rounded-t-2xl border-t border-white/70 bg-white shadow-[0_-12px_40px_rgba(15,23,42,0.16)] transition-[bottom] duration-300 ease-in-out ${isMobileViewport ? 'touch-pan-x overscroll-y-contain' : ''}`}
    >
      <div className={`mx-auto max-w-screen-2xl px-3 pb-2 pt-0.5 sm:px-3 sm:pb-0 sm:pt-1 ${isCollapsed ? 'sm:pb-2' : ''}`}>
        <div className="flex flex-col items-center sm:flex-row sm:gap-2">
          <button
            type="button"
            aria-label={language === 'zh'
              ? (isCollapsed ? '展開路線高度圖' : '收合路線高度圖')
              : (isCollapsed ? 'Expand route elevation profile' : 'Collapse route elevation profile')}
            aria-expanded={!isCollapsed}
            title={language === 'zh'
              ? (isCollapsed ? '展開高度圖' : '收合高度圖')
              : (isCollapsed ? 'Expand elevation profile' : 'Collapse elevation profile')}
            className="order-1 flex h-3 w-full touch-none select-none items-center justify-center sm:order-2 sm:h-7 sm:w-9 sm:shrink-0 sm:rounded-lg sm:text-slate-500 sm:hover:bg-slate-100 sm:hover:text-slate-800"
            onPointerDown={(event) => {
              if (event.pointerType === 'touch') {
                const contentHeight = panelContentRef.current?.scrollHeight ?? 0;
                const startHeight = isCollapsed ? 0 : contentHeight;
                handlePointerStartRef.current = { y: event.clientY, contentHeight, startHeight };
                setPanelContentHeight(contentHeight);
                setHandleDragHeight(startHeight);
                setIsDraggingHandle(true);
                event.currentTarget.setPointerCapture(event.pointerId);
              }
            }}
            onPointerMove={(event) => {
              const start = handlePointerStartRef.current;
              if (!start || event.pointerType !== 'touch') return;
              const deltaY = event.clientY - start.y;
              const nextHeight = start.startHeight - deltaY;
              setHandleDragHeight(Math.max(0, Math.min(start.contentHeight, nextHeight)));
            }}
            onPointerUp={(event) => {
              const start = handlePointerStartRef.current;
              handlePointerStartRef.current = null;
              setIsDraggingHandle(false);
              if (!start || event.pointerType !== 'touch') return;
              const deltaY = event.clientY - start.y;
              if (Math.abs(deltaY) >= 5) {
                const nextHeight = Math.max(0, Math.min(start.contentHeight, start.startHeight - deltaY));
                setPanelCollapsed(nextHeight < start.contentHeight / 2);
                suppressHandleClickRef.current = true;
              }
              setHandleDragHeight(null);
            }}
            onPointerCancel={() => {
              handlePointerStartRef.current = null;
              setIsDraggingHandle(false);
              setHandleDragHeight(null);
            }}
            onClick={() => {
              if (suppressHandleClickRef.current) {
                suppressHandleClickRef.current = false;
                return;
              }
              setPanelCollapsed(!isCollapsed);
            }}
          >
            <span className="h-1 w-10 rounded-full bg-slate-300 sm:hidden" />
            <span className="hidden sm:inline-flex">
              {isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </button>
          <div className="order-2 mt-0.5 min-w-0 w-full sm:order-1 sm:mt-0 sm:flex-1">
            <RouteTabs tabs={tabs} activeRouteId={activeRouteId} language={language} onSelect={onSelectRoute} onAdd={onAddRoute} onRemove={onRemoveRoute} />
          </div>
        </div>
      </div>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{
          gridTemplateRows: handleDragHeight !== null
            ? `${handleDragHeight}px`
            : isCollapsed
              ? '0px'
              : panelContentHeight > 0
                ? `${panelContentHeight}px`
                : '1fr',
          transitionDuration: isDraggingHandle ? '0ms' : undefined,
        }}
      >
      <div ref={panelContentRef} className="min-h-0 overflow-hidden">
      {coordinates.length > 1 ? <div className="mx-auto grid max-w-screen-2xl grid-cols-1 gap-3 px-3 pb-3 sm:grid-cols-[112px_minmax(0,1fr)] sm:items-center sm:gap-0 sm:px-3 sm:pb-2">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-1 sm:gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{labels.distance}</p>
            <AnimatedMetric value={stats.distance} format={formatDistance} className="mt-0.5 text-sm font-bold text-slate-900" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{labels.ascent}</p>
            <p className="mt-0.5 text-sm font-bold text-emerald-700">↗ <AnimatedMetric value={stats.ascent} format={(value) => `${Math.round(value)} m`} className="inline-block" /></p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{labels.descent}</p>
            <p className="mt-0.5 text-sm font-bold text-sky-700">↘ <AnimatedMetric value={stats.descent} format={(value) => `${Math.round(value)} m`} className="inline-block" /></p>
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-stretch">
            <div aria-hidden="true" className="relative mr-1 h-24 w-9 shrink-0 sm:h-32">
              <span className={`absolute left-0 top-1/2 -translate-y-1/2 whitespace-nowrap text-[9px] font-semibold text-slate-500 [writing-mode:vertical-rl] ${language === 'zh' ? '' : 'rotate-180'}`}>
                {language === 'zh' ? '海拔（米）' : 'Altitude (m)'}
              </span>
              <div className="absolute inset-y-0 left-3 right-0 text-right text-[9px] leading-none text-slate-500">
                <span className="absolute right-0 top-[17%] -translate-y-1/2">{Math.round(stats.maxElevation)}</span>
                <span className="absolute right-0 top-1/2 -translate-y-1/2">{Math.round((stats.minElevation + stats.maxElevation) / 2)}</span>
                <span className="absolute right-0 top-[83%] -translate-y-1/2">{Math.round(stats.minElevation)}</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <svg ref={chartContainerRef} viewBox="0 0 1000 100" preserveAspectRatio="none" role="img" aria-label={language === 'zh' ? '海拔對距離圖表，包含途經點位置' : 'Altitude by distance chart with waypoint positions'} className="h-24 w-full touch-none select-none overflow-visible sm:h-32" onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                handleChartPointerMove(event);
              }} onPointerMove={handleChartPointerMove} onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
              }} onPointerCancel={() => { setChartHover(null); onHoverRoutePoint(null); }} onPointerLeave={() => { setChartHover(null); onHoverRoutePoint(null); }}>
                <defs><linearGradient id="route-elevation-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#38bdf8" stopOpacity="0.34" /><stop offset="100%" stopColor="#38bdf8" stopOpacity="0.04" /></linearGradient></defs>
                {[18, 53, 88].map((y) => <line key={y} x1="0" x2="1000" y1={y} y2={y} stroke="#cbd5e1" strokeDasharray="3 5" strokeWidth="1" />)}
                <AnimatePresence initial={false} mode="sync">
                  <motion.g
                    key={stats.linePath}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                  >
                    <path d={stats.areaPath} fill="url(#route-elevation-fill)" />
                    <path d={stats.linePath} fill="none" stroke="#0284c7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                    {stats.waypointMarks.map((mark) => <g key={mark.index}>
                      <g transform={`translate(${mark.x} 0) scale(${chartSize.width > 0 ? (chartSize.height / chartSize.width) * (1000 / 100) : 1} 1) translate(${-mark.x} 0)`}>
                        <line x1={mark.x} x2={mark.x} y1="12" y2="94" stroke="#64748b" strokeDasharray="3 4" strokeOpacity="0.65" vectorEffect="non-scaling-stroke" />
                        <circle cx={mark.x} cy={mark.y} r="5" fill="#fff" stroke="#1d4ed8" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        <text x={mark.x} y="10" textAnchor="middle" fill="#1e3a8a" fontSize="10" fontWeight="700">{mark.index + 1}</text>
                      </g>
                    </g>)}
                  </motion.g>
                </AnimatePresence>
                {chartHover && <g pointerEvents="none">
                  <g transform={`translate(${chartHover.x} 0) scale(${chartSize.width > 0 ? (chartSize.height / chartSize.width) * (1000 / 100) : 1} 1) translate(${-chartHover.x} 0)`}>
                    <line x1={chartHover.x} x2={chartHover.x} y1="12" y2="94" stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity="0.8" vectorEffect="non-scaling-stroke" />
                    <circle cx={chartHover.x} cy={chartHover.y} r="5" fill="#fff" stroke="#f59e0b" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                    <text x={chartHover.x} y={Math.max(10, chartHover.y - 8)} textAnchor="middle" fill="#b45309" fontSize="10" fontWeight="700">{Math.round(chartHover.elevation)} m</text>
                    <text x={chartHover.x} y="104" textAnchor={chartHover.x < 60 ? 'start' : chartHover.x > 940 ? 'end' : 'middle'} fill="#b45309" fontSize="10" fontWeight="700">{formatDistance(chartHover.distance)}</text>
                  </g>
                </g>}
              </svg>
              <div className="relative h-3 text-[10px] font-medium text-slate-400">
                <span className="absolute left-0 top-0">0 km</span>
                {stats.waypointMarks
                  .filter((mark) => mark.index > 0 && mark.index < anchors.length - 1)
                  .map((mark) => (
                    <span
                      key={mark.index}
                      className="absolute top-0 -translate-x-1/2 whitespace-nowrap"
                      style={{ left: `${(mark.x / 1000) * 100}%` }}
                    >
                      {formatDistance(mark.distance)}
                    </span>
                  ))}
                <span className="absolute right-0 top-0">{formatDistance(stats.distance)}</span>
              </div>
            </div>
          </div>
        </div>
      </div> : <p className="px-4 pb-3 text-xs font-medium text-slate-500">{language === 'zh' ? '啟用路線規劃後，在地圖上點擊以新增途經點。' : 'Enable routing, then click the map to add waypoints.'}</p>}
      </div>
      </div>
    </section>
  );
}

function downloadRouteGpx(points: RouteCoordinate[]) {
  const trackpoints = points.map(([lon, lat, elevation]) => (
    `<trkpt lat="${lat}" lon="${lon}">${elevation === undefined ? '' : `<ele>${elevation.toFixed(1)}</ele>`}</trkpt>`
  )).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="HK Biodiversity" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>HK Biodiversity route</name><trkseg>${trackpoints}</trkseg></trk></gpx>`;
  const url = URL.createObjectURL(new Blob([xml], { type: 'application/gpx+xml' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'route.gpx';
  link.click();
  URL.revokeObjectURL(url);
}
const LIBERTY_BUILDING_LAYER_ID = 'liberty-buildings-3d';
const THREE_D_TERRAIN_SOURCE_ID = 'terrain-dem-3d';
const THREE_D_TERRAIN_EXAGGERATION = 1.25;
const originalTileZoomFunctions = new WeakMap<
  MapLibreSource,
  CalculateTileZoomFunction | undefined
>();
const fixedTileZoomFunction: CalculateTileZoomFunction = (requestedCenterZoom) => requestedCenterZoom;

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

function updateTileZoomForAllSources(map: MapLibreMap, enabled: boolean) {
  const { sources } = map.getStyle();
  let sourcesUpdated = false;
  for (const sourceId of Object.keys(sources)) {
    const mapSource = map.getSource(sourceId);
    if (!mapSource) continue;

    if (enabled) {
      if (!originalTileZoomFunctions.has(mapSource)) {
        originalTileZoomFunctions.set(mapSource, mapSource.calculateTileZoom);
      }
      if (mapSource.calculateTileZoom !== fixedTileZoomFunction) {
        mapSource.calculateTileZoom = fixedTileZoomFunction;
        sourcesUpdated = true;
      }
    } else if (originalTileZoomFunctions.has(mapSource)) {
      const originalFunction = originalTileZoomFunctions.get(mapSource);
      if (mapSource.calculateTileZoom !== originalFunction) {
        mapSource.calculateTileZoom = originalFunction;
        sourcesUpdated = true;
      }
      originalTileZoomFunctions.delete(mapSource);
    }
  }

  if (sourcesUpdated) map._update();
}

function getLocalizedStyleUrl(url: string, language: 'zh' | 'en') {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}language=${language}`;
}

function getBasemapStyle(
  basemap: (typeof BASEMAPS)[number],
  language: 'zh' | 'en',
): string | StyleSpecification {
  if (basemap.styleUrl) {
    return getLocalizedStyleUrl(basemap.styleUrl, language);
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
  const firstLandsdLabelLayerIndex = layers.findIndex((layer) => (
    'source' in layer
    && typeof layer.source === 'string'
    && layer.source.startsWith('landsd-label-')
  ));
  const firstSymbolLayerIndex = layers.findIndex((layer) => layer.type === 'symbol');
  layers.splice(
    firstLandsdLabelLayerIndex !== -1
      ? firstLandsdLabelLayerIndex
      : firstSymbolLayerIndex === -1 ? layers.length : firstSymbolLayerIndex,
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
  isMobileViewport: boolean;
  onTrackingChange: (isTracking: boolean) => void;
  onSearchActionReady: (stopFollowing: (() => void) | null) => void;
  onError: (code: number) => void;
  onLocationUpdate: (longitude: number, latitude: number) => void;
  onHeadingUpdate: (heading: number | null) => void;
};

function LiveLocationControl({
  language,
  isMobileViewport,
  onTrackingChange,
  onSearchActionReady,
  onError,
  onLocationUpdate,
  onHeadingUpdate,
}: LiveLocationControlProps) {
  const propsRef = useRef({
    language,
    isMobileViewport,
    onTrackingChange,
    onSearchActionReady,
    onError,
    onLocationUpdate,
    onHeadingUpdate,
  });
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const control = useControl(({ mapLib }) => {
    let map: MapLibreMap | null = null;
    let watchId: number | null = null;
    let isTracking = false;
    let shouldFollowLocation = false;
    let locationMarker: MapLibreMarker | null = null;
    let directionMarker: MapLibreMarker | null = null;
    let accuracyMarker: MapLibreMarker | null = null;
    let accuracyElement: HTMLDivElement | null = null;
    let locationAnimationFrame: number | null = null;
    let orientationListener: ((event: DeviceOrientationEvent) => void) | null = null;
    let absoluteOrientationListener: ((event: DeviceOrientationEvent) => void) | null = null;
    let lastReportedHeading: number | null = null;
    let locationAccuracy = 0;
    let button: HTMLButtonElement;

    const stopFollowingLocationOnUserInteraction = (event: { originalEvent: Event | undefined }) => {
      if (isTracking && event.originalEvent) {
        shouldFollowLocation = false;
      }
    };

    const setMarkerLocation = (center: [number, number]) => {
      locationMarker?.setLngLat(center);
      directionMarker?.setLngLat(center);
      accuracyMarker?.setLngLat(center);
      updateAccuracyCircle();
    };

    const animateMarkerLocation = (center: [number, number]) => {
      if (!locationMarker) return;
      if (locationAnimationFrame !== null) {
        cancelAnimationFrame(locationAnimationFrame);
      }

      const start = locationMarker.getLngLat();
      const startLongitude = start.lng;
      const longitudeDelta = ((center[0] - startLongitude + 540) % 360) - 180;
      const startLatitude = start.lat;
      const startedAt = performance.now();
      const duration = 500;
      const animate = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const easedProgress = 1 - (1 - progress) ** 3;
        setMarkerLocation([
          startLongitude + longitudeDelta * easedProgress,
          startLatitude + (center[1] - startLatitude) * easedProgress,
        ]);
        if (progress < 1) {
          locationAnimationFrame = requestAnimationFrame(animate);
        } else {
          locationAnimationFrame = null;
        }
      };

      locationAnimationFrame = requestAnimationFrame(animate);
    };

    const stopOrientationTracking = () => {
      if (orientationListener) {
        window.removeEventListener('deviceorientation', orientationListener);
        orientationListener = null;
      }
      if (absoluteOrientationListener) {
        window.removeEventListener('deviceorientationabsolute', absoluteOrientationListener as EventListener);
        absoluteOrientationListener = null;
      }
      lastReportedHeading = null;
    };

    const updateOrientation = (event: DeviceOrientationEvent, isAbsoluteEvent = false) => {
      if (!isTracking || !locationMarker) return;

      const compassEvent = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
      let heading = compassEvent.webkitCompassHeading;
      if (typeof heading !== 'number' && (event.absolute || isAbsoluteEvent) && typeof event.alpha === 'number') {
        heading = 360 - event.alpha + (screen.orientation?.angle ?? 0);
      }
      if (typeof heading !== 'number' || !Number.isFinite(heading)) return;

      const normalizedHeading = ((heading % 360) + 360) % 360;
      directionMarker?.setRotation(normalizedHeading);
      const roundedHeading = Math.round(normalizedHeading) % 360;
      if (lastReportedHeading !== roundedHeading) {
        lastReportedHeading = roundedHeading;
        propsRef.current.onHeadingUpdate(roundedHeading);
      }
    };

    const startOrientationTracking = () => {
      if (!propsRef.current.isMobileViewport || orientationListener || typeof DeviceOrientationEvent === 'undefined') {
        return;
      }

      orientationListener = (event) => updateOrientation(event);
      absoluteOrientationListener = (event) => updateOrientation(event, true);
      window.addEventListener('deviceorientation', orientationListener, { passive: true });
      window.addEventListener(
        'deviceorientationabsolute',
        absoluteOrientationListener as EventListener,
        { passive: true },
      );
    };

    const requestOrientationPermission = () => {
      if (!propsRef.current.isMobileViewport || typeof DeviceOrientationEvent === 'undefined') return;

      const orientationEvent = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (!orientationEvent.requestPermission) {
        startOrientationTracking();
        return;
      }

      try {
        void orientationEvent.requestPermission().then((permission) => {
          if (permission === 'granted' && isTracking) startOrientationTracking();
        }).catch((error: unknown) => {
          console.warn('Unable to access device orientation.', error);
        });
      } catch (error: unknown) {
        console.warn('Unable to access device orientation.', error);
      }
    };

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
      shouldFollowLocation = false;
      if (locationAnimationFrame !== null) {
        cancelAnimationFrame(locationAnimationFrame);
        locationAnimationFrame = null;
      }
      stopOrientationTracking();
      locationMarker?.remove();
      directionMarker?.remove();
      accuracyMarker?.remove();
      locationMarker = null;
      directionMarker = null;
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
      propsRef.current.onHeadingUpdate(null);
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
        dot.style.zIndex = '3';
        locationMarker = new mapLib.Marker({
          element: dot,
          anchor: 'center',
          pitchAlignment: 'viewport',
        })
          .setLngLat(center)
          .addTo(map);

        accuracyElement = document.createElement('div');
        accuracyElement.className = 'maplibregl-user-location-accuracy-circle';
        accuracyElement.style.zIndex = '1';
        accuracyMarker = new mapLib.Marker({
          element: accuracyElement,
          anchor: 'center',
          pitchAlignment: 'map',
        })
          .setLngLat(center)
          .addTo(map);

        if (propsRef.current.isMobileViewport) {
          const directionMarkerElement = document.createElement('div');
          directionMarkerElement.className = 'maplibregl-user-location-direction-marker';
          directionMarkerElement.style.zIndex = '2';
          const direction = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          direction.setAttribute('viewBox', '0 0 96 96');
          direction.setAttribute('aria-hidden', 'true');
          direction.classList.add('maplibregl-user-location-direction');
          const definitions = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
          const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
          gradient.setAttribute('id', 'maplibregl-user-location-direction-gradient');
          gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
          gradient.setAttribute('cx', '48');
          gradient.setAttribute('cy', '48');
          gradient.setAttribute('r', '64');
          [
            { offset: '0%', opacity: '0.32' },
            { offset: '55%', opacity: '0.16' },
            { offset: '100%', opacity: '0' },
          ].forEach(({ offset, opacity }) => {
            const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop.setAttribute('offset', offset);
            stop.setAttribute('stop-color', '#2563eb');
            stop.setAttribute('stop-opacity', opacity);
            gradient.append(stop);
          });
          definitions.append(gradient);
          direction.append(definitions);
          const fieldOfView = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          fieldOfView.setAttribute('d', 'M48 48 4 25 A57 57 0 0 1 92 25 Z');
          fieldOfView.setAttribute('fill', 'url(#maplibregl-user-location-direction-gradient)');
          direction.append(fieldOfView);
          directionMarkerElement.append(direction);
          directionMarker = new mapLib.Marker({
            element: directionMarkerElement,
            anchor: 'center',
            rotationAlignment: 'map',
            pitchAlignment: 'map',
          })
            .setLngLat(center)
            .addTo(map);
        }
      } else {
        animateMarkerLocation(center);
      }

      if (isFirstLocation) updateAccuracyCircle();

      if (shouldFollowLocation) {
        map.easeTo({
          center,
          zoom: Math.max(map.getZoom(), Math.min(16, map.getMaxZoom())),
          duration: isFirstLocation ? 800 : 500,
        });
      }
      button.classList.remove('maplibregl-ctrl-geolocate-waiting');
      propsRef.current.onLocationUpdate(longitude, latitude);
    };

    return {
      onAdd(nextMap) {
        map = nextMap;
        propsRef.current.onSearchActionReady(() => {
          if (isTracking) shouldFollowLocation = false;
        });
        map.on('zoom', updateAccuracyCircle);
        map.on('move', updateAccuracyCircle);
        map.on('rotate', updateAccuracyCircle);
        map.on('pitch', updateAccuracyCircle);
        map.on('dragstart', stopFollowingLocationOnUserInteraction);
        map.on('zoomstart', stopFollowingLocationOnUserInteraction);
        map.on('boxzoomstart', stopFollowingLocationOnUserInteraction);
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
          shouldFollowLocation = true;
          button.classList.add(
            'maplibregl-ctrl-geolocate-active',
            'maplibregl-ctrl-geolocate-waiting',
          );
          button.setAttribute('aria-pressed', 'true');
          updateButtonLabel(true);
          propsRef.current.onTrackingChange(true);
          requestOrientationPermission();

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
        propsRef.current.onSearchActionReady(null);
        map?.off('zoom', updateAccuracyCircle);
        map?.off('move', updateAccuracyCircle);
        map?.off('rotate', updateAccuracyCircle);
        map?.off('pitch', updateAccuracyCircle);
        map?.off('dragstart', stopFollowingLocationOnUserInteraction);
        map?.off('zoomstart', stopFollowingLocationOnUserInteraction);
        map?.off('boxzoomstart', stopFollowingLocationOnUserInteraction);
        buttonRef.current = null;
        map = null;
      },
    };
  }, { position: 'bottom-right' });

  useEffect(() => {
    propsRef.current = {
      language,
      isMobileViewport,
      onTrackingChange,
      onSearchActionReady,
      onError,
      onLocationUpdate,
      onHeadingUpdate,
    };
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
  }, [control, isMobileViewport, language, onError, onHeadingUpdate, onLocationUpdate, onSearchActionReady, onTrackingChange]);

  return null;
}

export default function MapPageClient() {
  const { language, setLanguage } = useLanguage();
  const offlineRouting = useOfflineRouting();
  const calculateOfflineRoute = offlineRouting.calculateRoute;
  const [currentStyleId, setCurrentStyleId] = useState(DEFAULT_BASEMAP_ID);
  const [isBasemapPickerOpen, setIsBasemapPickerOpen] = useState(false);
  const [hasOpenedBasemapPicker, setHasOpenedBasemapPicker] = useState(false);
  const [isTerrainPickerOpen, setIsTerrainPickerOpen] = useState(false);
  const [isHillshadeEnabled, setIsHillshadeEnabled] = useState(false);
  const [is3DModeEnabled, setIs3DModeEnabled] = useState(false);
  const [areContoursEnabled, setAreContoursEnabled] = useState(true);
  const [demSourceId, setDemSourceId] = useState<DemSourceId>('mapterhorn');
  const [terrainReady, setTerrainReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [routeDirectionImageStyleId, setRouteDirectionImageStyleId] = useState<string | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [isLocationSearchExpanded, setIsLocationSearchExpanded] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSearchResult[]>([]);
  const [selectedLocationResults, setSelectedLocationResults] = useState<LocationSearchResult[]>([]);
  const [isLocationSearchLoading, setIsLocationSearchLoading] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState<string | null>(null);
  const [areLocationSuggestionsOpen, setAreLocationSuggestionsOpen] = useState(false);
  const [isLocationTracking, setIsLocationTracking] = useState(false);
  const [liveLocationCoordinates, setLiveLocationCoordinates] = useState<{
    longitude: number;
    latitude: number;
  } | null>(null);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [isRoutingPanelOpen, setIsRoutingPanelOpen] = useState(false);
  const [routes, setRoutes] = useState<PlannedRoute[]>([{
    id: 'route-1', name: 'Route 1', enabled: false, allowPrivateRoads: false,
    profile: 'foot', anchors: [], routedAnchors: [], coordinates: [], busy: false, error: null,
    useOfflineRouting: false,
  }]);
  const [activeRouteId, setActiveRouteId] = useState('route-1');
  const activeRoute = routes.find((route) => route.id === activeRouteId) ?? routes[0];
  const isRouting = activeRoute.enabled;
  const allowPrivateRoads = activeRoute.allowPrivateRoads;
  const routeProfile = activeRoute.profile;
  const routeAnchors = activeRoute.anchors;
  const routedAnchors = activeRoute.routedAnchors;
  const routeCoordinates = activeRoute.coordinates;
  const routeBusy = activeRoute.busy;
  const routeError = activeRoute.error;
  const updateActiveRoute = useCallback((update: (route: PlannedRoute) => PlannedRoute) => {
    setRoutes((currentRoutes) => currentRoutes.map((route) => (
      route.id === activeRouteId ? update(route) : route
    )));
  }, [activeRouteId]);
  const setIsRouting = useCallback((value: boolean | ((current: boolean) => boolean)) => updateActiveRoute((route) => ({
    ...route, enabled: typeof value === 'function' ? value(route.enabled) : value,
  })), [updateActiveRoute]);
  const setAllowPrivateRoads = useCallback((value: boolean | ((current: boolean) => boolean)) => updateActiveRoute((route) => ({
    ...route, allowPrivateRoads: typeof value === 'function' ? value(route.allowPrivateRoads) : value,
  })), [updateActiveRoute]);
  const setRouteProfile = useCallback((profile: 'foot' | 'bike') => updateActiveRoute((route) => ({ ...route, profile })), [updateActiveRoute]);
  const setRouteAnchors = useCallback((value: RoutePoint[] | ((current: RoutePoint[]) => RoutePoint[])) => updateActiveRoute((route) => ({
    ...route, anchors: typeof value === 'function' ? value(route.anchors) : value,
  })), [updateActiveRoute]);
  const setRoutedAnchors = useCallback((routed: RoutePoint[]) => updateActiveRoute((route) => ({ ...route, routedAnchors: routed })), [updateActiveRoute]);
  const setRouteCoordinates = useCallback((coordinates: RouteCoordinate[]) => updateActiveRoute((route) => ({ ...route, coordinates })), [updateActiveRoute]);
  const setRouteBusy = useCallback((busy: boolean) => updateActiveRoute((route) => ({ ...route, busy })), [updateActiveRoute]);
  const setRouteError = useCallback((error: string | null) => updateActiveRoute((route) => ({ ...route, error })), [updateActiveRoute]);
  const setRouteOfflineMode = useCallback((enabled: boolean) => updateActiveRoute((route) => ({
    ...route,
    useOfflineRouting: enabled,
  })), [updateActiveRoute]);
  const [routeInsertPreview, setRouteInsertPreview] = useState<{ point: RoutePoint; index: number } | null>(null);
  const [routeProfileHover, setRouteProfileHover] = useState<{ coordinate: RoutePoint; distance: number; elevation: number } | null>(null);
  const [waypointMenu, setWaypointMenu] = useState<WaypointMenuState | null>(null);
  const routeRequestId = useRef(0);
  const routeMarkersRef = useRef<MapLibreMarker[]>([]);
  const locationMarkersRef = useRef<MapLibreMarker[]>([]);
  const stopFollowingLiveLocationRef = useRef<(() => void) | null>(null);
  const routeProfileHoverMarkerRef = useRef<MapLibreMarker | null>(null);
  const mapRef = useRef<MapRef>(null);
  const locationSearchInputRef = useRef<HTMLInputElement>(null);
  const isStyleReadyRef = useRef(false);
  const [initialStyle] = useState(() => getBasemapStyle(
    BASEMAPS.find((basemap) => basemap.id === DEFAULT_BASEMAP_ID) || BASEMAPS[0],
    language,
  ));
  const appliedBasemapId = useRef(DEFAULT_BASEMAP_ID);
  const appliedLocalizedBasemapLanguage = useRef(language);
  const registerStopFollowingLiveLocation = useCallback((stopFollowing: (() => void) | null) => {
    stopFollowingLiveLocationRef.current = stopFollowing;
  }, []);
  const showLocationResults = useCallback((results: LocationSearchResult[]) => {
    if (results.length === 0) return;

    stopFollowingLiveLocationRef.current?.();
    setSelectedLocationResults(results);
    setWaypointMenu(null);
    setAreLocationSuggestionsOpen(false);

    const map = mapRef.current?.getMap();
    if (!map) return;
    if (results.length === 1) {
      map.flyTo({ center: results[0].coordinates, zoom: 15, duration: 900 });
      return;
    }

    const longitudes = results.map((result) => result.coordinates[0]);
    const latitudes = results.map((result) => result.coordinates[1]);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)],
    ];
    if (bounds[0][0] === bounds[1][0] && bounds[0][1] === bounds[1][1]) {
      map.flyTo({ center: bounds[0], zoom: 15, duration: 900 });
      return;
    }
    map.fitBounds(bounds, {
      padding: { top: 100, bottom: 80, left: 50, right: 50 },
      maxZoom: 14,
      duration: 900,
    });
  }, []);

  useEffect(() => {
    if (isLocationSearchExpanded) locationSearchInputRef.current?.focus();
  }, [isLocationSearchExpanded]);

  useEffect(() => {
    const query = locationSearchQuery.trim();
    if (query.length < 2) return;

    const controller = new AbortController();
    const bounds = HONG_KONG_SEARCH_BOUNDS;
    const withoutHongKongPrefix = query.replace(/^(?:香港\s+|Hong Kong\s+)/i, '').trim();
    const geocoderQuery = withoutHongKongPrefix.length >= 2 ? withoutHongKongPrefix : query;
    const params = new URLSearchParams({
      q: geocoderQuery,
      limit: '20',
      lang: language === 'zh' ? 'default' : 'en',
      bbox: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
    });

    const timeoutId = window.setTimeout(() => {
      setLocationSuggestions([]);
      setIsLocationSearchLoading(true);
      setLocationSearchError(null);
      fetch(`https://photon.komoot.io/api/?${params.toString()}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Location search failed (${response.status})`);
          }
          return parseLocationSearchResults(await response.json());
        })
        .then((results) => setLocationSuggestions(results))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setLocationSearchError(error instanceof Error
            ? error.message
            : (language === 'zh' ? '搜尋地點時發生錯誤。' : 'Unable to search locations.'));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLocationSearchLoading(false);
        });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [language, locationSearchQuery]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!mapReady || !map || selectedLocationResults.length === 0) return;

    locationMarkersRef.current = selectedLocationResults.map((location) => {
      const marker = new MapLibreMarkerConstructor({ color: '#dc2626', scale: 1.1 })
        .setLngLat(location.coordinates)
        .addTo(map);
      const markerElement = marker.getElement();
      markerElement.setAttribute('aria-label', location.name);
      markerElement.setAttribute('title', location.name);
      markerElement.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setWaypointMenu({
          type: 'location',
          id: location.id,
          x: event.clientX,
          y: event.clientY,
        });
      });
      return marker;
    });

    return () => {
      locationMarkersRef.current.forEach((marker) => marker.remove());
      locationMarkersRef.current = [];
    };
  }, [mapReady, selectedLocationResults]);

  const addRoute = () => {
    const nextRouteNumber = routes.length + 1;
    const newRoute: PlannedRoute = {
      id: `route-${nextRouteNumber}`,
      name: language === 'zh' ? `路線 ${nextRouteNumber}` : `Route ${nextRouteNumber}`,
      enabled: true,
      allowPrivateRoads: false,
      profile: 'foot',
      useOfflineRouting: false,
      anchors: [],
      routedAnchors: [],
      coordinates: [],
      busy: false,
      error: null,
    };
    setRoutes((currentRoutes) => [...currentRoutes, newRoute]);
    setActiveRouteId(newRoute.id);
    setRouteInsertPreview(null);
    setRouteProfileHover(null);
  };
  const removeRoute = (routeId: string) => {
    if (routes.length === 1) {
      setRoutes((currentRoutes) => currentRoutes.map((route) => route.id === routeId ? {
        ...route,
        enabled: false,
        anchors: [],
        routedAnchors: [],
        coordinates: [],
        busy: false,
        error: null,
      } : route));
      setRouteInsertPreview(null);
      setRouteProfileHover(null);
      setWaypointMenu(null);
      return;
    }
    const removedIndex = routes.findIndex((route) => route.id === routeId);
    const remainingRoutes = routes.filter((route) => route.id !== routeId);
    setRoutes(remainingRoutes);
    if (activeRouteId === routeId) {
      setActiveRouteId(remainingRoutes[Math.min(removedIndex, remainingRoutes.length - 1)].id);
    }
    setRouteInsertPreview(null);
    setRouteProfileHover(null);
    setWaypointMenu(null);
  };

  useEffect(() => {
    const requestId = ++routeRequestId.current;
    if (routeAnchors.length < 2) {
      queueMicrotask(() => {
        if (routeRequestId.current === requestId) {
          setRoutedAnchors([]);
          setRouteCoordinates([]);
          setRouteBusy(false);
          setRouteError(null);
        }
      });
      return;
    }
    if (!isRouting) {
      queueMicrotask(() => {
        if (routeRequestId.current === requestId) setRouteBusy(false);
      });
      return;
    }
    const activeRequestId = routeRequestId.current;
    queueMicrotask(() => {
      if (routeRequestId.current === activeRequestId) {
        setRouteBusy(true);
        setRouteError(null);
      }
    });
    const routePromise = activeRoute.useOfflineRouting
      ? calculateOfflineRoute(routeAnchors, routeProfile, allowPrivateRoads)
      : fetch('/api/map/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: routeAnchors,
          profile: routeProfile,
          elevation: true,
          points_encoded: false,
          details: ['road_class', 'surface', 'hike_rating', 'mtb_rating'],
          allowPrivateRoads,
        }),
      }).then(async (response) => {
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || `Route service error (${response.status})`);
        }
        const data = await response.json();
        const coordinates = data?.paths?.[0]?.points?.coordinates;
        if (!Array.isArray(coordinates)) throw new Error('No route found');
        return coordinates as RouteCoordinate[];
      });

    routePromise.then((coordinates) => {
      if (routeRequestId.current === requestId) {
        setRoutedAnchors(routeAnchors);
        setRouteCoordinates(coordinates);
      }
    }).catch((error: unknown) => {
      if (routeRequestId.current === requestId) {
        setRouteError(error instanceof Error ? error.message : 'Unable to calculate route');
      }
    }).finally(() => {
      if (routeRequestId.current === requestId) setRouteBusy(false);
    });
    return () => {
      if (routeRequestId.current === activeRequestId) routeRequestId.current++;
    };
  }, [activeRoute.useOfflineRouting, activeRouteId, allowPrivateRoads, calculateOfflineRoute, isRouting, routeAnchors, routeProfile, setRouteBusy, setRouteCoordinates, setRouteError, setRoutedAnchors]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!mapReady || !map) return;
    routeMarkersRef.current.forEach((marker) => marker.remove());
    routeMarkersRef.current = routeAnchors.map((anchor, index) => {
      const markerPosition = routeAnchors === routedAnchors && routeCoordinates.length > 1
        ? closestRoutePoint(anchor, routeCoordinates)
        : anchor;
      const element = document.createElement('div');
      element.className = 'flex h-[22px] w-[22px] cursor-grab select-none items-center justify-center rounded-full border-[2.5px] border-white bg-blue-600 text-[10px] font-bold leading-none text-white shadow-[0_1px_5px_rgba(15,23,42,0.55)] ring-1 ring-blue-800/70 active:cursor-grabbing';
      element.textContent = String(index + 1);
      element.setAttribute('aria-label', `${language === 'zh' ? '途經點' : 'Waypoint'} ${index + 1}`);
      element.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setWaypointMenu({ type: 'waypoint', index, x: event.clientX, y: event.clientY });
      });
      element.addEventListener('click', (event) => event.stopPropagation());
      element.addEventListener('mousedown', (event) => {
        if (event.button === 2) event.stopPropagation();
      });
      const marker = new MapLibreMarkerConstructor({
        element,
        draggable: true,
        anchor: 'center',
      })
        .setOpacity(1, 1)
        .setLngLat(markerPosition)
        .addTo(map);
      marker.on('dragend', () => {
        const { lng, lat } = marker.getLngLat();
        setRouteAnchors((points) => points.map((point, pointIndex) => (
          pointIndex === index ? [lng, lat] : point
        )));
      });
      return marker;
    });
    return () => {
      routeMarkersRef.current.forEach((marker) => marker.remove());
      routeMarkersRef.current = [];
    };
  }, [activeRouteId, language, mapReady, routeAnchors, routeCoordinates, routedAnchors, setRouteAnchors]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (
      !mapReady
      || !map
      || !isRouting
      || routeCoordinates.length < 2
      || !routeProfileHover
      || !Number.isFinite(routeProfileHover.coordinate[0])
      || !Number.isFinite(routeProfileHover.coordinate[1])
    ) {
      routeProfileHoverMarkerRef.current?.remove();
      routeProfileHoverMarkerRef.current = null;
      return;
    }
    if (!routeProfileHoverMarkerRef.current) {
      const element = document.createElement('div');
      element.className = 'h-4 w-4 rounded-full border-[3px] border-white bg-amber-500 shadow-[0_1px_7px_rgba(15,23,42,0.55)] ring-2 ring-amber-600/70';
      element.style.pointerEvents = 'none';
      element.setAttribute('aria-label', language === 'zh' ? '圖表游標位置' : 'Chart cursor position');
      routeProfileHoverMarkerRef.current = new MapLibreMarkerConstructor({
        element,
        anchor: 'center',
      })
        .setOpacity(1, 1)
        .setLngLat(routeProfileHover.coordinate)
        .addTo(map);
    }
    routeProfileHoverMarkerRef.current.setLngLat(routeProfileHover.coordinate);
  }, [isRouting, language, mapReady, routeCoordinates.length, routeProfileHover]);

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
      if (is3DModeEnabled && isStyleReadyRef.current && map.getTerrain()) {
        map.setTerrain(null);
      }
      isStyleReadyRef.current = false;
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
      if (is3DModeEnabled && isStyleReadyRef.current && map.getTerrain()) {
        map.setTerrain(null);
      }
      isStyleReadyRef.current = false;
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
    const apply3DMode = () => {
      if (!isStyleReadyRef.current) return;

      updateTileZoomForAllSources(map, is3DModeEnabled);

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

    const apply3DModeAfterStyleLoad = () => {
      isStyleReadyRef.current = true;
      apply3DMode();
    };
    const apply3DModeAfterStyleData = () => apply3DMode();
    map.on('style.load', apply3DModeAfterStyleLoad);
    map.on('styledata', apply3DModeAfterStyleData);
    apply3DMode();

    return () => {
      map.off('style.load', apply3DModeAfterStyleLoad);
      map.off('styledata', apply3DModeAfterStyleData);
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

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!mapReady || !map) return;

    const onStyleLoad = () => {
      ensureRouteDirectionImage(map);
      setRouteDirectionImageStyleId(currentStyleId);
    };
    map.on('style.load', onStyleLoad);
    return () => {
      map.off('style.load', onStyleLoad);
    };
  }, [currentStyleId, mapReady]);

  return (
    <div className="map-page relative flex h-dvh w-full flex-col overflow-hidden bg-slate-100">
      {routeBusy && <div className="pointer-events-none fixed inset-x-0 top-0 z-[1000]" role="status" aria-label={language === 'zh' ? '正在計算路線' : 'Calculating route'}>
        <div className="relative h-1 w-full overflow-hidden bg-slate-900/10 shadow-sm">
          <div className="absolute inset-y-0 w-2/5 bg-gradient-to-r from-emerald-400 via-sky-500 to-blue-600 shadow-[0_0_12px_rgba(14,165,233,0.65)]" style={{ animation: 'route-loading 1.25s ease-in-out infinite' }} />
        </div>
      </div>}
      <div className="relative min-h-0 flex-1">
      <Map
        ref={mapRef}
        initialViewState={INITIAL_VIEW_STATE}
        mapStyle={initialStyle}
        attributionControl={false}
        maxZoom={currentStyleId === 'landsd-vector' ? 18.9 : 18}
        minZoom={3}
        reuseMaps
        interactiveLayerIds={routeCoordinates.length > 1 ? [`planned-route-line-${activeRouteId}`] : []}
        onClick={(event) => {
          setWaypointMenu(null);
          setIsBasemapPickerOpen(false);
          setIsTerrainPickerOpen(false);
          if (isRouting) {
            const clickedRoute = event.features?.some((feature) => feature.layer.id === `planned-route-line-${activeRouteId}`);
            if (clickedRoute && routeInsertPreview) {
              setRouteAnchors((points) => [
                ...points.slice(0, routeInsertPreview.index),
                routeInsertPreview.point,
                ...points.slice(routeInsertPreview.index),
              ]);
            } else {
              setRouteAnchors((points) => [...points, [event.lngLat.lng, event.lngLat.lat]]);
            }
            setRouteInsertPreview(null);
          }
        }}
        onMouseMove={(event) => {
          const overRoute = event.features?.some((feature) => feature.layer.id === `planned-route-line-${activeRouteId}`);
          if (!isRouting || !overRoute || routeAnchors.length < 2 || routeCoordinates.length < 2) {
            setRouteInsertPreview(null);
            return;
          }
          const point: RoutePoint = closestRoutePoint([event.lngLat.lng, event.lngLat.lat], routeCoordinates);
          const routeIndex = closestRouteIndex(point, routeCoordinates);
          const anchorRouteIndices = routeAnchors.map((anchor) => closestRouteIndex(anchor, routeCoordinates));
          let insertionIndex = routeAnchors.length;
          for (let index = 0; index < anchorRouteIndices.length - 1; index++) {
            const startIndex = Math.min(anchorRouteIndices[index], anchorRouteIndices[index + 1]);
            const endIndex = Math.max(anchorRouteIndices[index], anchorRouteIndices[index + 1]);
            if (routeIndex >= startIndex && routeIndex <= endIndex) {
              insertionIndex = index + 1;
              break;
            }
          }
          setRouteInsertPreview({ point, index: insertionIndex });
        }}
        onMouseLeave={() => setRouteInsertPreview(null)}
        onLoad={() => {
          initializeContourDemSources();
          const map = mapRef.current?.getMap();
          if (map) {
            ensureRouteDirectionImage(map);
            setRouteDirectionImageStyleId(currentStyleId);
          }
          isStyleReadyRef.current = true;
          if (!window.isSecureContext || !('geolocation' in navigator)) {
            setLocationError(language === 'zh'
              ? '即時定位需要 HTTPS 安全連線及可用的瀏覽器定位服務。'
              : 'Live location requires a secure HTTPS connection and browser location services.');
          }
          setTerrainReady(true);
          setMapReady(true);
        }}
      >
        {routes.map((route, index) => route.coordinates.length > 1 && (
          <Source key={route.id} id={`planned-route-${route.id}`} type="geojson" data={{
            type: 'Feature',
            properties: { routeId: route.id },
            geometry: {
              type: 'LineString',
              coordinates: route.coordinates.map(([longitude, latitude, elevation]) => (
                elevation === undefined
                  ? [longitude, latitude]
                  : [longitude, latitude, elevation]
              )),
            },
          }}>
            <Layer
              id={`planned-route-line-${route.id}`}
              type="line"
              paint={{
                'line-color': getRouteColor(route.id, activeRouteId, index),
                'line-width': route.id === activeRouteId ? 6 : 4.5,
                'line-opacity': route.id === activeRouteId ? 0.95 : 0.68,
              }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
            {routeDirectionImageStyleId === currentStyleId && <Layer
              id={`planned-route-arrows-${route.id}`}
              type="symbol"
              layout={{
                'symbol-placement': 'line',
                'symbol-spacing': 120,
                'icon-image': ROUTE_DIRECTION_IMAGE_ID,
                'icon-size': 0.75,
                'icon-rotation-alignment': 'map',
                'icon-keep-upright': false,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
              }}
            />}
          </Source>
        ))}
        {routeInsertPreview && isRouting && (
          <Source id="route-insert-preview" type="geojson" data={{
            type: 'Feature',
            properties: { label: '+' },
            geometry: { type: 'Point', coordinates: routeInsertPreview.point },
          }}>
            <Layer id="route-insert-preview-circle" type="circle" paint={{ 'circle-radius': 9, 'circle-color': '#ffffff', 'circle-stroke-color': '#2563eb', 'circle-stroke-width': 2, 'circle-opacity': 0.95 }} />
            <Layer id="route-insert-preview-label" type="symbol" layout={{ 'text-field': '+', 'text-size': 14, 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-allow-overlap': true }} paint={{ 'text-color': '#2563eb' }} />
          </Source>
        )}
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
        <NavigationControl position="bottom-right" showCompass showZoom={false} visualizePitch />
        <LiveLocationControl
          language={language}
          isMobileViewport={isMobileViewport}
          onSearchActionReady={registerStopFollowingLiveLocation}
          onTrackingChange={(isTracking) => {
            setIsLocationTracking(isTracking);
            setLiveLocationCoordinates(null);
            setDeviceHeading(null);
          }}
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
          onLocationUpdate={(longitude, latitude) => {
            setLiveLocationCoordinates({ longitude, latitude });
            setLocationError(null);
          }}
          onHeadingUpdate={setDeviceHeading}
        />
        <FullscreenControl position="bottom-right" />
        <ScaleControl position="bottom-left" />
      </Map>
      <div className={`pointer-events-auto absolute left-3 top-3 z-30 overflow-hidden rounded-lg transition-[width] duration-300 ease-in-out ${isLocationSearchExpanded ? 'w-[min(24rem,calc(100vw-5.5rem))]' : 'w-11'}`}>
        <div className={`flex h-11 w-full items-center border border-slate-200 bg-white px-2 text-slate-800 shadow-lg shadow-slate-900/15 ${isLocationSearchExpanded ? 'gap-3' : ''}`}>
          <button
            type="button"
            aria-label={isLocationSearchExpanded
              ? (language === 'zh' ? '在地圖顯示所有搜尋結果' : 'Show all search results on map')
              : (language === 'zh' ? '搜尋地點' : 'Search location')}
            title={isLocationSearchExpanded
              ? (language === 'zh' ? '在地圖顯示所有搜尋結果' : 'Show all search results on map')
              : (language === 'zh' ? '搜尋地點' : 'Search location')}
            onClick={() => {
              if (isLocationSearchExpanded) {
                showLocationResults(locationSuggestions);
              } else {
                setIsLocationSearchExpanded(true);
              }
            }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>
          <AnimatePresence initial={false}>
            {isLocationSearchExpanded && (
              <motion.div
                key="location-search-input"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'auto', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ width: { duration: 0.28, ease: 'easeInOut' }, opacity: { duration: 0.18 } }}
                className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap"
              >
              <input
                ref={locationSearchInputRef}
                type="text"
                role="combobox"
                aria-label={language === 'zh' ? '搜尋香港地點' : 'Search location in Hong Kong'}
                aria-autocomplete="list"
                aria-expanded={areLocationSuggestionsOpen && locationSearchQuery.trim().length >= 2}
                aria-controls="map-location-suggestions"
                aria-busy={isLocationSearchLoading}
                autoComplete="off"
                spellCheck={false}
                value={locationSearchQuery}
                placeholder={language === 'zh' ? '搜尋地點' : 'Search location'}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-500"
                onFocus={() => {
                  if (locationSearchQuery.trim().length >= 2) setAreLocationSuggestionsOpen(true);
                }}
                onChange={(event) => {
                  const query = event.target.value;
                  setLocationSearchQuery(query);
                  setLocationSuggestions([]);
                  setSelectedLocationResults([]);
                  setWaypointMenu(null);
                  setIsLocationSearchLoading(query.trim().length >= 2);
                  setLocationSearchError(null);
                  setAreLocationSuggestionsOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    showLocationResults(locationSuggestions);
                  } else if (event.key === 'Escape') {
                    setAreLocationSuggestionsOpen(false);
                  }
                }}
              />
              {isLocationSearchLoading && (
                <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-slate-500" aria-label={language === 'zh' ? '搜尋中' : 'Searching'} />
              )}
              {locationSearchQuery && (
                <button
                  type="button"
                  aria-label={language === 'zh' ? '清除搜尋' : 'Clear search'}
                  onClick={() => {
                    setLocationSearchQuery('');
                    setLocationSuggestions([]);
                    setSelectedLocationResults([]);
                    setWaypointMenu(null);
                    setIsLocationSearchLoading(false);
                    setLocationSearchError(null);
                    setAreLocationSuggestionsOpen(false);
                  }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                aria-label={language === 'zh' ? '收合搜尋' : 'Collapse search'}
                title={language === 'zh' ? '收合搜尋' : 'Collapse search'}
                onClick={() => {
                  setIsLocationSearchExpanded(false);
                  setAreLocationSuggestionsOpen(false);
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {isLocationSearchExpanded && areLocationSuggestionsOpen && locationSearchQuery.trim().length >= 2 && (
          <div
            id="map-location-suggestions"
            role="listbox"
            aria-label={language === 'zh' ? '地點搜尋結果' : 'Location search results'}
            className="mt-1 max-h-[min(20rem,60vh)] overflow-y-auto rounded-lg border border-slate-200 bg-white text-slate-800 shadow-lg shadow-slate-900/15"
          >
            {isLocationSearchLoading ? (
              <p role="status" className="px-4 py-3 text-sm text-slate-500">
                {language === 'zh' ? '正在搜尋地點…' : 'Searching locations…'}
              </p>
            ) : locationSearchError ? (
              <p role="alert" className="px-4 py-3 text-sm text-red-600">
                {language === 'zh' ? '搜尋地點失敗，請稍後再試。' : 'Location search failed. Please try again.'}
              </p>
            ) : locationSuggestions.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">
                {language === 'zh' ? '找不到香港地點' : 'No locations found in Hong Kong'}
              </p>
            ) : (
              locationSuggestions.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => showLocationResults([location])}
                  className="flex w-full items-center border-t border-slate-100 px-4 py-2.5 text-left transition first:border-t-0 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{location.name}</span>
                    {location.address && (
                      <span className="block truncate text-sm text-slate-500">{location.address}</span>
                    )}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      </div>
      <AnimatePresence initial={false}>
        {isMobileViewport && isLocationTracking && (
          <motion.div
            key="live-location-status"
            initial={{ height: 0, opacity: 0, y: 16 }}
            animate={{ height: 56, opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: 16 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="z-30 shrink-0 overflow-hidden"
          >
            <div className="grid h-14 grid-cols-2 items-center gap-2 border-t border-slate-200 bg-white/95 px-3 text-xs shadow-[0_-2px_8px_rgba(15,23,42,0.08)]">
              <div className="min-w-0">
                <p className="font-semibold text-slate-500">{language === 'zh' ? '定位座標' : 'Coordinates'}</p>
                <p className="truncate font-mono text-slate-800">
                  {liveLocationCoordinates
                    ? `${liveLocationCoordinates.latitude.toFixed(6)}, ${liveLocationCoordinates.longitude.toFixed(6)}`
                    : '--'}
                </p>
              </div>
              <div className="min-w-0 text-right">
                <p className="font-semibold text-slate-500">{language === 'zh' ? '裝置角度' : 'Device heading'}</p>
                <p className="font-mono text-slate-800">
                  {deviceHeading === null ? '--' : `${deviceHeading}°`}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {(routes.length > 1 || routes.some((route) => route.coordinates.length > 1)) && (
        <RouteElevationPanel
          coordinates={routeCoordinates.map(([longitude, latitude, elevation]) => (
            elevation === undefined
              ? [longitude, latitude]
              : [longitude, latitude, elevation]
          ))}
          anchors={routedAnchors}
          language={language}
          tabs={routes.map((route) => ({
            id: route.id,
            name: language === 'zh'
              ? route.name.replace(/^Route/, '路線')
              : route.name.replace(/^路線/, 'Route'),
            busy: route.busy,
            color: getRouteColor(route.id, activeRouteId, routes.indexOf(route)),
          }))}
          activeRouteId={activeRouteId}
          onSelectRoute={(id) => {
            setActiveRouteId(id);
            setRouteInsertPreview(null);
            setRouteProfileHover(null);
            setWaypointMenu(null);
          }}
          onAddRoute={addRoute}
          onRemoveRoute={removeRoute}
          onHoverRoutePoint={setRouteProfileHover}
          mapRef={mapRef}
          mapReady={mapReady}
          isMobileViewport={isMobileViewport}
          isLocationTracking={isLocationTracking}
        />
      )}

      {waypointMenu && (() => {
        const isLocationMarker = waypointMenu.type === 'location';
        const actions = [
          {
            id: 'delete',
            label: language === 'zh'
              ? (isLocationMarker ? '刪除地點標記' : '刪除途經點')
              : (isLocationMarker ? 'Delete location marker' : 'Delete waypoint'),
            icon: <Trash2 className="h-4 w-4" />,
            onSelect: () => {
              if (waypointMenu.type === 'location') {
                setSelectedLocationResults((locations) => locations.filter((location) => location.id !== waypointMenu.id));
              } else {
                setRouteAnchors((points) => points.filter((_, index) => index !== waypointMenu.index));
              }
            },
            destructive: true,
          },
        ];
        return (
          <div
            role="menu"
            aria-label={language === 'zh'
              ? (isLocationMarker ? '地點標記選項' : '途經點選項')
              : (isLocationMarker ? 'Location marker options' : 'Waypoint options')}
            style={{ left: waypointMenu.x, top: waypointMenu.y }}
            className="fixed z-[100] min-w-44 -translate-y-1 rounded-xl border border-slate-200/90 bg-white/95 p-1.5 shadow-xl shadow-slate-900/20 backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  action.onSelect();
                  setWaypointMenu(null);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${action.destructive ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                {action.icon}{action.label}
              </button>
            ))}
          </div>
        );
      })()}

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
            setHasOpenedBasemapPicker(true);
            setIsBasemapPickerOpen((open) => !open);
            setIsTerrainPickerOpen(false);
          }}
          className={MAP_ICON_BUTTON_CLASS}
        >
          <Layers className="h-5 w-5 text-emerald-700" />
        </button>

        {hasOpenedBasemapPicker && (
          <section
            id="map-basemap-picker"
            aria-label={language === 'zh' ? '選擇底圖' : 'Choose a basemap'}
            aria-hidden={!isBasemapPickerOpen}
            inert={!isBasemapPickerOpen}
            className={`pointer-events-auto absolute right-full top-0 mr-3 w-[min(20rem,calc(100vw-6rem))] overflow-hidden rounded-3xl border border-white/70 bg-white/95 p-3 shadow-2xl backdrop-blur-xl ${
              isBasemapPickerOpen ? '' : 'invisible pointer-events-none'
            }`}
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
                          mapStyle={getLocalizedStyleUrl(basemap.previewStyleUrl, language)}
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
        <div className="relative">
          <button type="button" aria-label={language === 'zh' ? '路線規劃' : 'Routing'} aria-expanded={isRoutingPanelOpen} onClick={() => { setIsRoutingPanelOpen((open) => !open); setIsBasemapPickerOpen(false); setIsTerrainPickerOpen(false); }} className={`${MAP_ICON_BUTTON_CLASS} ${isRouting ? '!border-emerald-600 !bg-emerald-600 !text-white hover:!bg-emerald-700' : ''}`}>
            <RouteIcon className="h-5 w-5" />
          </button>
          {isRoutingPanelOpen && <section aria-label={language === 'zh' ? '路線規劃' : 'Routing'} className="pointer-events-auto absolute right-full top-0 mr-3 w-[min(20rem,calc(100vw-6rem))] rounded-2xl border border-white/70 bg-white/95 p-3 shadow-2xl backdrop-blur-xl">
            <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-black text-slate-900"><RouteIcon className="h-4 w-4" />{language === 'zh' ? '路線規劃' : 'Routing'}</h2>
            <div className="mb-2"><RouteTabs
              tabs={routes.map((route) => ({
                id: route.id,
                name: language === 'zh'
                  ? route.name.replace(/^Route/, '路線')
                  : route.name.replace(/^路線/, 'Route'),
                busy: route.busy,
                color: getRouteColor(route.id, activeRouteId, routes.indexOf(route)),
              }))}
              activeRouteId={activeRouteId}
              language={language}
              onSelect={(id) => {
                setActiveRouteId(id);
                setRouteInsertPreview(null);
                setRouteProfileHover(null);
                setWaypointMenu(null);
              }}
              onAdd={addRoute}
            /></div>
            <button type="button" role="switch" aria-checked={isRouting} onClick={() => setIsRouting((active) => !active)} className="flex w-full items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-800">
              <span>{language === 'zh' ? '啟用路線規劃' : 'Enable routing'}</span><span className={`relative h-5 w-9 rounded-full transition ${isRouting ? 'bg-emerald-600' : 'bg-slate-300'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${isRouting ? 'left-[18px]' : 'left-0.5'}`} /></span>
            </button>
            {isRouting && <>
              <CustomDropdown
                options={[
                  { value: 'foot', label: language === 'zh' ? '步行／行山' : 'Walking / hiking' },
                  { value: 'bike', label: language === 'zh' ? '單車' : 'Cycling' },
                ]}
                value={routeProfile}
                onChange={(value) => setRouteProfile(value as 'foot' | 'bike')}
                className="mt-2"
                appearance="map"
                ariaLabel={language === 'zh' ? '活動類型' : 'Activity'}
              />
              <button type="button" role="switch" aria-checked={allowPrivateRoads} onClick={() => setAllowPrivateRoads((allowed) => !allowed)} className="mt-2 flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm font-semibold text-slate-700"><span>{language === 'zh' ? '允許私人道路' : 'Allow private roads'}</span><span className={`relative h-5 w-9 rounded-full transition ${allowPrivateRoads ? 'bg-emerald-600' : 'bg-slate-300'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${allowPrivateRoads ? 'left-[18px]' : 'left-0.5'}`} /></span></button>
              <button
                type="button"
                role="switch"
                aria-checked={activeRoute.useOfflineRouting}
                disabled={offlineRouting.isChecking || offlineRouting.isDownloading}
                onClick={async () => {
                  if (activeRoute.useOfflineRouting) {
                    setRouteOfflineMode(false);
                    return;
                  }
                  if (!offlineRouting.isAvailable && !(await offlineRouting.download())) return;
                  setRouteOfflineMode(true);
                }}
                className={`mt-2 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm font-bold transition disabled:cursor-wait disabled:opacity-70 ${
                  activeRoute.useOfflineRouting
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  {offlineRouting.isDownloading
                    ? <LoaderCircle className="h-4 w-4 animate-spin" />
                    : activeRoute.useOfflineRouting
                      ? <Check className="h-4 w-4" />
                      : <Download className="h-4 w-4" />}
                  {offlineRouting.isChecking
                    ? (language === 'zh' ? '檢查離線路網…' : 'Checking offline network…')
                    : offlineRouting.isDownloading
                      ? (language === 'zh'
                        ? (offlineRouting.isAvailable ? '更新香港離線路網…' : '下載香港離線路網…')
                        : (offlineRouting.isAvailable ? 'Updating Hong Kong network…' : 'Downloading Hong Kong network…'))
                      : activeRoute.useOfflineRouting
                        ? (language === 'zh' ? '離線路線規劃已啟用' : 'Offline routing enabled')
                        : offlineRouting.isAvailable
                          ? (language === 'zh' ? '啟用離線路線規劃' : 'Enable offline routing')
                          : (language === 'zh' ? '下載路網並啟用離線路線規劃' : 'Download network & enable offline routing')}
                </span>
                {!offlineRouting.isChecking && !offlineRouting.isDownloading && (
                  <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                    activeRoute.useOfflineRouting ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
                      activeRoute.useOfflineRouting ? 'left-[18px]' : 'left-0.5'
                    }`} />
                  </span>
                )}
              </button>
              {offlineRouting.isDownloading && (
                <div className="mt-2 px-1" role="status" aria-live="polite">
                  <div
                    className="h-2 overflow-hidden rounded-full bg-slate-200"
                    role="progressbar"
                    aria-label={language === 'zh' ? '下載香港離線路網' : 'Downloading Hong Kong offline network'}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={offlineRouting.downloadProgress ?? undefined}
                  >
                    <div
                      className={`h-full rounded-full bg-emerald-600 transition-[width] duration-300 ${
                        offlineRouting.downloadProgress === null ? 'w-1/3 animate-pulse' : ''
                      }`}
                      style={offlineRouting.downloadProgress === null
                        ? undefined
                        : { width: `${offlineRouting.downloadProgress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-[11px] font-semibold text-slate-600">
                    {offlineRouting.downloadAttempt > 1
                      ? (language === 'zh'
                        ? `連線不穩，正在重試（${offlineRouting.downloadAttempt}/${offlineRouting.maxDownloadAttempts}）…`
                        : `Connection interrupted; retrying (${offlineRouting.downloadAttempt}/${offlineRouting.maxDownloadAttempts})…`)
                      : offlineRouting.downloadProgress !== null && offlineRouting.downloadProgress < 90
                      ? `${offlineRouting.downloadProgress}%`
                      : offlineRouting.downloadProgress !== null && offlineRouting.downloadProgress < 95
                        ? (language === 'zh' ? '正在下載高程資料…' : 'Downloading elevation data…')
                        : offlineRouting.downloadProgress !== null && offlineRouting.downloadProgress < 97
                        ? (language === 'zh' ? '正在整理路網…' : 'Processing road network…')
                        : offlineRouting.downloadProgress !== null
                          ? (language === 'zh' ? '正在儲存到此裝置…' : 'Saving to this device…')
                          : (language === 'zh' ? '下載中…' : 'Downloading…')}
                  </p>
                </div>
              )}
              {offlineRouting.isAvailable && (
                <button
                  type="button"
                  disabled={offlineRouting.isDownloading || offlineRouting.isChecking}
                  onClick={() => { void offlineRouting.download(); }}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${offlineRouting.isDownloading ? 'animate-spin' : ''}`} />
                  {language === 'zh' ? '更新 OpenStreetMap 路網' : 'Update OpenStreetMap network'}
                </button>
              )}
              <p className="px-1 pt-1 text-[11px] leading-4 text-slate-500">
                {language === 'zh'
                  ? '首次使用會下載香港 OpenStreetMap 路網及高程資料並儲存於此裝置；離線路線與線上結果可能不同。'
                  : 'First use downloads Hong Kong OpenStreetMap roads and elevation data to this device. Offline routes may differ from online results.'}
                {' '}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">© OpenStreetMap</a>
                {' · '}<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener noreferrer" className="underline">AWS Terrain Tiles (Mapzen/SRTM)</a>
              </p>
              {offlineRouting.error && (
                <p role="alert" className="mt-1 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700">
                  {language === 'zh' ? '離線路線規劃失敗：' : 'Offline routing failed: '}{offlineRouting.error}
                </p>
              )}
              <p className="px-1 py-2 text-xs text-slate-600">{routeBusy ? (language === 'zh' ? '正在尋找路線…' : 'Finding route…') : (language === 'zh' ? `點擊地圖新增途經點（${routeAnchors.length}）` : `Click map to add waypoint (${routeAnchors.length})`)}</p>
              {routeError && <p role="alert" className="mb-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700">{language === 'zh' ? '尋路失敗：' : 'Routing failed: '}{routeError}</p>}
              <div className="flex gap-2"><button type="button" disabled={!routeCoordinates.length} onClick={() => downloadRouteGpx(routeCoordinates)} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-slate-800 px-2 py-2 text-xs font-bold text-white disabled:opacity-40"><Download className="h-3.5 w-3.5" />GPX</button><button type="button" disabled={!routeAnchors.length} onClick={() => { setRouteAnchors([]); setRouteCoordinates([]); }} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" />{language === 'zh' ? '清除' : 'Clear'}</button></div>
            </>}
          </section>}
        </div>
      </div>

    </div>
  );
}
