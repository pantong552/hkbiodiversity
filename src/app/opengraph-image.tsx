import { ImageResponse } from 'next/og';
import { readFileSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';

// 預設 OG 圖片尺寸
export const alt = 'Hong Kong Biodiversity Collective';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
  try {
    // 讀取 Logo SVG
    // 由於 satori 處理 SVG 可能有難度，有兩種做法：
    // 1. 直接讀取檔案內容並放入 <img> (Next.js ImageResponse 支援)
    // 2. 使用 base64
    const logoPath = join(process.cwd(), 'public', 'logo.svg');
    const logoData = readFileSync(logoPath);
    const base64Logo = `data:image/svg+xml;base64,${logoData.toString('base64')}`;

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
            paddingBottom: '60px',
            position: 'relative',
          }}
        >
          {/* 現代化漸層裝飾背景 */}
          <div
            style={{
              position: 'absolute',
              top: -150,
              right: -100,
              width: 500,
              height: 500,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(255,255,255,0) 70%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -100,
              left: -150,
              width: 600,
              height: 600,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(6, 182, 212, 0.06) 0%, rgba(255,255,255,0) 70%)',
            }}
          />

          {/* Logo 容器 - 再度放大，極致壓縮間距 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 500,
              height: 420,
              marginBottom: '10px',
            }}
          >
            <img
              src={base64Logo}
              alt="Logo"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          </div>

          {/* 文字內容區域 - 大幅壓縮間距以確保副標題顯示 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            <div
              style={{
                fontSize: 68,
                fontWeight: 900,
                color: '#0f172a',
                textAlign: 'center',
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              Hong Kong Biodiversity Collective
            </div>
            
            {/* 中文正式名稱 */}
            <div
              style={{
                fontSize: 44,
                fontWeight: 700,
                color: '#475569', // Slate-600 展現專業質感
                textAlign: 'center',
                letterSpacing: '0.15em',
                marginBottom: '4px',
              }}
            >
              香港自然生態匯誌
            </div>

            {/* 副標題 - 移除裝飾線以騰出空間 */}
            <div
              style={{
                fontSize: 24,
                color: '#94a3b8',
                textAlign: 'center',
                maxWidth: '1000px',
                fontWeight: 500,
                letterSpacing: '0.01em',
                marginTop: '10px',
              }}
            >
              A collaborative biodiversity encyclopedia of Hong Kong
            </div>
          </div>

          {/* 底部品牌色條 - 全綠色系設計 */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '16px',
              display: 'flex',
            }}
          >
            <div style={{ flex: 1, backgroundColor: '#10b981' }} />
            <div style={{ flex: 1, backgroundColor: '#0d9488' }} />
          </div>
        </div>
      ),
      {
        ...size,
      }
    );
  } catch (e) {
    console.error('OG Image Generation Error:', e);
    // Fallback simple version
    return new ImageResponse(
      (
        <div style={{ height: '100%', width: '100%', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
          HK Biodiversity Collective
        </div>
      ),
      { ...size }
    );
  }
}
