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
  title: '地區生物圖鑑 | Regional Biodiversity Encyclopedia',
  description: '涵蓋約一萬種物種的生物圖鑑平台',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className={`${workSans.variable} ${outfit.variable} font-sans antialiased text-cyan-900`}>
        {children}
      </body>
    </html>
  );
}
