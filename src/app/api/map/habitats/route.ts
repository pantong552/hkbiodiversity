import { NextResponse } from 'next/server';
import { HABITAT_MIN_ZOOM, HABITAT_TYPES, type HabitatTypeId } from '@/constants/habitats';

export const runtime = 'nodejs';
export const maxDuration = 60;

const HABITAT_WFS_URL = 'https://portal.csdi.gov.hk/server/services/common/afcd_rcd_1639382960762_55768/MapServer/WFSServer';
const HABITAT_BOUNDS = {
  west: 113.8,
  south: 22.13,
  east: 114.52,
  north: 22.59,
};

type JsonRecord = Record<string, unknown>;
type HabitatFeature = JsonRecord & {
  type: 'Feature';
  geometry: JsonRecord;
  properties: JsonRecord;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHabitatTypeId(value: unknown): value is HabitatTypeId {
  return typeof value === 'string' && HABITAT_TYPES.some((habitat) => habitat.id === value);
}

function isHabitatRequest(value: unknown): value is {
  type: HabitatTypeId;
  bbox: [number, number, number, number];
  zoom: number;
} {
  if (
    !isRecord(value)
    || !isHabitatTypeId(value.type)
    || !Array.isArray(value.bbox)
    || value.bbox.length !== 4
  ) return false;
  const [west, south, east, north] = value.bbox;
  return [west, south, east, north].every((coordinate) => (
    typeof coordinate === 'number' && Number.isFinite(coordinate)
  ))
    && west >= -180
    && west < east
    && east <= 180
    && south >= -90
    && south < north
    && north <= 90
    && typeof value.zoom === 'number'
    && Number.isFinite(value.zoom)
    && value.zoom >= HABITAT_MIN_ZOOM
    && value.zoom <= 22;
}

function isFeatureCollection(
  value: unknown,
): value is JsonRecord & { features: HabitatFeature[] } {
  return isRecord(value)
    && value.type === 'FeatureCollection'
    && Array.isArray(value.features)
    && value.features.every((feature): feature is HabitatFeature => (
      isRecord(feature)
      && feature.type === 'Feature'
      && isRecord(feature.geometry)
      && isRecord(feature.properties)
    ));
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isHabitatRequest(body)) {
    return NextResponse.json({ error: 'Invalid habitat query' }, { status: 400 });
  }

  const [west, south, east, north] = body.bbox;
  const bbox = {
    west: Math.max(west, HABITAT_BOUNDS.west),
    south: Math.max(south, HABITAT_BOUNDS.south),
    east: Math.min(east, HABITAT_BOUNDS.east),
    north: Math.min(north, HABITAT_BOUNDS.north),
  };
  if (bbox.west >= bbox.east || bbox.south >= bbox.north) {
    return NextResponse.json({ type: 'FeatureCollection', features: [] });
  }

  const filter = [
    '<Filter><Intersects><PropertyName>SHAPE</PropertyName>',
    `<gml:Envelope srsName='EPSG:4326'><gml:lowerCorner>${bbox.south} ${bbox.west}</gml:lowerCorner>`,
    `<gml:upperCorner>${bbox.north} ${bbox.east}</gml:upperCorner></gml:Envelope>`,
    '</Intersects></Filter>',
  ].join('');
  const habitat = HABITAT_TYPES.find(({ id }) => id === body.type);
  if (!habitat) {
    return NextResponse.json({ error: 'Invalid habitat type' }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({
      service: 'wfs',
      request: 'GetFeature',
      typenames: habitat.id,
      outputFormat: 'geojson',
      count: '10000',
      srsName: 'EPSG:4326',
      filter,
    });
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(60000)]);
    const wfsRequestStartedAt = performance.now();
    const response = await fetch(`${HABITAT_WFS_URL}?${params}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; HKBioDiversity/1.0; +https://portal.csdi.gov.hk/)',
      },
      signal,
    });
    const wfsResponseHeadersMs = performance.now() - wfsRequestStartedAt;
    if (response.status === 403 || response.status === 429 || response.status === 503) {
      console.warn(`CSDI WFS temporarily rejected ${habitat.id} (${response.status})`);
      return NextResponse.json(
        { error: `CSDI temporarily rejected ${habitat.id}` },
        {
          status: response.status === 429 ? 429 : 503,
          headers: { 'Retry-After': response.headers.get('retry-after') ?? '2' },
        },
      );
    }
    if (!response.ok) {
      throw new Error(`CSDI WFS request failed for ${habitat.id} (${response.status})`);
    }

    const wfsBodyAndParseStartedAt = performance.now();
    const collection: unknown = await response.json();
    const wfsBodyAndParseMs = performance.now() - wfsBodyAndParseStartedAt;
    if (!isFeatureCollection(collection)) {
      throw new Error(`CSDI WFS returned invalid GeoJSON for ${habitat.id}`);
    }

    console.info('[habitat-performance]', {
      stage: 'wfs-response',
      type: habitat.id,
      responseHeadersMs: Math.round(wfsResponseHeadersMs),
      bodyReadAndJsonParseMs: Math.round(wfsBodyAndParseMs),
      contentLength: response.headers.get('content-length'),
      featureCount: collection.features.length,
    });

    return NextResponse.json(collection);
  } catch (error) {
    console.error('Failed to fetch CSDI habitat features:', error);
    return NextResponse.json(
      { error: 'Unable to load habitat data from CSDI' },
      { status: 502 },
    );
  }
}
