import { get as getEdgeConfig } from '@vercel/edge-config';

const LOGIN_URL = "https://secure.birds.cornell.edu/cassso/login?service=https%3A%2F%2Febird.org%2Flogin%2Fcas%3Fportal%3Debird&locale=zh_TW";

declare global {
  var __ebirdMemoryCachedSession: string | undefined;
}

/**
 * 清除本地記憶體中的 eBird Session 快取
 */
export function clearEbirdMemoryCache() {
  globalThis.__ebirdMemoryCachedSession = undefined;
}

/**
 * 遮罩 SessionID 輸出日誌
 */
function maskSession(session: string): string {
  if (!session) return 'null';
  if (session.length <= 10) return session;
  return `${session.slice(0, 8)}...${session.slice(-4)}`;
}

/**
 * 模擬 Python requests.Session，自動追蹤重定向並管理 CookieJar
 */
async function sessionFetch(url: string, options: RequestInit = {}, cookieJar = new Map<string, string>(), maxRedirects = 10): Promise<Response> {
  let currentUrl = url;
  let currentOptions: RequestInit = { ...options, redirect: 'manual' };

  for (let i = 0; i < maxRedirects; i++) {
    const headers = new Headers(currentOptions.headers || {});
    
    if (cookieJar.size > 0) {
      const cookieStr = Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
      headers.set('Cookie', cookieStr);
    }
    currentOptions.headers = headers;

    const res = await fetch(currentUrl, {
      ...currentOptions,
      cache: 'no-store'
    });

    // 解析並收集 Cookie
    const getSetCookieFunc = (res.headers as any).getSetCookie;
    const rawCookies: string[] = getSetCookieFunc
      ? getSetCookieFunc.call(res.headers)
      : [res.headers.get('set-cookie') || ''];

    for (const str of rawCookies) {
      if (!str) continue;
      const parts = str.split(';');
      if (parts.length > 0) {
        const [k, v] = parts[0].split('=');
        if (k && v) {
          cookieJar.set(k.trim(), v.trim());
        }
      }
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (loc) {
        currentUrl = loc.startsWith('http') ? loc : new URL(loc, currentUrl).toString();
        currentOptions = {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          },
          redirect: 'manual'
        };
        continue;
      }
    }

    return res;
  }
  throw new Error('[eBird Auth] Redirect count exceeded');
}

/**
 * 全自動 CAS 登入並獲取受信任的 EBIRD_SESSIONID
 */
export async function loginEbirdAndGetSession(): Promise<string | null> {
  const username = process.env.EBIRD_USERNAME;
  const password = process.env.EBIRD_PASSWORD;

  if (!username || !password) {
    console.error('[eBird Auth] 未設定環境變數 EBIRD_USERNAME 或 EBIRD_PASSWORD');
    return null;
  }

  console.log('[eBird Auth] 正在發起全自動 CAS Session 登入鏈 (帳號:', username, ')...');

  try {
    const cookieJar = new Map<string, string>();

    // 1. GET 登入頁面，提取 hidden input 表單欄位
    const getRes = await sessionFetch(LOGIN_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    }, cookieJar);

    const html = await getRes.text();
    const payload: Record<string, string> = {};
    const inputRegex = /<input\s+[^>]*type=["']hidden["'][^>]*>/gi;
    let match;
    while ((match = inputRegex.exec(html)) !== null) {
      const inputTag = match[0];
      const nameMatch = /name=["']([^"']+)["']/i.exec(inputTag);
      const valMatch = /value=["']([^"']*)["']/i.exec(inputTag);
      if (nameMatch) {
        payload[nameMatch[1]] = valMatch ? valMatch[1] : '';
      }
    }

    let postUrl = LOGIN_URL;
    const formActionMatch = /<form\s+[^>]*action=["']([^"']+)["']/i.exec(html);
    if (formActionMatch && formActionMatch[1] && formActionMatch[1] !== '#') {
      const action = formActionMatch[1];
      postUrl = action.startsWith('http') ? action : new URL(action, LOGIN_URL).toString();
    }

    payload['username'] = username;
    payload['password'] = password;

    // 2. POST 登入並讓 sessionFetch 自動追蹤所有重定向及派發 Cookies
    const formData = new URLSearchParams();
    Object.entries(payload).forEach(([k, v]) => formData.append(k, v));

    await sessionFetch(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Origin': 'https://secure.birds.cornell.edu',
        'Referer': LOGIN_URL,
      },
      body: formData.toString()
    }, cookieJar);

    const sessionId = cookieJar.get('EBIRD_SESSIONID');
    if (sessionId) {
      console.log(`[eBird Auth] 🎉 CAS 登入完成！新 EBIRD_SESSIONID = ${maskSession(sessionId)}`);
      return sessionId;
    }

    console.warn('[eBird Auth] 登入完成但 CookieJar 未能解析出 EBIRD_SESSIONID');
    return null;
  } catch (err) {
    console.error('[eBird Auth] 登入過程發生例外錯誤:', err);
    return null;
  }
}

