import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

// 許可的圖片來源網域
const ALLOWED_HOSTS = [
  'inaturalist-open-data.s3.amazonaws.com',
  'api.inaturalist.org',
  'www.inaturalist.org',
  'static.inaturalist.org'
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');
  const id = searchParams.get('id') || 'image';
  const size = searchParams.get('size') || 'medium';

  if (!imageUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const parsedUrl = new URL(imageUrl);
    
    // 安全檢查：僅允許指定的來源
    const isAllowed = ALLOWED_HOSTS.some(host => 
      parsedUrl.hostname === host || parsedUrl.hostname.endsWith(`.${host}`)
    );

    if (!isAllowed) {
      return new NextResponse('Forbidden image source', { status: 403 });
    }

    // 獲取原始圖片
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return new NextResponse('Failed to fetch original image', { status: response.status });
    }

    const arrayBuffer = await response.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // 使用 sharp 進行轉換為 WebP
    // 不額外縮放尺寸，僅轉換格式與品質優化
    const transformedBuffer = await sharp(inputBuffer)
      .webp({ quality: 80, effort: 4 }) // quality 80 是一個效能與體積的良好平衡點
      .toBuffer();

    // 生成自定義檔名
    const fileName = `${id}_${size}.webp`;

    // 設置響應標頭
    return new NextResponse(transformedBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Content-Disposition': `inline; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        // 緩存策略：Edge Network 緩存 1 年 (s-maxage)，瀏覽器緩存 1 年 (max-age)
        'Cache-Control': 'public, s-maxage=31536000, max-age=31536000, stale-while-revalidate=59',
      },
    });
  } catch (error) {

    console.error('Image transformation error:', error);
    return new NextResponse('Internal Server Error during image transformation', { status: 500 });
  }
}

// 使用 Node.js Runtime 以支持 sharp (Edge Runtime 不支持原生二進制庫)
export const runtime = 'nodejs';
