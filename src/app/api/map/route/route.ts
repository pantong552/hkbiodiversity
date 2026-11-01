import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (
    typeof body !== 'object'
    || body === null
    || !('points' in body)
    || !Array.isArray(body.points)
    || body.points.length < 2
    || !body.points.every((point) => (
      Array.isArray(point)
      && point.length >= 2
      && typeof point[0] === 'number'
      && typeof point[1] === 'number'
      && Number.isFinite(point[0])
      && Number.isFinite(point[1])
    ))
    || !('profile' in body)
    || !['foot', 'bike'].includes(String(body.profile))
    || ('allowPrivateRoads' in body && typeof body.allowPrivateRoads !== 'boolean')
  ) {
    return NextResponse.json({ error: 'Invalid routing request' }, { status: 400 });
  }

  try {
    const { allowPrivateRoads = false, ...routeRequest } = body as Record<string, unknown>;
    const profile = String(routeRequest.profile);
    const privateAccessKey = profile === 'foot' ? 'foot_road_access' : 'bike_road_access';
    const requestBody = {
      ...routeRequest,
      ...(allowPrivateRoads ? {} : {
        custom_model: {
          priority: [{ if: `${privateAccessKey} == PRIVATE`, multiply_by: '0.0' }],
        },
      }),
    };
    const response = await fetch('https://graphhopper.gpx.studio/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(25000),
    });
    const responseBody = await response.text();
    return new Response(responseBody, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GraphHopper request failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
