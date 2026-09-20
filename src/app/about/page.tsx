'use client';

import Header from '@/components/Header';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Database, Leaf, Users } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

export default function AboutPage() {
  const { language } = useLanguage();
  const isZh = language === 'zh';
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <main className="mx-auto max-w-6xl px-6 pb-20 pt-36 md:px-10">
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[2.5rem] bg-emerald-900 p-8 text-white shadow-2xl shadow-emerald-900/10 md:p-16">
          <div className="max-w-3xl">
            <p className="mb-4 text-xs font-black uppercase tracking-[0.28em] text-emerald-300">About HK Biodiversity Collective</p>
            <h1 className="mb-6 text-4xl font-black tracking-tight md:text-6xl">{isZh ? '認識我們' : 'About Us'}</h1>
            <p className="text-lg leading-relaxed text-emerald-50 md:text-xl">{isZh ? '以開放、可靠及協作的方式，記錄香港每一種生命。' : 'Documenting every form of life in Hong Kong through open, reliable and collaborative knowledge.'}</p>
          </div>
        </motion.section>

        <section className="grid gap-6 py-14 md:grid-cols-3">
          {[
            { icon: Database, title: isZh ? '生物資料庫' : 'Biodiversity database', text: isZh ? '集中整理香港物種、分類、分布及保育狀況，讓資料更容易被查找和理解。' : 'A structured home for Hong Kong species, taxonomy, distribution and conservation information.' },
            { icon: BookOpen, title: isZh ? '生態知識' : 'Ecological knowledge', text: isZh ? '透過 Eco-Journal 分享研究、觀察、物種故事和保育觀點。' : 'The Eco-Journal shares research, observations, species stories and conservation perspectives.' },
            { icon: Users, title: isZh ? '社群協作' : 'Community collaboration', text: isZh ? '連結自然愛好者、研究者和策展人，共同補充及核實香港的自然記錄。' : 'We connect nature lovers, researchers and curators to improve Hong Kong’s natural records together.' },
          ].map(({ icon: Icon, title, text }) => <article key={title} className="rounded-3xl border border-slate-100 bg-white p-7 shadow-lg shadow-slate-200/40"><Icon className="mb-6 h-8 w-8 text-emerald-600" /><h2 className="mb-3 text-xl font-black">{title}</h2><p className="leading-relaxed text-slate-600">{text}</p></article>)}
        </section>

        <motion.section initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-8 md:p-12">
          <Leaf className="mb-5 h-9 w-9 text-emerald-700" />
          <h2 className="mb-4 text-3xl font-black">{isZh ? '本站簡介' : 'About this website'}</h2>
          <p className="max-w-4xl text-lg leading-8 text-slate-700">{isZh ? '香港生物多樣性資料庫是一個以香港自然環境為核心的協作平台，整合物種搜尋、分類瀏覽、照片及聲音記錄、地圖探索、保育狀況與社群貢獻等功能。使用者可以按常用名稱、學名或分類群組尋找資料，亦可收藏物種、分享觀察、參與討論，並透過 AI 影像辨識探索身邊的生物。我們希望把分散的自然資料轉化為清晰、可親近且持續更新的公共知識，支援公眾教育、自然觀察、研究及保育工作。' : 'Hong Kong Biodiversity Collective is a collaborative platform centred on Hong Kong’s natural environment. It brings together species search, taxonomy browsing, photo and sound records, map exploration, conservation status and community contributions. Users can find species by common name, scientific name or taxonomic group; bookmark discoveries, share observations, join discussions and use AI-assisted image identification to explore the life around them. We turn scattered natural records into clear, accessible and continuously improving public knowledge for education, nature observation, research and conservation.'}</p>
          <Link href="/about/curators" className="mt-8 inline-flex items-center gap-2 font-black text-emerald-700 transition-colors hover:text-emerald-900">{isZh ? '了解策展人' : 'Meet our curators'} <ArrowRight className="h-4 w-4" /></Link>
        </motion.section>
      </main>
    </div>
  );
}
