import { NextResponse } from 'next/server';

const GPX_TILEJSON_URL = 'https://tiles.gpx.studio';
const TILE_SOURCE_IDS = new Set(['openmaptiles', 'hillshading', 'contours_m', 'contours_ft']);

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  try {
    const response = await fetch('https://styles.gpx.studio/osm-topo.json', {
      next: { revalidate: 86400 },
    });
    if (!response.ok) {
      console.error(`GPX Studio style request failed with status ${response.status}`);
      return NextResponse.json({ error: 'Unable to load OpenMapTiles OSM Topo style' }, { status: 502 });
    }

    const style: unknown = await response.json();
    if (
      !isRecord(style)
      || !isRecord(style.sources)
      || !Array.isArray(style.layers)
      || typeof style.glyphs !== 'string'
      || typeof style.sprite !== 'string'
    ) {
      console.error('GPX Studio returned an invalid OpenMapTiles OSM Topo style');
      return NextResponse.json({ error: 'Invalid OpenMapTiles OSM Topo style' }, { status: 502 });
    }

    style.layers = style.layers.filter(
      (layer) => !isRecord(layer)
        || !['contours_index_ft', 'contours_ft', 'contours_label_ft'].includes(String(layer.id)),
    );

    const sources = style.sources;
    const origin = new URL(request.url).origin;
    await Promise.all(Object.entries(sources).map(async ([id, rawSource]) => {
      if (!isRecord(rawSource) || typeof rawSource.url !== 'string') return;

      const sourceUrl = new URL(rawSource.url);
      const sourceId = sourceUrl.pathname.split('/').filter(Boolean).at(-1)?.replace(/\.json$/, '');
      if (sourceUrl.origin !== GPX_TILEJSON_URL || !sourceId || !TILE_SOURCE_IDS.has(sourceId)) {
        throw new Error(`Unexpected GPX Studio tile source for ${id}`);
      }

      const tileJsonResponse = await fetch(sourceUrl, { next: { revalidate: 86400 } });
      if (!tileJsonResponse.ok) {
        throw new Error(`GPX Studio tile metadata request failed for ${sourceId}: ${tileJsonResponse.status}`);
      }

      const tileJson: unknown = await tileJsonResponse.json();
      if (!isRecord(tileJson) || !Array.isArray(tileJson.tiles) || !tileJson.tiles.every((tile) => typeof tile === 'string')) {
        throw new Error(`Invalid GPX Studio tile metadata for ${sourceId}`);
      }

      const source = Object.fromEntries(Object.entries(rawSource).filter(([key]) => key !== 'url'));
      sources[id] = {
        ...source,
        tiles: tileJson.tiles.map((tile) => {
          const tileUrl = new URL(tile);
          if (tileUrl.origin !== GPX_TILEJSON_URL || !tileUrl.pathname.startsWith(`/${sourceId}/`)) {
            throw new Error(`Unexpected GPX Studio tile URL for ${sourceId}`);
          }
          return tileUrl.href
            .replace(`${GPX_TILEJSON_URL}/${sourceId}/`, `${origin}/api/map/tiles/${sourceId}/`)
            .replace(/%7B/gi, '{')
            .replace(/%7D/gi, '}');
        }),
        minzoom: tileJson.minzoom,
        maxzoom: tileJson.maxzoom,
        bounds: tileJson.bounds,
        attribution: tileJson.attribution,
      };
    }));

    style.glyphs = `${origin}/api/map/fonts/{fontstack}/{range}.pbf`;
    style.sprite = `${origin}/api/map/sprites/osm/sprite`;

    return NextResponse.json(style, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' },
    });
  } catch (error) {
    console.error('Failed to prepare GPX Studio OpenMapTiles style:', error);
    return NextResponse.json({ error: 'Unable to prepare OpenMapTiles OSM Topo style' }, { status: 502 });
  }
}
