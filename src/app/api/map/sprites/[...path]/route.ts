import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (path.length !== 2 || path[0] !== 'osm' || !/^sprite(?:@2x)?\.(?:json|png)$/.test(path[1])) {
    return new NextResponse('Invalid map sprite request', { status: 400 });
  }

  try {
    const response = await fetch(`https://sprites.gpx.studio/${path[0]}/${path[1]}`, {
      next: { revalidate: 86400 },
    });
    if (!response.ok) {
      return new NextResponse('Unable to load map sprite', { status: response.status });
    }

    return new NextResponse(new Uint8Array(await response.arrayBuffer()), {
      headers: {
        'Content-Type': response.headers.get('content-type') || (path[1].endsWith('.png') ? 'image/png' : 'application/json'),
        'Cache-Control': response.headers.get('cache-control') || 'public, s-maxage=86400, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    console.error('Failed to proxy GPX Studio map sprite:', error);
    return new NextResponse('Unable to load map sprite', { status: 502 });
  }
}
