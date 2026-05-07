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

