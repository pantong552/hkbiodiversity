import { Metadata } from 'next';
import HomeHero from '@/components/home/HomeHero';
import Header from '@/components/Header';
import SpeciesStats from '@/components/home/SpeciesStats';
import NewsSection from '@/components/home/NewsSection';
import Leaderboard from '@/components/home/Leaderboard';
import LatestComments from '@/components/home/LatestComments';
import { getHomeStats, getLeaderboard, getLatestComments, getLatestSpecies } from '@/lib/home';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // 每小時重新驗證一次

export const metadata: Metadata = {
  title: 'Hong Kong Biodiversity Collective | 香港自然生態匯誌',
  description: 'A collaborative biodiversity encyclopedia of Hong Kong, covering approximately 10,000 species.',
  openGraph: {
    title: 'Hong Kong Biodiversity Collective | 香港自然生態匯誌',
    description: 'A collaborative biodiversity encyclopedia of Hong Kong, covering approximately 10,000 species.',
    type: 'website',
    url: 'https://hkbiodiversity.org',
    images: [
      {
        url: 'https://hkbiodiversity.org/api/og',
        width: 1200,
        height: 630,
        alt: 'HKBC',
      }
    ]
  },
};

export default async function HomePage() {
  // 並行獲取所有數據
  const [stats, leaderboard, comments, latestSpecies] = await Promise.all([
    getHomeStats(),
    getLeaderboard(),
    getLatestComments(),
    getLatestSpecies()
  ]);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        {/* 1. Hero Section */}
        <HomeHero />

      {/* 2. Stats Section */}
      <SpeciesStats stats={stats} />

      {/* 3. News & New Species Section */}
      <NewsSection latestSpecies={latestSpecies} />

      {/* 4. Leaderboard & Latest Comments Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-5 gap-10">
            <div className="lg:col-span-3">
              <LatestComments comments={comments} />
            </div>
            <div className="lg:col-span-2">
              <Leaderboard users={leaderboard} />
            </div>
          </div>
        </div>
      </section>

      {/* Footer Branding */}
      <section className="py-20 border-t border-slate-100 bg-slate-50">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-4 mb-6">
            <img src="/logo.svg" alt="Logo" className="w-12 h-12" />
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter">HKBC</h2>
          </div>
          <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-xs">
            Hong Kong Biodiversity Collective
          </p>
        </div>
      </section>
      </main>
    </>
  );
}
