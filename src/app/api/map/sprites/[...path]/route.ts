import { NextResponse } from 'next/server';

const SPRITE_SOURCES: Record<string, string> = {
  osm: 'https://sprites.gpx.studio/osm',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const spriteSource = SPRITE_SOURCES[path[0]];
  if (path.length !== 2 || !spriteSource || !/^sprite(?:@2x)?\.(?:json|png)$/.test(path[1])) {
    return new NextResponse('Invalid map sprite request', { status: 400 });
  }

  try {
    const response = await fetch(`${spriteSource}/${path[1]}`, {
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
    console.error(`Failed to proxy ${path[0]} map sprite:`, error);
    return new NextResponse('Unable to load map sprite', { status: 502 });
  }
}
