import { NextResponse } from 'next/server';

const LANDSD_API_ROOT = 'https://mapapi.hkmapservice.gov.hk/gs/api/v1.0.0/vt';
const BASEMAP_STYLE_URL = `${LANDSD_API_ROOT}/basemap/wgs84/resources/styles/root.json`;
const BASEMAP_TILE_URL = `${LANDSD_API_ROOT}/basemap/wgs84/tile/{z}/{y}/{x}.pbf`;
const LANDSD_API_STYLE_ROOT = 'https://api.hkmapservice.gov.hk/ags/map';
const RASTER_BASEMAPS = {
  'hk-vector': {
    sourceId: 'hk-vector-base',
    tiles: 'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/basemap/wgs84/{z}/{x}/{y}.png',
  },
  'hk-imagery': {
    sourceId: 'hk-imagery-base',
    tiles: 'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/imagery/wgs84/{z}/{x}/{y}.png',
  },
} as const;
type RasterBasemapId = keyof typeof RASTER_BASEMAPS;

type JsonRecord = Record<string, unknown>;

function isRasterBasemapId(value: string): value is RasterBasemapId {
  return Object.hasOwn(RASTER_BASEMAPS, value);
}

type StyleDocument = JsonRecord & {
  sources: JsonRecord;
  layers: unknown[];
  glyphs: string;
  sprite: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStyleDocument(value: unknown): value is StyleDocument {
  return isRecord(value)
    && isRecord(value.sources)
    && Array.isArray(value.layers)
    && typeof value.glyphs === 'string'
    && typeof value.sprite === 'string';
}

async function fetchStyle(url: string | URL): Promise<StyleDocument> {
  const response = await fetch(url, { next: { revalidate: 86400 } });
  if (!response.ok) {
    throw new Error(`LandsD style request failed (${response.status})`);
  }

  const style: unknown = await response.json();
  if (!isStyleDocument(style)) {
    throw new Error('LandsD returned an invalid style');
  }

  return style;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const language = requestUrl.searchParams.get('language') === 'zh' ? 'tc' : 'en';
    const requestedBasemapId = requestUrl.searchParams.get('basemap');
    if (requestedBasemapId !== null && !isRasterBasemapId(requestedBasemapId)) {
      return NextResponse.json({ error: 'Invalid LandsD raster basemap' }, { status: 400 });
    }

    const apiKey = process.env.HKMAPSERVICE_API_KEY;
    if (!apiKey) {
      throw new Error('HKMAPSERVICE_API_KEY is not configured');
    }

    const labelStyleUrl = new URL(
      `${LANDSD_API_STYLE_ROOT}/label-${language}/VT/Indexed/WGS84/resources/styles/root.json`,
    );
    labelStyleUrl.searchParams.set('key', apiKey);
    const origin = requestUrl.origin;
    const labelTileUrl = new URL(
      `/api/map/landsd-vector/labels/${language}/{z}/{y}/{x}.pbf`,
      origin,
    ).href.replace(/%7B|%7D/gi, (match) => (match.toLowerCase() === '%7b' ? '{' : '}'));
    const labelGlyphUrl = new URL(
      `/api/map/landsd-vector/fonts/${language}/{fontstack}/{range}.pbf`,
      origin,
    ).href.replace(/%7B|%7D/gi, (match) => (match.toLowerCase() === '%7b' ? '{' : '}'));
    const [landsdVectorStyle, labelStyle] = await Promise.all([
      fetchStyle(BASEMAP_STYLE_URL),
      fetchStyle(labelStyleUrl),
    ]);
    const rasterBasemap = requestedBasemapId
      ? RASTER_BASEMAPS[requestedBasemapId]
      : undefined;
    const basemapStyle = rasterBasemap
      ? {
        ...landsdVectorStyle,
        sources: {
          [rasterBasemap.sourceId]: {
            type: 'raster',
            tiles: [rasterBasemap.tiles],
            tileSize: 256,
            attribution: '&copy; HKSAR',
          },
        },
        layers: [{
          id: rasterBasemap.sourceId,
          type: 'raster',
          source: rasterBasemap.sourceId,
          minzoom: 0,
          maxzoom: 20,
        }],
      }
      : landsdVectorStyle;

    const sourceEntries = Object.entries(basemapStyle.sources);
    const labelSourceEntries = Object.entries(labelStyle.sources).map(([id, source]) => {
      if (!isRecord(source)) {
        throw new Error(`LandsD label style has an invalid source: ${id}`);
      }
      return [
        `landsd-label-${id}`,
        {
          ...Object.fromEntries(Object.entries(source).filter(([key]) => key !== 'url')),
          tiles: [labelTileUrl],
          maxzoom: 16,
        },
      ];
    });

    const layerIds = new Set<string>();
    const layers = [...basemapStyle.layers];
    for (const layer of layers) {
      if (!isRecord(layer) || typeof layer.id !== 'string') {
        throw new Error('LandsD basemap style has an invalid layer');
      }
      if (
        typeof layer.source === 'string'
        && !Object.hasOwn(basemapStyle.sources, layer.source)
      ) {
        throw new Error(`LandsD basemap layer references an unknown source: ${layer.source}`);
      }
      layerIds.add(layer.id);
    }

    for (const layer of labelStyle.layers) {
      if (
        !isRecord(layer)
        || typeof layer.id !== 'string'
        || typeof layer.source !== 'string'
      ) {
        throw new Error('LandsD label style has an invalid layer');
      }
      if (!Object.hasOwn(labelStyle.sources, layer.source)) {
        throw new Error(`LandsD label layer references an unknown source: ${layer.source}`);
      }
      if (layerIds.has(layer.id)) {
        throw new Error(`LandsD styles contain a duplicate layer id: ${layer.id}`);
      }
      layerIds.add(layer.id);
      layers.push({ ...layer, source: `landsd-label-${layer.source}` });
    }

    const sources = Object.fromEntries([
      ...sourceEntries.map(([id, source]) => {
        if (!isRecord(source)) {
          throw new Error(`LandsD basemap style has an invalid source: ${id}`);
        }
        const sourceConfig = Object.fromEntries(
          Object.entries(source).filter(([key]) => key !== 'url'),
        );
        return [
          id,
          sourceConfig.type === 'raster'
            ? sourceConfig
            : { ...sourceConfig, tiles: [BASEMAP_TILE_URL], maxzoom: 15 },
        ];
      }),
      ...labelSourceEntries,
    ]);
    const style = {
      ...basemapStyle,
      sources,
      layers,
      glyphs: labelGlyphUrl,
      sprite: new URL(basemapStyle.sprite, BASEMAP_STYLE_URL).href,
    };

    return NextResponse.json(style, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' },
    });
  } catch (error) {
    console.error('Failed to prepare LandsD Vector style:', error);
    return NextResponse.json(
      { error: 'Unable to prepare LandsD Vector style' },
      { status: 502 },
    );
  }
}
