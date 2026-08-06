/**
 * iNaturalist API Token Auto-Refresh & Edge Config Manager
 * 自動登入 iNaturalist，擷取並續刷 JWT api_token
 */

// 使用 Node.js 全域 globalThis 防止 Next.js App Router 跨 Request 重載模組導致快取變數被清空
declare global {
  var __inatMemoryCachedToken: string | undefined;
}

/**
 * 手動清空記憶體快取
 */
export function clearTokenCache() {
  globalThis.__inatMemoryCachedToken = undefined;
}

/**
 * 解析 JWT 判斷 Token 是否過期 (預留 10 分鐘安全寬限期)
 */
export function isTokenExpired(token: string | null | undefined): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    // Base64Url 解碼
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false; // 無 exp 欄位假定有效

    const currentTimeMs = Date.now();
    // JWT exp 欄位為標準失效時間 (Expiration Timestamp)
    const expiryTimeMs = payload.exp * 1000;
    const safetyBufferMs = 10 * 60 * 1000; // 預留 10 分鐘安全寬限期

    return expiryTimeMs - currentTimeMs < safetyBufferMs;
  } catch (err) {
    console.error('[iNatAuth] Failed to parse JWT token:', err);
    return true;
  }
}

/**
 * 透過純 API 自動登入 iNaturalist 並獲取全新 JWT api_token (連線 /session 端點)
 */
export async function fetchFreshInatToken(): Promise<string> {
  const username = process.env.INAT_ACCOUNT;
  const password = process.env.INAT_PASSWORD;

  if (!username || !password) {
    throw new Error('[iNatAuth] 未設定環境變數 INAT_ACCOUNT 或 INAT_PASSWORD，無法發起自動登入。');
  }

  console.log('[iNatAuth] Initiating pure API auto-login to /session for:', username);

  // 1. 抓取 CSRF 驗證碼與 initial Cookie
  const signPage = await fetch('https://www.inaturalist.org/users/sign_in', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
  });
  const html = await signPage.text();
  const csrfMatch = html.match(/name="authenticity_token" value="([^"]+)"/);
  if (!csrfMatch) throw new Error('[iNatAuth] 無法從 iNaturalist 登入頁提取 CSRF Token');

  const signPageCookies = signPage.headers.getSetCookie 
    ? signPage.headers.getSetCookie().join('; ') 
    : (signPage.headers.get('set-cookie') || '');

  // 2. 模擬登入至 /session 端點 (使用 user[email] 欄位)
  const formData = new URLSearchParams();
  formData.append('utf8', '✓');
  formData.append('authenticity_token', csrfMatch[1]);
  formData.append('user[email]', username);
  formData.append('user[password]', password);
  formData.append('user[remember_me]', '1');
  formData.append('commit', 'Log In');

  const loginRes = await fetch('https://www.inaturalist.org/session', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': signPageCookies,
      'Origin': 'https://www.inaturalist.org',
      'Referer': 'https://www.inaturalist.org/users/sign_in'
    },
    body: formData.toString(),
    redirect: 'manual'
  });

  const loginCookies = loginRes.headers.getSetCookie 
    ? loginRes.headers.getSetCookie().join('; ') 
    : (loginRes.headers.get('set-cookie') || '');
  
  const allCookies = [signPageCookies, loginCookies].filter(Boolean).join('; ');

  // 3. 提取 API Token
  const tokenRes = await fetch('https://www.inaturalist.org/users/api_token', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'Accept': 'application/json',
      'Cookie': allCookies
    }
  });

  if (!tokenRes.ok) {
    throw new Error(`[iNatAuth] 無法取得 API Token (HTTP ${tokenRes.status})`);
  }

  const tokenData = await tokenRes.json();
  const freshToken = tokenData.api_token;

  if (!freshToken) {
    throw new Error('[iNatAuth] Response from /users/api_token contained no valid api_token');
  }

  console.log('[iNatAuth] Successfully acquired fresh JWT Token!');
  return freshToken;
}

/**
 * 非同步更新 Vercel Edge Config (若已配置 VERCEL_API_TOKEN 與 EDGE_CONFIG_ID)
 */
