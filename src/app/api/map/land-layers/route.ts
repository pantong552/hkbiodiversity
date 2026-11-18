import { NextResponse } from 'next/server';
import proj4 from 'proj4';

export const runtime = 'nodejs';
export const maxDuration = 60;

const LOT_MAP_SERVER = 'https://www.map.gov.hk/arcgis2/rest/services/rGeoInfoMap/rgeo_highlight_d00/MapServer';
const GLA_LAYER_ROOT = 'https://api.hkmapservice.gov.hk/ags/map/layer/ls/gla_geoinfomap';
const LOT_MIN_ZOOM = 15;
const GLA_MIN_ZOOM = 11;
const GLA_PAGE_SIZE = 1000;
const GLA_MAX_FEATURES = 10000;
const HONG_KONG_BOUNDS = {
  west: 113.75,
  south: 22.15,
  east: 114.52,
  north: 22.58,
};
const WEB_MERCATOR_LIMIT = 20037508.342789244;
const WGS84_PROJECTION = '+proj=longlat +datum=WGS84 +no_defs +type=crs';
const HK1980_PROJECTION = '+proj=tmerc +lat_0=22.3121333333333 +lon_0=114.178555555556 +k=1 +x_0=836694.05 +y_0=819069.8 +ellps=intl +towgs84=-162.619,-276.959,-161.764,-0.067753,2.243648,1.158828,-1.094246 +units=m +no_defs +type=crs';

type JsonRecord = Record<string, unknown>;
type Position = [number, number];
type PolygonCoordinates = Position[][];
type GlaGeometry =
  | { type: 'Polygon'; coordinates: PolygonCoordinates }
  | { type: 'MultiPolygon'; coordinates: PolygonCoordinates[] };
