import { Metadata } from 'next';
import HomeHero from '@/components/home/HomeHero';
import Header from '@/components/Header';
import SpeciesStats from '@/components/home/SpeciesStats';
import NewsSection from '@/components/home/NewsSection';
import Leaderboard from '@/components/home/Leaderboard';
import LatestComments from '@/components/home/LatestComments';
import { getHomeStats, getLeaderboard, getLatestComments, getLatestSpecies, getLatestNews } from '@/lib/home';
import Link from 'next/link';
import { Globe, Mail, ExternalLink, Shield, BookOpen, Users } from 'lucide-react';

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
  const [stats, leaderboard, comments, latestSpecies, news] = await Promise.all([
    getHomeStats(),
    getLeaderboard(),
    getLatestComments(),
    getLatestSpecies(),
    getLatestNews()
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
      <NewsSection latestSpecies={latestSpecies} news={news} />

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

      {/* Modern Professional Footer */}
      <footer className="bg-[#020b07] text-emerald-50/90 py-16 md:py-24 border-t border-white/5 relative overflow-hidden">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        </div>

        <div className="container mx-auto px-6 md:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 md:gap-16 mb-16 md:mb-20">
            
            {/* Brand Column */}
            <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left">
              <Link href="/" className="flex items-center gap-4 mb-6 md:mb-8 group">
                <div className="p-2 md:p-2.5 bg-emerald-500/10 rounded-2xl border border-white/10 group-hover:border-emerald-500/50 transition-all duration-500">
                  <img src="/logo.svg" alt="Logo" className="w-8 h-8 md:w-10 md:h-10 brightness-110" />
                </div>
                {/* Text Identity - Synced with Header */}
                <div className="flex flex-col justify-center gap-0.5 text-left">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl md:text-2xl font-black text-white tracking-tighter group-hover:text-emerald-400 transition-colors">
                      HK
                    </span>
                    <span className="text-[9px] md:text-[10px] font-light uppercase tracking-[0.2em] text-emerald-400/80">
                      Biodiversity
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-100/80">
                      Collective
                    </span>
                    <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity duration-500">
                      <div className="w-1 h-1 rounded-full bg-emerald-500" />
                      <span className="text-[10px] md:text-[11px] font-medium tracking-widest text-emerald-50 whitespace-nowrap">
                        香港自然生態匯誌
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
              <p className="text-emerald-100/70 leading-relaxed max-w-md text-sm mb-8 md:mb-10 px-4 lg:px-0">
                香港自然生態匯誌 (HKBC) 是一個協作式的生物百科全書，致力於透過科技與社群力量記錄香港每一種生命。
              </p>
              
              <div className="flex items-center gap-4">
                <a 
                  href="mailto:hkbiodiversity.collective@gmail.com" 
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all duration-300"
                  title="Email Us"
                >
                  <Mail className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Links Columns */}
            <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-10 md:gap-12 px-4 md:px-0">
              <div className="flex flex-col items-center md:items-start text-center md:text-left">
                <h4 className="text-white font-bold mb-5 md:mb-6 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-500" />
                  資源中心
                </h4>
                <ul className="space-y-3 md:space-y-4 text-sm text-emerald-100/60">
                  <li><Link href="/database" className="hover:text-emerald-300 transition-colors">物種數據庫</Link></li>
                  <li><Link href="#" className="hover:text-emerald-300 transition-colors">生態誌</Link></li>
                  <li><Link href="#" className="hover:text-emerald-300 transition-colors">分類學指南</Link></li>
                  <li><Link href="#" className="hover:text-emerald-300 transition-colors">數據統計</Link></li>
                </ul>
              </div>

              <div className="flex flex-col items-center md:items-start text-center md:text-left">
                <h4 className="text-white font-bold mb-5 md:mb-6 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  參與貢獻
                </h4>
                <ul className="space-y-3 md:space-y-4 text-sm text-emerald-100/60">
                  <li><Link href="#" className="hover:text-emerald-300 transition-colors">加入我們</Link></li>
                  <li><Link href="#" className="hover:text-emerald-400 transition-colors">iNat 專案</Link></li>
                  <li><Link href="#" className="hover:text-emerald-300 transition-colors">貢獻榜</Link></li>
                </ul>
              </div>

              <div className="col-span-2 md:col-span-1 flex flex-col items-center md:items-start text-center md:text-left">
                <h4 className="text-white font-bold mb-5 md:mb-6 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  法律條款
                </h4>
                <ul className="space-y-3 md:space-y-4 text-sm text-emerald-100/60">
                  <li><Link href="/privacy" className="hover:text-emerald-300 transition-colors">隱私權政策</Link></li>
                  <li><Link href="/terms" className="hover:text-emerald-300 transition-colors">服務條款</Link></li>
                  <li><Link href="#" className="hover:text-emerald-300 transition-colors">版權聲明</Link></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 md:pt-10 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8">
            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 text-[10px] md:text-[11px] font-bold uppercase tracking-[0.15em] md:tracking-[0.2em] text-emerald-500/50 text-center">
              <span>All Rights Reserved</span>
              <span className="hidden md:block w-1 h-1 rounded-full bg-emerald-800"></span>
              <span>&copy; 2026 Hong Kong Biodiversity Collective</span>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Optional footer info can go here */}
            </div>
          </div>
        </div>
      </footer>
      </main>
    </>
  );
}
