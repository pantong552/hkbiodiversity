import type { StyleSpecification } from 'maplibre-gl';

type Basemap = {
  id: string;
  name: { zh: string; en: string };
  preview: string;
  attributionText: string;
  style: StyleSpecification;
  styleUrl?: string;
};

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
  hkLabel: 'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/label/hk/en/wgs84/{z}/{x}/{y}.png',
};

function createRasterStyle(
  sources: { id: string; tiles: string[]; attribution?: string }[],
): StyleSpecification {
  return {
    version: 8,
    sources: sources.reduce<NonNullable<StyleSpecification['sources']>>((result, source) => ({
      ...result,
      [source.id]: {
        type: 'raster',
        tiles: source.tiles,
        tileSize: 256,
        attribution: source.attribution || '',
      },
    }), {}),
    layers: sources.map((source) => ({
      id: source.id,
      type: 'raster',
      source: source.id,
      minzoom: 0,
      maxzoom: 20,
    })),
  };
}

export const BASEMAPS: Basemap[] = [
  {
    id: 'carto-light',
    name: { zh: 'Carto 亮色', en: 'Carto Light' },
    preview: `https://a.basemaps.cartocdn.com/light_all/13/6694/3574.png${CARTO_KEY_PARAM}`,
    attributionText: '© CARTO | MapLibre',
    style: createRasterStyle([{ id: 'carto-light', tiles: [MAP_SOURCES.cartoLight], attribution: '&copy; CARTO' }]),
  },
  {
    id: 'carto-dark',
    name: { zh: 'Carto 深色', en: 'Carto Dark' },
    preview: `https://a.basemaps.cartocdn.com/dark_all/13/6694/3574.png${CARTO_KEY_PARAM}`,
    attributionText: '© CARTO | MapLibre',
    style: createRasterStyle([{ id: 'carto-dark', tiles: [MAP_SOURCES.cartoDark], attribution: '&copy; CARTO' }]),
  },
  {
    id: 'osm',
    name: { zh: 'OpenStreetMap', en: 'OpenStreetMap' },
    preview: 'https://tile.openstreetmap.org/13/6694/3574.png',
    attributionText: '© OpenStreetMap | MapLibre',
    style: createRasterStyle([{ id: 'osm', tiles: [MAP_SOURCES.osm], attribution: '&copy; OSM' }]),
  },
  {
    id: 'openmaptiles-topo',
    name: { zh: 'OpenMapTiles OSM 地形', en: 'OpenMapTiles OSM Topo' },
    preview: 'https://tile.openstreetmap.org/13/6694/3574.png',
    attributionText: '© OpenMapTiles | © OpenStreetMap | © Mapterhorn',
    style: createRasterStyle([{ id: 'openmaptiles-topo-preview', tiles: [MAP_SOURCES.osm], attribution: '&copy; OpenStreetMap' }]),
    styleUrl: '/api/map/osm-topo',
  },
  {
    id: 'esri-sat',
    name: { zh: 'Esri 衛星圖', en: 'Esri Satellite' },
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/3574/6694',
    attributionText: '© Esri | MapLibre',
    style: createRasterStyle([{ id: 'esri-sat', tiles: [MAP_SOURCES.esri], attribution: '&copy; Esri' }]),
  },
  {
    id: 'google-streets',
    name: { zh: 'Google 街道', en: 'Google Streets' },
    preview: 'https://mt1.google.com/vt/lyrs=m&x=6694&y=3574&z=13',
    attributionText: '© Google Maps | MapLibre',
    style: createRasterStyle([{ id: 'google-streets', tiles: [MAP_SOURCES.googleStreets], attribution: '&copy; Google' }]),
  },
  {
    id: 'google-sat',
    name: { zh: 'Google 衛星', en: 'Google Satellite' },
    preview: 'https://mt1.google.com/vt/lyrs=s&x=6694&y=3574&z=13',
    attributionText: '© Google Maps | MapLibre',
    style: createRasterStyle([{ id: 'google-sat', tiles: [MAP_SOURCES.googleSatellite], attribution: '&copy; Google' }]),
  },
  {
    id: 'google-hybrid',
    name: { zh: 'Google 混合', en: 'Google Hybrid' },
    preview: 'https://mt1.google.com/vt/lyrs=y&x=6694&y=3574&z=13',
    attributionText: '© Google Maps | MapLibre',
    style: createRasterStyle([{ id: 'google-hybrid', tiles: [MAP_SOURCES.googleHybrid], attribution: '&copy; Google' }]),
  },
  {
    id: 'google-terrain',
    name: { zh: 'Google 地形', en: 'Google Terrain' },
    preview: 'https://mt1.google.com/vt/lyrs=p&x=6694&y=3574&z=13',
    attributionText: '© Google Maps | MapLibre',
    style: createRasterStyle([{ id: 'google-terrain', tiles: [MAP_SOURCES.googleTerrain], attribution: '&copy; Google' }]),
  },
  {
    id: 'hk-vector',
    name: { zh: '香港政府向量', en: 'HK Vector' },
    preview: `https://a.basemaps.cartocdn.com/light_all/13/6694/3574.png${CARTO_KEY_PARAM}`,
    attributionText: '© Lands Department (HKSAR) | MapLibre',
    style: createRasterStyle([
      { id: 'hk-vector-base', tiles: [MAP_SOURCES.hkVector], attribution: '&copy; HKSAR' },
      { id: 'hk-vector-label', tiles: [MAP_SOURCES.hkLabel], attribution: '' },
    ]),
  },
  {
    id: 'hk-imagery',
    name: { zh: '香港政府影像', en: 'HK Imagery' },
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/3574/6694',
    attributionText: '© Lands Department (HKSAR) | MapLibre',
    style: createRasterStyle([
      { id: 'hk-imagery-base', tiles: [MAP_SOURCES.hkImagery], attribution: '&copy; HKSAR' },
      { id: 'hk-imagery-label', tiles: [MAP_SOURCES.hkLabel], attribution: '' },
    ]),
  },
];
