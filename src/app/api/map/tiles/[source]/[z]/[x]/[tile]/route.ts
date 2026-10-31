import { NextResponse } from 'next/server';

const TILE_SOURCE_IDS = new Set(['openmaptiles', 'hillshading', 'contours_m', 'contours_ft']);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ source: string; z: string; x: string; tile: string }> },
) {
  const { source, z, x, tile } = await params;
  const y = tile.endsWith('.mvt') ? tile.slice(0, -4) : '';
  if (!TILE_SOURCE_IDS.has(source) || !/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+$/.test(y)) {
    return new NextResponse('Invalid map tile request', { status: 400 });
  }

  try {
    const response = await fetch(`https://tiles.gpx.studio/${source}/${z}/${x}/${y}.mvt`, {
      next: { revalidate: 86400 },
    });
    if (!response.ok) {
      return new NextResponse('Unable to load map tile', { status: response.status });
    }

    return new NextResponse(new Uint8Array(await response.arrayBuffer()), {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/vnd.mapbox-vector-tile',
        'Cache-Control': response.headers.get('cache-control') || 'public, s-maxage=86400, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    console.error('Failed to proxy GPX Studio map tile:', error);
    return new NextResponse('Unable to load map tile', { status: 502 });
  }
}
