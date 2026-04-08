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
  title: 'Hong Kong Biodiversity Collective',
  description: 'A comprehensive biodiversity encyclopedia of Hong Kong, covering approximately 10,000 species.',
};

import { LanguageProvider } from '@/context/LanguageContext';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className={`${workSans.variable} ${outfit.variable} font-sans antialiased text-cyan-900`}>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}