type GlaFeature = {
  type: 'Feature';
  id?: string | number;
  geometry: GlaGeometry;
  properties: JsonRecord;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseInteger(value: string | null, min: number, max: number) {
  if (value === null || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null;
}

function parseNumberList(value: string | null, length: number) {
  if (value === null) return null;
  const values = value.split(',').map(Number);
  return values.length === length && values.every(Number.isFinite) ? values : null;
}

function getGlaLayerId(zoom: number, latitude: number) {
  const scale = 591657550.5 * Math.cos(latitude * Math.PI / 180) / 2 ** (zoom + 1);
  if (scale > 20000) return 0;
  if (scale > 4500) return 1;
  return 2;
}

function parsePosition(value: unknown): Position {
  const coordinates = typeof value === 'string'
    ? value.trim().split(/\s+/).slice(0, 2).map(Number)
    : Array.isArray(value) ? value.slice(0, 2).map(Number) : [];
  if (
    coordinates.length !== 2
    || !coordinates.every(Number.isFinite)
    || coordinates[0] < -180
    || coordinates[0] > 180
    || coordinates[1] < -90
    || coordinates[1] > 90
  ) {
    throw new Error('LandsD returned an invalid GLA coordinate');
  }
  return [coordinates[0], coordinates[1]];
}

function getRingArea(ring: Position[]) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function containsPoint(ring: Position[], point: Position) {
  let isInside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[previous];
    const crosses = (y1 > point[1]) !== (y2 > point[1])
      && point[0] < ((x2 - x1) * (point[1] - y1)) / (y2 - y1) + x1;
    if (crosses) isInside = !isInside;
  }
  return isInside;
}

function orientRing(ring: Position[], counterClockwise: boolean) {
  const isCounterClockwise = getRingArea(ring) > 0;
  return isCounterClockwise === counterClockwise ? ring : [...ring].reverse();
}

function toGlaGeometry(value: unknown): GlaGeometry {
  if (!isRecord(value) || !Array.isArray(value.rings)) {
    throw new Error('LandsD returned a GLA feature without polygon rings');
  }

  const rings = value.rings.map((ring) => {
    if (!Array.isArray(ring)) {
      throw new Error('LandsD returned an invalid GLA polygon ring');
    }
    const parsedRing = ring.map(parsePosition);
    if (parsedRing.length < 4) {
      throw new Error('LandsD returned an incomplete GLA polygon ring');
    }
    return parsedRing;
  });
  const outerRings = rings.filter((ring) => getRingArea(ring) < 0);
  const holes = rings.filter((ring) => getRingArea(ring) >= 0);
  const polygons: PolygonCoordinates[] = (outerRings.length > 0 ? outerRings : rings)
    .map((ring) => [orientRing(ring, true)]);

  if (outerRings.length > 0) {
    for (const hole of holes) {
      const containingPolygon = polygons
        .map((polygon, index) => ({ index, area: Math.abs(getRingArea(polygon[0])) }))
        .filter(({ index }) => containsPoint(outerRings[index], hole[0]))
        .sort((left, right) => left.area - right.area)[0];
      if (containingPolygon) {
        polygons[containingPolygon.index].push(orientRing(hole, false));
      } else {
        polygons.push([orientRing(hole, true)]);
      }
    }
  }

  return polygons.length === 1
    ? { type: 'Polygon', coordinates: polygons[0] }
    : { type: 'MultiPolygon', coordinates: polygons };
}

function toGlaFeature(value: unknown): GlaFeature {
  if (!isRecord(value) || !isRecord(value.attributes)) {
    throw new Error('LandsD returned an invalid GLA feature');
  }
  const attributes = value.attributes;
  const rawLabel = attributes.cislotdisplayname
    ?? attributes.CISLOTDISPLAYNAME
    ?? attributes.glanumber
    ?? attributes.GLANUMBER;
  const properties = {
    ...attributes,
    label: typeof rawLabel === 'string' || typeof rawLabel === 'number'
      ? String(rawLabel)
      : '',
  };
  const id = attributes.objectid ?? attributes.OBJECTID ?? attributes.glaid ?? attributes.GLAID;

  return {
    type: 'Feature',
    ...(typeof id === 'string' || typeof id === 'number' ? { id } : {}),
    geometry: toGlaGeometry(value.geometry),
    properties,
  };
}

function toTileBounds(z: number, x: number, y: number) {
  const tileCount = 2 ** z;
  const tileSize = (WEB_MERCATOR_LIMIT * 2) / tileCount;
  const minX = -WEB_MERCATOR_LIMIT + x * tileSize;
  const maxX = minX + tileSize;
  const maxY = WEB_MERCATOR_LIMIT - y * tileSize;
  const minY = maxY - tileSize;
  const mercatorToWgs84 = ([easting, northing]: Position): Position => [
    (easting / 6378137) * 180 / Math.PI,
    (2 * Math.atan(Math.exp(northing / 6378137)) - Math.PI / 2) * 180 / Math.PI,
  ];
  const edgeSamples: Position[] = [
    [minX, minY],
    [minX, (minY + maxY) / 2],
    [minX, maxY],
    [(minX + maxX) / 2, minY],
    [(minX + maxX) / 2, maxY],
    [maxX, minY],
    [maxX, (minY + maxY) / 2],
    [maxX, maxY],
  ];
  const wgs84Samples: Position[] = edgeSamples.map(mercatorToWgs84);
  const hk1980Coordinates = wgs84Samples.map((coordinates) => (
    proj4(WGS84_PROJECTION, HK1980_PROJECTION, coordinates)
  ));
  const eastings = hk1980Coordinates.map(([easting]) => easting);
  const northings = hk1980Coordinates.map(([, northing]) => northing);
  return [
    Math.min(...eastings),
    Math.min(...northings),
    Math.max(...eastings),
    Math.max(...northings),
  ].join(',');
}

async function getLotTile(request: Request, url: URL) {
  const z = parseInteger(url.searchParams.get('z'), LOT_MIN_ZOOM, 22);
  const x = parseInteger(url.searchParams.get('x'), 0, 2 ** 22 - 1);
  const y = parseInteger(url.searchParams.get('y'), 0, 2 ** 22 - 1);
  if (z === null || x === null || y === null || x >= 2 ** z || y >= 2 ** z) {
    return NextResponse.json({ error: 'Invalid LOT tile coordinates' }, { status: 400 });
  }

  const params = new URLSearchParams({
    bbox: toTileBounds(z, x, y),
    bboxSR: '2326',
    imageSR: '2326',
    size: '256,256',
    dpi: '96',
    format: 'png32',
    transparent: 'true',
    layers: 'show:107,108',
    f: 'image',
  });
  const response = await fetch(`${LOT_MAP_SERVER}/export?${params}`, {
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
  });
  if (!response.ok) {
    throw new Error(`Official LOT map export failed (${response.status})`);
  }

  return new NextResponse(await response.arrayBuffer(), {
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'image/png',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

async function getGlaFeatures(request: Request, url: URL) {
  const bbox = parseNumberList(url.searchParams.get('bbox'), 4);
  const zoomValue = Number(url.searchParams.get('zoom'));
  if (
    !bbox
    || !bbox.every(Number.isFinite)
    || bbox[0] >= bbox[2]
    || bbox[1] < -90
    || bbox[1] >= bbox[3]
    || bbox[3] > 90
    || !Number.isFinite(zoomValue)
    || zoomValue < GLA_MIN_ZOOM
    || zoomValue > 22
  ) {
    return NextResponse.json({ error: 'Invalid GLA map extent' }, { status: 400 });
  }

  const clippedBounds = [
    Math.max(bbox[0], HONG_KONG_BOUNDS.west),
    Math.max(bbox[1], HONG_KONG_BOUNDS.south),
    Math.min(bbox[2], HONG_KONG_BOUNDS.east),
    Math.min(bbox[3], HONG_KONG_BOUNDS.north),
  ];
  if (clippedBounds[0] >= clippedBounds[2] || clippedBounds[1] >= clippedBounds[3]) {
    return NextResponse.json({ type: 'FeatureCollection', features: [] });
  }

  const apiKey = process.env.HKMAPSERVICE_API_KEY;
  if (!apiKey) {
    throw new Error('HKMAPSERVICE_API_KEY is not configured');
  }

  const layerId = getGlaLayerId(zoomValue, (clippedBounds[1] + clippedBounds[3]) / 2);
  const features: GlaFeature[] = [];
  const params = new URLSearchParams({
    where: '1=1',
    geometry: clippedBounds.join(','),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'GLAID,GLANUMBER,GLANUMBERALPHA,CISLOTDISPLAYNAME',
    returnGeometry: 'true',
    outSR: '4326',
    resultRecordCount: String(GLA_PAGE_SIZE),
    f: 'json',
    key: apiKey,
  });
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    params.set('resultOffset', String(offset));
    const response = await fetch(`${GLA_LAYER_ROOT}/${layerId}/query?${params}`, {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Official GLA query failed (${response.status})`);
    }

    const result: unknown = await response.json();
    if (
      !isRecord(result)
      || !Array.isArray(result.features)
      || (isRecord(result.error))
    ) {
      throw new Error('LandsD returned an invalid GLA query response');
    }

    const page = result.features.map(toGlaFeature);
    features.push(...page);
    hasMore = result.exceededTransferLimit === true && page.length > 0;
    offset += page.length;
    if (hasMore && features.length >= GLA_MAX_FEATURES) {
      throw new Error(`GLA query exceeded the ${GLA_MAX_FEATURES} feature limit`);
    }
  }

  return NextResponse.json(
    { type: 'FeatureCollection', features },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    if (type === 'lot') return await getLotTile(request, url);
    if (type === 'gla') return await getGlaFeatures(request, url);
    return NextResponse.json({ error: 'Invalid land layer type' }, { status: 400 });
  } catch (error) {
    console.error('Failed to fetch LandsD land layer:', error);
    return NextResponse.json(
      { error: 'Unable to load LandsD land layer' },
      { status: 502 },
    );
  }
}
