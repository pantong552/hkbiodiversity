import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const speciesCode = searchParams.get('speciesCode');

  if (!speciesCode) {
    return NextResponse.json({ error: 'speciesCode is required' }, { status: 400 });
  }

  const ebirdUrl = `https://ebird.org/map/points?speciesCode=${encodeURIComponent(speciesCode)}&byr=1900&eyr=2026&yr=all&bmo=1&emo=12&maxY=22.589236214522156&maxX=114.51671170162061&minY=22.116124821214388&ev=Z&excludeExX=false&excludeExAll=false&minX=113.76208828853467&continue`;

  try {
    const response = await fetch(ebirdUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': 'EBIRD_SESSIONID=CAF05812FE9446C17D4BF2AAAFFD069B',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest'
      },
      next: { revalidate: 3600 } // 快取 1 小時
    });

    if (!response.ok) {
      return NextResponse.json({ error: `eBird status ${response.status}` }, { status: response.status });
    }

    const text = await response.text();
    const jsonStartIndex = text.indexOf('[');
    const jsonEndIndex = text.lastIndexOf(']');

    if (jsonStartIndex === -1 || jsonEndIndex === -1 || jsonEndIndex < jsonStartIndex) {
      return NextResponse.json([]);
    }

    const cleanJson = text.substring(jsonStartIndex, jsonEndIndex + 1);
    const data = JSON.parse(cleanJson);

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[eBird Proxy API Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
