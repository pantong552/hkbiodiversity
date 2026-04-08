'use client';

import { use, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Map, ExternalLink, Bookmark, Image as ImageIcon } from 'lucide-react';
import { MOCK_SPECIES } from '../../../data/mockSpecies';
import { useLanguage } from '../../../context/LanguageContext';

export default function SpeciesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { language } = useLanguage();
  const unwrappedParams = use(params);
  
  const species = useMemo(() => {
    return MOCK_SPECIES.find(s => s.slug === unwrappedParams.id || s.id.toString() === unwrappedParams.id) || MOCK_SPECIES[0];
  }, [unwrappedParams.id]);

  if (!species) {
    return <div className="p-20 text-center">Species not found</div>;
  }

  // Formatting strings
  const commonName = language === 'zh' ? species.common_name : species.common_name_en;
  const phylum = language === 'zh' ? species.phylum_chi : species.phylum;
  const classTax = language === 'zh' ? species.class_chi : species.class;
  const order = language === 'zh' ? species.order_chi : species.order;
  const family = language === 'zh' ? species.family_chi : species.family;
  
  const description = language === 'zh' ? species.description_chi : species.description_en;
  const remarks = language === 'zh' ? species.remarks_chi : species.remarks_en;
  const hkDist = language === 'zh' ? species.hk_distribution_chi : species.hk_distribution_en;
  const globalDist = language === 'zh' ? species.global_distribution_chi : species.global_distribution_en;
  const refs = language === 'zh' ? species.references_chi : species.references_en;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Navigation Bar / Breadcrumb area */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-emerald-600 font-bold hover:text-emerald-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            {language === 'zh' ? '返回圖鑑' : 'Back to Directory'}
          </Link>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>{phylum}</span>
            <span>/</span>
            <span>{classTax}</span>
            <span>/</span>
            <span>{order}</span>
            <span>/</span>
            <span className="text-emerald-700">{family}</span>
          </div>
        </div>
      </div>

      {/* Hero Banner Placeholder for Cloudinary Image Gallery */}
      <div className="w-full h-[50vh] min-h-[400px] bg-slate-200 relative group overflow-hidden">
        <Image 
          src={species.image_url} 
          alt={commonName}
          fill
          className="object-cover transition-transform duration-1000 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-emerald-900/30 to-transparent" />
        
        {/* Placeholder UI for Gallery indicator */}
        <div className="absolute bottom-6 right-6 px-4 py-2 bg-black/40 backdrop-blur-md rounded-2xl border border-white/20 flex items-center gap-2 text-white text-sm font-medium">
          <ImageIcon className="w-4 h-4" />
          {language === 'zh' ? '圖片庫 (即將推出)' : 'Image Gallery (Coming Soon)'}
        </div>

        {/* Hero Content */}
        <div className="absolute bottom-0 left-0 w-full p-8 md:p-12 lg:px-16 pb-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap items-end gap-6 justify-between">
              <div>
                <span className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-xs font-bold tracking-widest uppercase mb-4">
                  {language === 'zh' ? species.taxa_group : species.taxa_group} • ID: {species.species_id}
                </span>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-2 leading-tight drop-shadow-lg">
                  {commonName}
                </h1>
                <p className="text-xl md:text-2xl text-emerald-50 font-serif tracking-wide drop-shadow-md">
                  <span className="italic">{species.scientific_name}</span> 
                  <span className="text-emerald-200/80 text-lg ml-2">{species.author}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column (70%) */}
          <div className="lg:col-span-8 space-y-12">
            
            {/* Description Section */}
            {description && (
              <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                  <Bookmark className="w-6 h-6 text-emerald-500" />
                  {language === 'zh' ? '形態特徵' : 'Description'}
                </h2>
                <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed text-lg">
                  <p>{description}</p>
                </div>
              </section>
            )}

            {/* Remarks Section */}
            {remarks && (
              <section className="bg-emerald-50/50 p-8 rounded-[2.5rem] border border-emerald-100/50">
                <h2 className="text-xl font-bold text-emerald-900 mb-4">
                  {language === 'zh' ? '備註' : 'Remarks'}
                </h2>
                <p className="text-emerald-800/80 leading-relaxed">
                  {remarks}
                </p>
              </section>
            )}

            {/* MapBox Banner Placeholder */}
            <section className="space-y-6">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <Map className="w-6 h-6 text-emerald-500" />
                {language === 'zh' ? '地理分佈' : 'Distribution'}
              </h2>
              
              <div className="w-full h-[300px] bg-slate-200 rounded-[2.5rem] border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500 relative overflow-hidden group">
                {/* Simulated map background grid */}
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, slate-400 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
                <Map className="w-12 h-12 mb-3 text-slate-400 group-hover:scale-110 transition-transform" />
                <p className="font-bold text-lg">{language === 'zh' ? 'MapBox 地圖整合即將推出' : 'MapBox Integration Coming Soon'}</p>
                <p className="text-sm mt-1">{language === 'zh' ? '預留全站滿版展示佈局' : 'Reserved for full-width geographic display'}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mt-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <h3 className="font-black text-slate-800 mb-2">{language === 'zh' ? '香港分佈' : 'HK Distribution'}</h3>
                  <p className="text-slate-600">{hkDist}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <h3 className="font-black text-slate-800 mb-2">{language === 'zh' ? '全球分佈' : 'Global Distribution'}</h3>
                  <p className="text-slate-600">{globalDist}</p>
                </div>
              </div>
            </section>

            {/* References Section */}
            {refs && (
              <section className="bg-slate-900 text-slate-300 p-8 rounded-[2.5rem]">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <ExternalLink className="w-5 h-5 text-emerald-400" />
                  {language === 'zh' ? '參考文獻' : 'References'}
                </h2>
                <ul className="space-y-4 text-sm leading-relaxed opacity-80 list-disc pl-5">
                  {refs.split('。/').map((ref, idx) => (
                    <li key={idx}>{ref.trim()}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Right Column (30% Sticky) - Conservation Status */}
          <div className="lg:col-span-4">
            <div className="sticky top-28 bg-white p-8 rounded-[2.5rem] shadow-premium border border-slate-100 shadow-xl shadow-emerald-900/5 transition-all">
              <h3 className="text-xl font-black text-slate-800 mb-8 pb-4 border-b border-slate-100">
                {language === 'zh' ? '保育與生存狀態' : 'Conservation & Status'}
              </h3>
              
              <div className="space-y-6">
                <StatusRow label={language === 'zh' ? 'IUCN 紅皮書' : 'IUCN Red List'} value={species.iucn} isPrimary />
                <StatusRow label={language === 'zh' ? '中國紅皮書' : 'China Red List'} value={species.china_red_list} />
                <StatusRow label={language === 'zh' ? '中國脊椎動物紅皮書' : 'China Vertebrates'} value={species.china_vertebrates_red_list} />
                <StatusRow label={language === 'zh' ? '香港保護法例' : 'HK Protection'} value={species.hk_protection} />
                <StatusRow label={language === 'zh' ? '香港原生概況' : 'Native Status'} value={species.native_status} />
                {species.endemic && <StatusRow label={language === 'zh' ? '特有區域' : 'Endemic'} value={species.endemic} />}
                {species.cites && <StatusRow label="CITES" value={species.cites} />}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, value, isPrimary = false }: { label: string, value?: string, isPrimary?: boolean }) {
  if (!value) return null;
  
  return (
    <div className="flex flex-col">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{label}</span>
      <span className={`
        text-sm font-semibold
        ${isPrimary ? 'px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 inline-block w-fit' : 'text-slate-700'}
      `}>
        {value}
      </span>
    </div>
  );
}
