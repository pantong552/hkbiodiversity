import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locID = searchParams.get('locID');
  const speciesCode = searchParams.get('speciesCode');

  if (!locID || !speciesCode) {
    return NextResponse.json({ error: 'locID and speciesCode are required' }, { status: 400 });
  }

  const ebirdUrl = `https://ebird.org/mapServices/getLocInfo.do?fmt=json&locID=${encodeURIComponent(locID)}&speciesCodes=${encodeURIComponent(speciesCode)}&evidSort=false&excludeExX=false&excludeExAll=false&byr=1900&eyr=2026&yr=all&bmo=1&emo=12`;

  try {
    const response = await fetch(ebirdUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': 'EBIRD_SESSIONID=CAF05812FE9446C17D4BF2AAAFFD069B',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://ebird.org/map',
      },
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      return NextResponse.json({ error: `eBird status ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[eBird LocInfo Proxy Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
