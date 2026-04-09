'use client';

import React from 'react';
import Image from 'next/image';
import { Species } from '@/types/species';
import { useLanguage } from '@/context/LanguageContext';
import { Bookmark, Map, ExternalLink, Image as ImageIcon } from 'lucide-react';
import TaxonomyDisplay from './TaxonomyDisplay';
import ConservationStatus from './ConservationStatus';

interface SpeciesContentProps {
  species: Species;
  showBreadcrumb?: boolean;
}

export default function SpeciesContent({ species, showBreadcrumb = true }: SpeciesContentProps) {
  const { language } = useLanguage();

  const commonName = language === 'zh' ? species.common_name_chi : species.common_name_eng;
  const description = language === 'zh' ? species.description_chi : species.description_eng;
  const remarks = language === 'zh' ? species.remarks_chi : species.remarks_eng;
  const hkDist = language === 'zh' ? species.hk_distribution_chi : species.hk_distribution_eng;
  const globalDist = language === 'zh' ? species.global_distribution_chi : species.global_distribution_eng;
  const refs = language === 'zh' ? species.references_chi : species.references_eng;

  return (
    <div className="bg-slate-50 min-h-full">
      {/* Breadcrumb Area - Inside Content but below Tabs */}
      {showBreadcrumb && (
        <div className="bg-white/60 backdrop-blur-sm border-b border-slate-100 px-8 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span>{language === 'zh' ? species.phylum_chi : species.phylum_eng}</span>
            <span>/</span>
            <span>{language === 'zh' ? species.class_chi : species.class_eng}</span>
            <span>/</span>
            <span>{language === 'zh' ? species.order_chi : species.order_eng}</span>
            <span>/</span>
            <span className="text-emerald-600">{language === 'zh' ? species.family_chi : species.family_eng}</span>
          </div>
        </div>
      )}

      {/* Hero Header */}
      <div className="w-full h-[40vh] min-h-[300px] bg-slate-900 relative overflow-hidden">
        <Image 
          src={species.image_url || 'https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?q=80&w=1080&auto=format&fit=crop'} 
          alt={commonName}
          fill
          className="object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />
        
        <div className="absolute bottom-0 left-0 w-full p-8 md:p-12">
          <div className="max-w-7xl mx-auto">
            <span className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-[10px] font-bold tracking-widest uppercase mb-4">
              {species.taxa_group} • ID: {species.species_id}
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-2 leading-tight">
              {commonName}
            </h1>
            <p className="text-lg md:text-xl text-emerald-50 font-serif tracking-wide italic">
              {species.scientific_name} <span className="text-emerald-200/60 not-italic text-sm ml-2">{species.author}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column */}
          <div className="lg:col-span-8 space-y-12">
            
            {/* Taxonomy Section - New Design */}
            <TaxonomyDisplay species={species} />

            {/* Description */}
            {description && (
              <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                  <Bookmark className="w-6 h-6 text-emerald-500" />
                  {language === 'zh' ? '形態特徵' : 'Description'}
                </h2>
                <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed">
                  <p>{description}</p>
                </div>
              </section>
            )}

            {/* Remarks */}
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

            {/* Distribution */}
            <section className="space-y-6">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <Map className="w-6 h-6 text-emerald-500" />
                {language === 'zh' ? '地理分佈' : 'Distribution'}
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <h3 className="font-black text-slate-800 mb-2">{language === 'zh' ? '香港分佈' : 'HK Distribution'}</h3>
                  <p className="text-slate-600 text-sm">{hkDist || '-'}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <h3 className="font-black text-slate-800 mb-2">{language === 'zh' ? '全球分佈' : 'Global Distribution'}</h3>
                  <p className="text-slate-600 text-sm">{globalDist || '-'}</p>
                </div>
              </div>
            </section>

            {/* References */}
            {refs && (
              <section className="bg-slate-900 text-slate-300 p-8 rounded-[2.5rem]">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <ExternalLink className="w-5 h-5 text-emerald-400" />
                  {language === 'zh' ? '參考文獻' : 'References'}
                </h2>
                <ul className="space-y-4 text-xs leading-relaxed opacity-80 list-disc pl-5">
                  {refs.split('。/').map((ref, idx) => (
                    <li key={idx}>{ref.trim()}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Right Column - Conservation Status (Sticky) */}
          <div className="lg:col-span-4">
            <div className="sticky top-8">
              <ConservationStatus species={species} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
