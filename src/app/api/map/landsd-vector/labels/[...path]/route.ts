import { NextResponse } from 'next/server';

const LANDSD_LABEL_API_ROOT = 'https://api.hkmapservice.gov.hk/ags/map';
const MAX_ZOOM = 19;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const [language, zoomValue, rowValue, columnValue] = path;
  const column = columnValue?.replace(/\.pbf$/, '');
  const zoom = Number(zoomValue);
  const row = Number(rowValue);
  const columnIndex = Number(column);
  const tileCount = 2 ** zoom;

  if (
    path.length !== 4
    || !['en', 'tc'].includes(language)
    || !/^(0|[1-9]\d?)$/.test(zoomValue)
    || zoom > MAX_ZOOM
    || !/^\d+$/.test(rowValue)
    || !/^\d+$/.test(columnValue?.replace(/\.pbf$/, '') || '')
    || !columnValue?.endsWith('.pbf')
    || row >= tileCount
    || columnIndex >= tileCount
  ) {
    return new NextResponse('Invalid LandsD label tile request', { status: 400 });
  }

  const apiKey = process.env.HKMAPSERVICE_API_KEY;
  if (!apiKey) {
    console.error('HKMAPSERVICE_API_KEY is not configured');
    return new NextResponse('LandsD label service is not configured', { status: 500 });
  }

  try {
    const tileUrl = new URL(
      `${LANDSD_LABEL_API_ROOT}/label-${language}/VT/Indexed/WGS84/tile/${zoom}/${row}/${columnIndex}.pbf`,
    );
    tileUrl.searchParams.set('key', apiKey);
    const response = await fetch(tileUrl, { next: { revalidate: 86400 } });
    const headers = {
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
    };

    if (response.status === 204) {
      return new NextResponse(null, { status: 204, headers });
    }
    if (!response.ok) {
      console.error(`LandsD label tile request failed: ${response.status}`);
      return new NextResponse('Unable to load LandsD label tile', { status: response.status });
    }

    return new NextResponse(new Uint8Array(await response.arrayBuffer()), {
      headers: {
        ...headers,
        'Content-Type': response.headers.get('content-type') || 'application/x-protobuf',
      },
    });
  } catch (error) {
    console.error('Failed to proxy LandsD label tile:', error);
    return new NextResponse('Unable to load LandsD label tile', { status: 502 });
  }
}
