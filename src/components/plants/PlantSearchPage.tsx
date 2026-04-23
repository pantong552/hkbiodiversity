'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { PlantSpecies, PlantFilterState } from '@/types/plants';
import PlantFilterPanel from './PlantFilterPanel';
import { useLanguage } from '@/context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf, Calendar, MapPin, Loader2, Info } from 'lucide-react';
import Image from 'next/image';

const INITIAL_FILTERS: PlantFilterState = {
  searchQuery: '',
  categories: [],
  families: [],
  genuses: [],
  origins: [],
  floweringMonths: [],
  fruitingMonths: [],
  isCap96: null,
  isCap586: null,
  isRare: null,
  isInChinaRedBook: null,
};

const PlantCard = ({ plant }: { plant: PlantSpecies }) => {
  const { language } = useLanguage();
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="group bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 transition-all flex flex-col"
    >
      {/* Category Tag */}
      <div className="px-6 pt-6 flex justify-between items-start gap-2">
        <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-widest">
          {language === 'zh' ? plant.category_zh : plant.category_en}
        </span>
        <div className="flex gap-1">
          {plant.is_cap96 === 'Y' && (
            <span className="w-6 h-6 flex items-center justify-center bg-amber-100 text-amber-600 rounded-lg text-[10px] font-black" title="Cap. 96">96</span>
          )}
          {plant.is_cap586 === 'Y' && (
            <span className="w-6 h-6 flex items-center justify-center bg-rose-100 text-rose-600 rounded-lg text-[10px] font-black" title="Cap. 586">586</span>
          )}
        </div>
      </div>

      <div className="p-6 space-y-4 flex-grow">
        <div>
          <h3 className="text-xl font-black text-slate-800 leading-tight group-hover:text-emerald-600 transition-colors">
            {plant.common_name_zh || plant.scientific_name}
          </h3>
          <p className="text-sm font-serif italic text-slate-400 mt-1">
            {plant.scientific_name}
          </p>
        </div>

        <div className="flex flex-wrap gap-y-2 gap-x-4 text-xs font-bold text-slate-500">
          <div className="flex items-center gap-1.5">
            <Leaf className="w-3.5 h-3.5 text-emerald-500" />
            {plant.family_zh} ({plant.family_en})
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            {plant.origin}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-50 grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{language === 'zh' ? '花期' : 'Flowering'}</span>
            <div className="flex gap-1">
              {plant.flowering_months?.slice(0, 4).map(m => (
                <span key={m} className="w-5 h-5 flex items-center justify-center bg-pink-50 text-pink-500 rounded text-[10px] font-black">{m}</span>
              ))}
              {(plant.flowering_months?.length ?? 0) > 4 && <span className="text-[10px] text-slate-300 font-bold self-center">...</span>}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{language === 'zh' ? '果期' : 'Fruiting'}</span>
            <div className="flex gap-1">
              {plant.fruiting_months?.slice(0, 4).map(m => (
                <span key={m} className="w-5 h-5 flex items-center justify-center bg-purple-50 text-purple-500 rounded text-[10px] font-black">{m}</span>
              ))}
              {(plant.fruiting_months?.length ?? 0) > 4 && <span className="text-[10px] text-slate-300 font-bold self-center">...</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 bg-slate-50/50 group-hover:bg-emerald-50 transition-colors">
        <button className="w-full py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 hover:bg-emerald-600 hover:border-emerald-600 hover:text-white transition-all shadow-sm">
          {language === 'zh' ? '查看詳情' : 'View Details'}
        </button>
      </div>
    </motion.div>
  );
};

export default function PlantSearchPage() {
  const { language } = useLanguage();
  const supabase = createClient();
  const [plants, setPlants] = useState<PlantSpecies[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PlantFilterState>(INITIAL_FILTERS);
  const [categories, setCategories] = useState<{ zh: string; en: string; display: string }[]>([]);

  // Fetch unique categories once
  useEffect(() => {
    const fetchMeta = async () => {
      const { data } = await supabase.from('plant_species').select('category_zh, category_en').not('category_zh', 'is', null);
      if (data) {
        const uniqueKeys = new Set();
        const cats: any[] = [];
        data.forEach((item: { category_zh: string; category_en: string }) => {
          if (!uniqueKeys.has(item.category_zh)) {
            uniqueKeys.add(item.category_zh);
            cats.push({
              zh: item.category_zh,
              en: item.category_en,
              display: language === 'zh' ? item.category_zh : (item.category_en || item.category_zh)
            });
          }
        });
        setCategories(cats);
      }
    };
    fetchMeta();
  }, [supabase, language]);

  useEffect(() => {
    const fetchPlants = async () => {
      setLoading(true);
      let query = supabase.from('plant_species').select('*');

      if (filters.searchQuery) {
        query = query.textSearch('fts', filters.searchQuery, { type: 'plain', config: 'simple' });
      }

      if (filters.categories.length > 0) query = query.in('category_zh', filters.categories);
      if (filters.isCap96) query = query.eq('is_cap96', 'Y');
      if (filters.isCap586) query = query.eq('is_cap586', 'Y');
      if (filters.isRare) query = query.neq('hk_rare_precious_note', 'No');
      if (filters.isInChinaRedBook) query = query.neq('china_red_data_book_note', '沒有列入');
      if (filters.floweringMonths.length > 0) query = query.overlaps('flowering_months', filters.floweringMonths);
      if (filters.fruitingMonths.length > 0) query = query.overlaps('fruiting_months', filters.fruitingMonths);

      const { data } = await query.limit(100);
      if (data) setPlants(data);
      setLoading(false);
    };

    const timer = setTimeout(fetchPlants, 500);
    return () => clearTimeout(timer);
  }, [filters, supabase]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
      <header className="space-y-4">
        <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight">
          {language === 'zh' ? '植物資料庫' : 'Plant Database'}
        </h1>
        <p className="text-lg text-slate-500 font-medium max-w-2xl leading-relaxed">
          {language === 'zh' 
            ? '探索香港豐富的植物多樣性。根據分類、科別、花期與果期進行篩選。' 
            : 'Explore Hong Kong\'s rich plant biodiversity. Filter by category, family, flowering, and fruiting periods.'}
        </p>
      </header>

      <div className="sticky top-20 z-40 bg-slate-50/80 backdrop-blur-md py-4 -mx-6 px-6">
        <PlantFilterPanel 
          filters={filters}
          setFilters={setFilters}
          availableCategories={categories}
          availableFamilies={[]} 
          availableGenuses={[]}
          onReset={() => setFilters(INITIAL_FILTERS)}
        />
      </div>

      <div className="min-h-[400px] relative">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-12 space-y-4">
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
            <p className="font-bold text-slate-400 animate-pulse uppercase tracking-widest text-xs">
              {language === 'zh' ? '搜尋中...' : 'Searching...'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
                {language === 'zh' ? `共找到 ${plants.length} 個結果` : `Found ${plants.length} results`}
              </h2>
            </div>
            
            <AnimatePresence mode="popLayout">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {plants.map((plant) => (
                  <PlantCard key={plant.id} plant={plant} />
                ))}
              </div>
            </AnimatePresence>

            {plants.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-[3rem] border border-slate-100 shadow-sm">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <Info className="w-8 h-8 text-slate-200" />
                </div>
                <h3 className="text-xl font-black text-slate-800">{language === 'zh' ? '找不到相關植物' : 'No plants found'}</h3>
                <p className="text-slate-400 mt-2 max-w-xs mx-auto">
                  {language === 'zh' ? '請嘗試調整篩選條件或搜尋關鍵字' : 'Try adjusting your filters or search terms'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
