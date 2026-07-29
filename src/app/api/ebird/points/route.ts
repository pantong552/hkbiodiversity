import { NextResponse } from 'next/server';
import { getActiveEbirdSession, markEbirdSessionExpired, refreshEbirdSessionInSupabase } from '@/lib/ebirdAuth';

async function fetchFromEbird(url: string, sessionId: string) {
  return await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Cookie': `EBIRD_SESSIONID=${sessionId}`,
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest'
    },
    cache: 'no-store'
  });
}

function parsePointsJson(text: string) {
  const jsonStartIndex = text.indexOf('[');
  const jsonEndIndex = text.lastIndexOf(']');
  if (jsonStartIndex === -1 || jsonEndIndex === -1 || jsonEndIndex < jsonStartIndex) {
    return null;
  }
  const cleanJson = text.substring(jsonStartIndex, jsonEndIndex + 1);
  try {
    return JSON.parse(cleanJson);
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const speciesCode = searchParams.get('speciesCode');

  if (!speciesCode) {
    return NextResponse.json({ error: 'speciesCode is required' }, { status: 400 });
  }

  const ebirdUrl = `https://ebird.org/map/points?speciesCode=${encodeURIComponent(speciesCode)}&byr=1900&eyr=2026&yr=all&bmo=1&emo=12&maxY=22.589236214522156&maxX=114.51671170162061&minY=22.116124821214388&ev=Z&excludeExX=false&excludeExAll=false&minX=113.76208828853467&continue`;

  try {
    // 1. 取得 Supabase 中 active 的 Session ID
    let currentSessionId = await getActiveEbirdSession();

    if (!currentSessionId) {
      // 若連 active session 都沒有，嘗試自動登入
      currentSessionId = await refreshEbirdSessionInSupabase();
    }

    if (!currentSessionId) {
      return NextResponse.json({ error: 'Failed to obtain active eBird session' }, { status: 500 });
    }

    // 2. 第一次嘗試 Fetch
    let response = await fetchFromEbird(ebirdUrl, currentSessionId);
    let text = await response.text();
    let data = parsePointsJson(text);

    // 3. 判斷是否失敗（status 非 200，或未能解析出合法 JSON）
    if (!response.ok || data === null) {
      console.warn(`[eBird Points Proxy] Session ${currentSessionId} 請求失敗 (status ${response.status})，準備標記過期並全自動重新登入...`);
      
      // 將過期的 session 在 Supabase 標記為 expired
      await markEbirdSessionExpired(currentSessionId);

      // 自動發起 eBird 登入腳本，獲取最新的 EBIRD_SESSIONID 並存入 Supabase active
      const newSessionId = await refreshEbirdSessionInSupabase();

      if (newSessionId) {
        console.log(`[eBird Points Proxy] 成功獲取新 Session (${newSessionId})，立即執行重試 (Retry)...`);
        
        // 4. 使用最新 Session 即時重試 Fetch
        response = await fetchFromEbird(ebirdUrl, newSessionId);
        text = await response.text();
        data = parsePointsJson(text);

        if (response.ok && data !== null) {
          console.log(`[eBird Points Proxy] 重試成功！已順利取回數據。`);
          return NextResponse.json(data);
        }
      }

      return NextResponse.json({ error: 'eBird session expired and retry failed' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[eBird Proxy API Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
