import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;
    const project = (formData.get('project') as string) || 'k-malesia'; // 預設使用馬來群島/東南亞/亞洲植群專案，可視需求調整

    if (!imageFile) {
      return NextResponse.json({ error: 'Missing image file' }, { status: 400 });
    }

    // 1. 上傳至公用免費圖床 (freeimage.host)，帶有 3600 秒 (1小時) 自動銷毀參數
    const cdnFormData = new FormData();
    cdnFormData.append('key', '6d207e02198a847aa98d0a2a901485a5');
    cdnFormData.append('action', 'upload');
    cdnFormData.append('source', imageFile, imageFile.name || 'image.jpg');
    cdnFormData.append('format', 'json');
    cdnFormData.append('expiration', '3600');

    const cdnRes = await fetch('https://freeimage.host/api/1/upload', {
      method: 'POST',
      body: cdnFormData,
    });

    if (!cdnRes.ok) {
      throw new Error(`圖床上傳失敗 (HTTP ${cdnRes.status})`);
    }

    const cdnJson = await cdnRes.json();
    const imageUrl = cdnJson?.image?.url;

    if (!imageUrl) {
      throw new Error('圖床回應未包含有效的圖片 URL');
    }

    // 2. 呼叫 Pl@ntNet 官方 API 進行物種辨識
    const plantnetEndpoint = `https://api.plantnet.org/v1/projects/${encodeURIComponent(
      project
    )}/queries/identify?illustratedOnly=true&clientType=web&clientVersion=3.0.0&kt=true&mediaSource=file&lang=zh-hant`;

    const plantnetRes = await fetch(plantnetEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        images: [{ url: imageUrl }],
      }),
    });

    if (!plantnetRes.ok) {
      const errText = await plantnetRes.text();
      throw new Error(`Pl@ntNet API 回應異常 (HTTP ${plantnetRes.status}): ${errText}`);
    }

    const plantnetData = await plantnetRes.json();

    return NextResponse.json(plantnetData);
  } catch (error: any) {
    console.error('[PlantNet Proxy Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Pl@ntNet 辨識請求處理失敗' },
      { status: 500 }
    );
  }
}
