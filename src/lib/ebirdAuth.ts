import { createClient } from '@supabase/supabase-js';

const LOGIN_URL = "https://secure.birds.cornell.edu/cassso/login?service=https%3A%2F%2Febird.org%2Flogin%2Fcas%3Fportal%3Debird&locale=zh_TW";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
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
 * 全自動 CAS 登入並獲取受信任的 EBIRD_SESSIONID (與 import re.py 完全一致)
 */
export async function loginEbirdAndGetSession(): Promise<string | null> {
  const username = process.env.EBIRD_USERNAME || 'pantong';
  const password = process.env.EBIRD_PASSWORD || 'P@ss93681816';

  console.log('[eBird Auth] 正在發起全自動 CAS Session 登入鏈...');

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
      console.log(`[eBird Auth] 🎉 登入認證完成！新 EBIRD_SESSIONID = ${sessionId}`);
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
 * 取得當前 Supabase 中的 active EBIRD_SESSIONID
 */
export async function getActiveEbirdSession(): Promise<string | null> {
  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase
      .from('ebird_sessions')
      .select('session_id')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('[eBird Auth] 讀取 active session 失敗:', error.message);
      return null;
    }

    if (data && data.length > 0 && data[0].session_id) {
      return data[0].session_id;
    }

    // 若沒有 active session，改為先登入取得，之後異步更新 DB，並立即回傳
    const newSessionId = await loginEbirdAndGetSession();
    if (newSessionId) {
      saveNewSessionToSupabase(newSessionId).catch(err => console.error('[eBird Auth] 異步寫入新 Session 失敗:', err));
      return newSessionId;
    }
    return null;
  } catch (err) {
    console.error('[eBird Auth] 存取 ebird_sessions 表失敗:', err);
    return null;
  }
}

/**
 * 將指定或當前的 Session 標記為 expired
 */
export async function markEbirdSessionExpired(sessionId?: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  try {
    if (sessionId) {
      await supabase
        .from('ebird_sessions')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('session_id', sessionId);
      console.log(`[eBird Auth] 已將 SessionID: ${sessionId} 在 Supabase 標記為 expired`);
    } else {
      await supabase
        .from('ebird_sessions')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('status', 'active');
      console.log(`[eBird Auth] 已將所有 active Sessions 在 Supabase 標記為 expired`);
    }
  } catch (err) {
    console.error('[eBird Auth] 標記 session expired 失敗:', err);
  }
}

/**
 * 僅執行 Supabase 更新流程：將舊 Session 設為過期，並寫入新 Session
 */
export async function saveNewSessionToSupabase(newSessionId: string): Promise<void> {
  console.log(`[eBird Auth] 準備在 Supabase 更新存放新 SessionID (${newSessionId})...`);
  try {
    await markEbirdSessionExpired();
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('ebird_sessions')
      .insert([
        {
          session_id: newSessionId,
          status: 'active',
        }
      ]);

    if (error) {
      console.error('[eBird Auth] 將新 Session 寫入 Supabase 失敗:', error.message);
    } else {
      console.log(`[eBird Auth] ✅ 新 SessionID (${newSessionId}) 已成功寫入 Supabase (active)`);
    }
  } catch (err) {
    console.error('[eBird Auth] saveNewSessionToSupabase 發生錯誤:', err);
  }
}

/**
 * 標記舊 session 為 expired -> 重新登入取得新 session -> 寫入 Supabase 並標記 active
 */
export async function refreshEbirdSessionInSupabase(): Promise<string | null> {
  console.log('[eBird Auth] 開始執行 Session 刷新與 Supabase 更新流程...');
  
  const newSessionId = await loginEbirdAndGetSession();

  if (!newSessionId) {
    console.error('[eBird Auth] 刷新 Session 失敗：無法取得新 SessionID');
    return null;
  }

  // 異步執行 Supabase 更新流程，不阻塞地圖數據的立即獲取
  saveNewSessionToSupabase(newSessionId).catch(err => {
    console.error('[eBird Auth] 異步更新 Supabase 失敗:', err);
  });

  return newSessionId;
}
