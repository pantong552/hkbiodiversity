import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const fontStack = path[0]?.split(',').map((font) => font.trim());
  if (
    path.length !== 2
    || !fontStack?.length
    || !fontStack.every((font) => /^[A-Za-z0-9 _-]+$/.test(font))
    || !/^\d+-\d+\.pbf$/.test(path[1])
  ) {
    return new NextResponse('Invalid map font request', { status: 400 });
  }

  try {
    let response: Response | undefined;
    for (const font of fontStack) {
      response = await fetch(
        `https://fonts.gpx.studio/${encodeURIComponent(font)}/${path[1]}`,
        { next: { revalidate: 86400 } },
      );
      if (response.ok) break;
    }

    if (!response) {
      throw new Error('GPX Studio font stack did not contain any font');
    }
    if (!response.ok) {
      return new NextResponse('Unable to load map font', { status: response.status });
    }

    return new NextResponse(new Uint8Array(await response.arrayBuffer()), {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/x-protobuf',
        'Cache-Control': response.headers.get('cache-control') || 'public, s-maxage=86400, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    console.error('Failed to proxy GPX Studio map font:', error);
    return new NextResponse('Unable to load map font', { status: 502 });
  }
}
