import { NextResponse } from 'next/server';

const LANDSD_LABEL_API_ROOT = 'https://api.hkmapservice.gov.hk/ags/map';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ language: string; fontStack: string; range: string }> },
) {
  const { language, fontStack, range } = await params;
  if (
    !['en', 'tc'].includes(language)
    || !/^[A-Za-z0-9 ,_-]+$/.test(fontStack)
    || !/^\d+-\d+\.pbf$/.test(range)
  ) {
    return new NextResponse('Invalid LandsD label font request', { status: 400 });
  }

  const apiKey = process.env.HKMAPSERVICE_API_KEY;
  if (!apiKey) {
    console.error('HKMAPSERVICE_API_KEY is not configured');
    return new NextResponse('LandsD label service is not configured', { status: 500 });
  }

  try {
    const fontUrl = new URL(
      `${LANDSD_LABEL_API_ROOT}/label-${language}/VT/Indexed/WGS84/resources/fonts/${encodeURIComponent(fontStack)}/${range}`,
    );
    fontUrl.searchParams.set('key', apiKey);
    const response = await fetch(fontUrl, { next: { revalidate: 86400 } });
    if (!response.ok) {
      console.error(`LandsD label font request failed: ${response.status}`);
      return new NextResponse('Unable to load LandsD label font', { status: response.status });
    }

    return new NextResponse(new Uint8Array(await response.arrayBuffer()), {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/x-protobuf',
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    console.error('Failed to proxy LandsD label font:', error);
    return new NextResponse('Unable to load LandsD label font', { status: 502 });
  }
}
