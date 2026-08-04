import { NextResponse } from 'next/server';
import { getActiveEbirdSession, markEbirdSessionExpired, refreshEbirdSessionInSupabase } from '@/lib/ebirdAuth';

async function fetchFromEbirdLocInfo(url: string, sessionId: string) {
  return await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Cookie': `EBIRD_SESSIONID=${sessionId}`,
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://ebird.org/map',
    },
    cache: 'no-store'
  });
}

function parseLocInfoJson(text: string) {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && ('loc' in parsed || 'infoList' in parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locID = searchParams.get('locID');
  const speciesCode = searchParams.get('speciesCode');

  if (!locID || !speciesCode) {
    return NextResponse.json({ error: 'locID and speciesCode are required' }, { status: 400 });
  }

  const ebirdUrl = `https://ebird.org/mapServices/getLocInfo.do?fmt=json&locID=${encodeURIComponent(locID)}&speciesCodes=${encodeURIComponent(speciesCode)}&evidSort=false&excludeExX=false&excludeExAll=false&byr=1900&eyr=2026&yr=all&bmo=1&emo=12`;

  try {
    // 1. 取得 Supabase active session
    let currentSessionId = await getActiveEbirdSession();

    if (!currentSessionId) {
      currentSessionId = await refreshEbirdSessionInSupabase();
    }

    if (!currentSessionId) {
      return NextResponse.json({ error: 'Failed to obtain active eBird session' }, { status: 500 });
    }

    // 2. 第一次嘗試 Fetch
    let response = await fetchFromEbirdLocInfo(ebirdUrl, currentSessionId);
    let text = await response.text();
    let data = parseLocInfoJson(text);

    // 3. 判斷是否過期/失敗
    if (!response.ok || data === null) {
      console.warn(`[eBird LocInfo Proxy] Session ${currentSessionId} 請求失敗 (status ${response.status})，準備標記過期並全自動重新登入...`);
      
      // 將過期的 session 在 Supabase 標記為 expired (異步背景執行，不阻塞數據重試)
      markEbirdSessionExpired(currentSessionId).catch(err => console.error('[eBird LocInfo Proxy] 標記過期失敗:', err));

      // 自動發起 eBird 登入腳本，獲取最新的 EBIRD_SESSIONID (新 ID 的 Supabase 寫入程序在 refreshEbirdSessionInSupabase 內亦為異步非阻塞)
      const newSessionId = await refreshEbirdSessionInSupabase();

      if (newSessionId) {
        console.log(`[eBird LocInfo Proxy] 成功獲取新 Session (${newSessionId})，立即執行重試 (Retry)...`);

        // 4. 即時重試
        response = await fetchFromEbirdLocInfo(ebirdUrl, newSessionId);
        text = await response.text();
        data = parseLocInfoJson(text);

        if (response.ok && data !== null) {
          console.log(`[eBird LocInfo Proxy] 重試成功！已順利取回數據。`);
          return NextResponse.json(data);
        }
      }

      return NextResponse.json({ error: 'eBird session expired and retry failed' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[eBird LocInfo Proxy Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