async function updateEdgeConfigToken(newToken: string): Promise<void> {
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
            key: 'INAT_API_TOKEN',
            value: newToken,
          },
        ],
      }),
    });

    if (updateRes.ok) {
      console.log('[iNatAuth] Updated INAT_API_TOKEN in Vercel Edge Config.');
    } else {
      console.warn('[iNatAuth] Failed to update Edge Config:', await updateRes.text());
    }
  } catch (err) {
    console.error('[iNatAuth] Error updating Edge Config:', err);
  }
}

/**
 * 輔助函式：取得 Token 的遮罩摘要 (前12字元...後6字元)
 */
function maskToken(token: string): string {
  if (!token) return 'null';
  return `${token.slice(0, 15)}...${token.slice(-6)}`;
}

/**
 * 獲取當前有效且未過期的 iNaturalist JWT Token
 */
export async function getValidInatToken(): Promise<string> {
  console.log('\n---------------------------------------------------------');
  console.log('[iNatAuth] 🔍 Checking iNaturalist Token Status...');

  // 1. 優先從 Node.js 全域 Memory 快取 (globalThis) 讀取
  if (globalThis.__inatMemoryCachedToken) {
    if (!isTokenExpired(globalThis.__inatMemoryCachedToken)) {
      console.log(`[iNatAuth] 🧠 Using valid Token from Global Memory Cache: [${maskToken(globalThis.__inatMemoryCachedToken)}]`);
      console.log('---------------------------------------------------------\n');
      return globalThis.__inatMemoryCachedToken;
    } else {
      console.log(`[iNatAuth] ⚠️ Token in Global Memory Cache is EXPIRED: [${maskToken(globalThis.__inatMemoryCachedToken)}]`);
    }
  }

  // 2. 嘗試從 Vercel Edge Config 讀取 (相容 EDGE_CONFIG 與 INAT_API_TOKEN 環境變數)
  const edgeConfigUrl = process.env.EDGE_CONFIG || (process.env.INAT_API_TOKEN?.startsWith('http') ? process.env.INAT_API_TOKEN : '');
  if (edgeConfigUrl) {
    try {
      const urlObj = new URL(edgeConfigUrl);
      const itemUrl = `${urlObj.origin}${urlObj.pathname}/item/INAT_API_TOKEN${urlObj.search}`;
      
      const res = await fetch(itemUrl, { cache: 'no-store' });
      if (res.ok) {
        const edgeToken = await res.json();
        if (typeof edgeToken === 'string') {
          if (!isTokenExpired(edgeToken)) {
            console.log(`[iNatAuth] ⚡ Using valid Token from Vercel Edge Config: [${maskToken(edgeToken)}]`);
            console.log('---------------------------------------------------------\n');
            globalThis.__inatMemoryCachedToken = edgeToken;
            return edgeToken;
          } else {
            console.log(`[iNatAuth] ⚠️ Token in Edge Config is EXPIRED: [${maskToken(edgeToken)}]`);
          }
        }
      }
    } catch (err) {
      console.warn('[iNatAuth] Could not read from Edge Config:', err);
    }
  }

  // 3. 嘗試從環境變數 NEXT_PUBLIC_INAT_AUTOID_ENG_API 讀取
  const envToken = process.env.NEXT_PUBLIC_INAT_AUTOID_ENG_API;
  if (envToken) {
    if (!isTokenExpired(envToken)) {
      console.log(`[iNatAuth] 📄 Using valid Token from .env.local: [${maskToken(envToken)}]`);
      console.log('---------------------------------------------------------\n');
      globalThis.__inatMemoryCachedToken = envToken;
      return envToken;
    } else {
      console.log(`[iNatAuth] ⚠️ Token in .env.local is EXPIRED: [${maskToken(envToken)}]`);
    }
  }

  // 4. Token 已過期或不存在，自動發起純 API 登入重刷
  console.log('[iNatAuth] 🔄 Token is EXPIRED or MISSING! Initiating Pure API Auto-Login...');
  const freshToken = await fetchFreshInatToken();
  globalThis.__inatMemoryCachedToken = freshToken;

  console.log(`[iNatAuth] 🎉 Auto-Refresh SUCCESS! Using newly generated Token: [${maskToken(freshToken)}]`);
  console.log('---------------------------------------------------------\n');

  // 異步更新 Edge Config
  updateEdgeConfigToken(freshToken).catch((e) => console.error(e));

  return freshToken;
}
