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
            backgroundColor: '#ffffff', // 強制白底
            padding: '40px',
          }}
        >
          {/* 裝飾背影 */}
          <div
            style={{
              position: 'absolute',
              top: -100,
              right: -100,
              width: 400,
              height: 400,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              opacity: 0.5,
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -50,
              left: -50,
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              opacity: 0.5,
            }}
          />

          {/* Logo 容器 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 300,
              height: 300,
              marginBottom: '20px',
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

          {/* 文字內容 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <h1
              style={{
                fontSize: 60,
                fontWeight: 900,
                color: '#0f172a',
                marginBottom: 10,
                textAlign: 'center',
                letterSpacing: '-0.02em',
              }}
            >
              Hong Kong Biodiversity Collective
            </h1>
            <p
              style={{
                fontSize: 30,
                color: '#64748b',
                textAlign: 'center',
                maxWidth: '800px',
                fontWeight: 500,
              }}
            >
              A comprehensive biodiversity encyclopedia of Hong Kong
            </p>
          </div>

          {/* 底部裝飾條 */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '12px',
              background: 'linear-gradient(90deg, #10b981 0%, #06b6d4 100%)',
            }}
          />
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
