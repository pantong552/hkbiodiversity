import { NextRequest, NextResponse } from 'next/server';
import { getValidInatToken, clearTokenCache, fetchFreshInatToken } from '@/lib/inatAuth';

export const runtime = 'nodejs'; // Node.js Serverless Function runtime

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image');

    if (!imageFile) {
      return NextResponse.json({ error: 'Missing image file' }, { status: 400 });
    }

    // 1. 取得有效且未過期的 iNaturalist API Token (過期自動刷新)
    const token = await getValidInatToken();

    // 2. 構建要發給 iNaturalist API v2 的 FormData
    const outboundFormData = new FormData();
    outboundFormData.append('image', imageFile);
    outboundFormData.append('include_representative_photos', 'true');
    outboundFormData.append(
      'fields',
      JSON.stringify({
        frequency_score: true,
        vision_score: true,
        taxon: {
          ancestor_ids: true,
          default_photo: { url: true },
          representative_photo: { url: true },
          iconic_taxon_id: true,
          iconic_taxon_name: true,
          is_active: true,
          matched_term: true,
          name: true,                     // 拉丁學名
          preferred_common_name: true,    // 語系偏好常用名 (中文名)
          english_common_name: true,      // 英文常用名
          rank: true,
          rank_level: true,
        },
      })
    );

    const API_URL = 'https://api.inaturalist.org/v2/computervision/score_image?locale=zh-HK';

    const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

    // 3. 代理發送至 iNaturalist 伺服器
    let response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'X-Via': 'inaturalistjs',
        'Accept-Language': 'zh-HK,zh;q=0.9,zh-TW;q=0.8,en;q=0.7',
      },
      body: outboundFormData,
    });

    // 4. 若收到 401 Unauthorized (JWT 過期或無效)，觸發「401 自癒重試機制」：重新登入獲取新 Token 後自動補發請求！
    if (response.status === 401) {
      console.warn('[iNatProxy] ⚠️ Received 401 Unauthorized (JWT Invalid/Expired). Triggering Auto-Retry with fresh login...');
      clearTokenCache();
      const freshToken = await fetchFreshInatToken();
      const freshAuthHeader = freshToken.startsWith('Bearer ') ? freshToken : `Bearer ${freshToken}`;

      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': freshAuthHeader,
          'X-Via': 'inaturalistjs',
          'Accept-Language': 'zh-HK,zh;q=0.9,zh-TW;q=0.8,en;q=0.7',
        },
        body: outboundFormData,
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[iNatProxy] Upstream Error ${response.status}:`, errorText);
      return NextResponse.json(
        { error: `Upstream iNaturalist API error (${response.status})` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[iNatProxy] Internal Server Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process species recognition request' },
      { status: 500 }
    );
  }
}
