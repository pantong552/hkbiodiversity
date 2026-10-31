import { NextResponse } from 'next/server';

const MAX_ZOOM = 15;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const { z, x, y: tileY } = await params;
  const y = tileY.endsWith('.png') ? tileY.slice(0, -4) : '';
  if (!/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+$/.test(y)) {
    return new NextResponse('Invalid AWS DEM tile request', { status: 400 });
  }

  const zoom = Number(z);
  const tileCount = 2 ** zoom;
  if (zoom > MAX_ZOOM || Number(x) >= tileCount || Number(y) >= tileCount) {
    return new NextResponse('AWS DEM tile is outside the available range', { status: 400 });
  }

  try {
    const response = await fetch(
      `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${x}/${y}.png`,
      { next: { revalidate: 86400 } },
    );
    if (!response.ok) {
      console.error(`AWS DEM tile request failed with status ${response.status}`);
      return new NextResponse('Unable to load AWS DEM tile', { status: response.status });
    }

    return new NextResponse(new Uint8Array(await response.arrayBuffer()), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    console.error('Failed to proxy AWS DEM tile:', error);
    return new NextResponse('Unable to load AWS DEM tile', { status: 502 });
  }
}