/**
 * 非同步更新 Vercel Edge Config 中的 EBIRD_SESSIONID
 */
export async function updateEdgeConfigEbirdSession(newSessionId: string): Promise<void> {
  const vercelApiToken = process.env.VERCEL_API_TOKEN;
  const edgeConfigId = process.env.EDGE_CONFIG_ID;

  if (!vercelApiToken || !edgeConfigId) {
    return;
  }

  try {
    const updateRes = await fetch(`https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${vercelApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            operation: 'upsert',
            key: 'EBIRD_SESSIONID',
            value: newSessionId,
          },
        ],
      }),
    });

    const resText = await updateRes.text();
    if (updateRes.ok) {
      console.log('[eBird Auth] 🎉 成功將最新 EBIRD_SESSIONID 更新至 Vercel Edge Config！');
    } else {
      console.warn(`[eBird Auth] Edge Config API status ${updateRes.status}:`, resText);
    }
  } catch (err) {
    console.error('[eBird Auth] 更新 Edge Config 時發生錯誤:', err);
  }
}

/**
 * 取得當前有效的 EBIRD_SESSIONID (優先 Memory -> 其次 Edge Config -> 補救登入)
 */
export async function getActiveEbirdSession(): Promise<string | null> {
  console.log('[eBird Auth] 🔍 檢查 eBird Session 狀態...');

  // 1. 優先從 Node.js 全域 Memory 快取讀取
  if (globalThis.__ebirdMemoryCachedSession) {
    console.log(`[eBird Auth] 🧠 使用 Global Memory 快取中的 Session: [${maskSession(globalThis.__ebirdMemoryCachedSession)}]`);
    return globalThis.__ebirdMemoryCachedSession;
  }

  // 2. 嘗試從 Vercel Edge Config 讀取
  const edgeConfigUrl = process.env.EDGE_CONFIG || (process.env.INAT_API_TOKEN?.startsWith('http') ? process.env.INAT_API_TOKEN : '');
  if (edgeConfigUrl) {
    try {
      if (!process.env.EDGE_CONFIG && edgeConfigUrl) {
        process.env.EDGE_CONFIG = edgeConfigUrl;
      }

      const edgeSession = await getEdgeConfig<string>('EBIRD_SESSIONID');
      if (edgeSession && typeof edgeSession === 'string' && edgeSession !== 'test test' && edgeSession.trim().length > 0) {
        console.log(`[eBird Auth] ⚡ 使用 Vercel Edge Config 中的 Session: [${maskSession(edgeSession)}]`);
        globalThis.__ebirdMemoryCachedSession = edgeSession;
        return edgeSession;
      }
    } catch (err) {
      console.warn('[eBird Auth] 無法從 Edge Config 讀取 eBird Session:', err);
    }
  }

  // 3. 無可用 Session，自動登入刷新並同步至 Edge Config
  return await refreshEbirdSession();
}

/**
 * 標記指定或當前的 Session 為過期並清除快取
 */
export async function markEbirdSessionExpired(sessionId?: string): Promise<void> {
  console.log(`[eBird Auth] ⚠️ 標記 eBird Session 為過期: [${maskSession(sessionId || globalThis.__ebirdMemoryCachedSession || '')}]`);
  clearEbirdMemoryCache();
}

/**
 * 刷新 eBird Session：重新登入取得新 SessionID 並寫入 Edge Config & Memory
 */
export async function refreshEbirdSession(): Promise<string | null> {
  console.log('[eBird Auth] 🔄 發起 eBird Session 刷新流程...');
  
  clearEbirdMemoryCache();
  const newSessionId = await loginEbirdAndGetSession();

  if (!newSessionId) {
    console.error('[eBird Auth] 刷新 eBird Session 失敗');
    return null;
  }

  globalThis.__ebirdMemoryCachedSession = newSessionId;

  // 非同步寫入 Vercel Edge Config，不阻塞當前 Request
  updateEdgeConfigEbirdSession(newSessionId).catch(err => {
    console.error('[eBird Auth] 異步寫入 Edge Config 失敗:', err);
  });

  return newSessionId;
}

// 保持與舊 Supabase 介面名相容的別名導出
export const refreshEbirdSessionInSupabase = refreshEbirdSession;
