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
    icon: '/logo.svg',
    shortcut: '/logo/favicon.ico',
    apple: [
      { url: '/logo/apple-touch-icon-57x57.png', sizes: '57x57', type: 'image/png' },
      { url: '/logo/apple-touch-icon-72x72.png', sizes: '72x72', type: 'image/png' },
      { url: '/logo/apple-touch-icon-76x76.png', sizes: '76x76', type: 'image/png' },
      { url: '/logo/apple-touch-icon-114x114.png', sizes: '114x114', type: 'image/png' },
      { url: '/logo/apple-touch-icon-120x120.png', sizes: '120x120', type: 'image/png' },
      { url: '/logo/apple-touch-icon-144x144.png', sizes: '144x144', type: 'image/png' },
      { url: '/logo/apple-touch-icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/logo/apple-touch-icon-180x180.png', sizes: '180x180', type: 'image/png' },
    ],
  },
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
import SpeciesFloatingPanel from '@/components/species/SpeciesFloatingPanel';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className={`${workSans.variable} ${outfit.variable} font-sans antialiased text-cyan-900`}>
        <AuthProvider>
          <LanguageProvider>
            <SpeciesPanelProvider>
              {children}
              <SpeciesFloatingPanel />
            </SpeciesPanelProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

