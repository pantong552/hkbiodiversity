import type { Metadata } from 'next';
import { Outfit, Work_Sans } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
});

const workSans = Work_Sans({
  subsets: ['latin'],
  variable: '--font-work-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://hkbiodiversity.org'),
  title: {
    default: 'Hong Kong Biodiversity Collective | 香港自然生態匯誌',
    template: '%s | HK Biodiversity Collective',
  },
  description: 'A collaborative biodiversity encyclopedia of Hong Kong, covering approximately 10,000 species.',
  icons: {
    icon: [
      { url: '/logo.svg', type: 'image/svg+xml' },
      { url: '/logo/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/logo/favicon.ico',
    apple: [
      { url: '/logo/apple-touch-icon-180x180.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'HK Biodiversity',
  },
  openGraph: {
    title: 'Hong Kong Biodiversity Collective | 香港自然生態匯誌',
    description: 'A collaborative biodiversity encyclopedia of Hong Kong, covering approximately 10,000 species.',
    siteName: 'HK Biodiversity Collective',
    locale: 'zh-HK',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hong Kong Biodiversity Collective | 香港自然生態匯誌',
    description: 'A collaborative biodiversity encyclopedia of Hong Kong, covering approximately 10,000 species.',
  },
};

import { LanguageProvider } from '@/context/LanguageContext';
import { SpeciesPanelProvider } from '@/context/SpeciesPanelContext';
import { AuthProvider } from '@/context/AuthContext';
import { TaxonomyProvider } from '@/context/TaxonomyContext';
import SpeciesFloatingPanel from '@/components/species/SpeciesFloatingPanel';
import AccountModule from '@/components/profile/AccountModule';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <head>
        {/* 關鍵修正：在 React Hydration 前禁用 scroll restoration 並強制跻動回頂部 */}
        {/* 這確保在 Vercel 生產環境中，無論是第一次開啟还是 Refresh，頁面永遠從 Y=0 開始渲染 */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            if ('scrollRestoration' in history) {
              history.scrollRestoration = 'manual';
            }
            // 強制滚動至頂部，防止瀏覽器 scroll restoration 將 scrollY 設為 > 0
            // 這樣 React Hydration 時 useLayoutEffect 重算 isScrolled 就必為 false
            if (window.scrollY !== 0) {
              window.scrollTo(0, 0);
            }
          })();
        `}} />
      </head>
      <body className={`${workSans.variable} ${outfit.variable} font-sans antialiased text-cyan-900`}>
        <AuthProvider>
          <LanguageProvider>
            <TaxonomyProvider>
              <SpeciesPanelProvider>
                {children}
                <SpeciesFloatingPanel />
                <AccountModule />
              </SpeciesPanelProvider>
            </TaxonomyProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

