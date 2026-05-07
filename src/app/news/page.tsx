'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/Header';
import { Calendar, ArrowLeft, Megaphone, ChevronRight, Clock, ChevronDown, ChevronUp, Filter, X, ChevronLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

const ITEMS_PER_PAGE = 10;

function NewsContent() {
  const { language, t } = useLanguage();
  const searchParams = useSearchParams();
  const [allNews, setAllNews] = useState<any[]>([]);
  const [selectedNews, setSelectedNews] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from('site_news')
        .select('*')
        .order('published_at', { ascending: false });
      
      const newsList = data || [];
      setAllNews(newsList);

      const id = searchParams.get('id');
      if (id) {
        const found = newsList.find(n => n.id === id);
        if (found) {
          setSelectedNews(found);
          window.history.replaceState(null, '', '/news');
        }
      }
      setLoading(false);
    }
    fetchData();
  }, [searchParams]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterCategory]);

  const filteredNews = useMemo(() => {
    if (!filterCategory) return allNews;
    return allNews.filter(n => n.category === filterCategory);
  }, [allNews, filterCategory]);

  const totalPages = Math.ceil(filteredNews.length / ITEMS_PER_PAGE);
  const paginatedNews = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredNews.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredNews, currentPage]);

  const getCategoryName = (cat: string) => {
    if (language !== 'zh') return cat;
    const mapping: any = {
      'System': '系統維護',
      'Community': '社群消息',
      'Taxonomy': '物種更新',
      'Notice': '公告',
      'Sales': '商品消息'
    };
    return mapping[cat] || cat;
  };

  const getCategoryColor = (cat: string) => {
    const mapping: any = {
      'System': 'bg-slate-100 text-slate-600 border-slate-200',
      'Community': 'bg-emerald-50 text-emerald-700 border-emerald-100',
      'Taxonomy': 'bg-amber-50 text-amber-700 border-amber-100',
      'Notice': 'bg-blue-50 text-blue-700 border-blue-100',
      'Sales': 'bg-rose-50 text-rose-700 border-rose-100'
    };
    return mapping[cat] || 'bg-slate-50 text-slate-600 border-slate-100';
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 w-full box-border overflow-x-hidden">
      <AnimatePresence mode="wait">
        {selectedNews ? (
          <motion.div 
            key="detail"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden"
          >
            <div className="p-6 md:p-10 border-b border-slate-100 bg-slate-50/50">
              <button 
                onClick={() => setSelectedNews(null)}
                className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-bold text-xs uppercase tracking-widest mb-8 transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                {language === 'zh' ? '返回列表' : 'Back to list'}
              </button>

              <div className="flex flex-wrap items-center gap-3 mb-6">
                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getCategoryColor(selectedNews.category)}`}>
                  {getCategoryName(selectedNews.category)}
                </span>
                <div className="flex items-center gap-4 text-slate-400 text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(selectedNews.published_at).toLocaleDateString(language === 'zh' ? 'zh-HK' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(selectedNews.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <h1 className="text-3xl md:text-4xl font-black text-slate-900 leading-tight mb-4 tracking-tight">
                {language === 'zh' ? selectedNews.title_chi : selectedNews.title_eng}
              </h1>
              {language === 'zh' && (
                <p className="text-xl font-bold text-slate-400 leading-snug tracking-tight opacity-70">
                  {selectedNews.title_eng}
                </p>
              )}
            </div>

            <div className="p-6 md:p-10 grid lg:grid-cols-2 gap-12 lg:gap-16">
              <section>
                <div className="flex items-center gap-2 mb-6">
                   <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                   <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">{language === 'zh' ? '中文內容' : 'Chinese Content'}</h2>
                </div>
                <div className="news-content prose prose-slate max-w-none">
                  <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                    {selectedNews.content_chi.replace(/\\n/g, '\n')}
                  </ReactMarkdown>
                </div>
              </section>

              <section className="lg:border-l lg:border-slate-100 lg:pl-16">
                <div className="flex items-center gap-2 mb-6">
                   <div className="w-1.5 h-6 bg-slate-300 rounded-full"></div>
                   <h2 className="text-sm font-black text-slate-400 uppercase tracking-wider font-mono">{language === 'zh' ? '英文內容' : 'English Content'}</h2>
                </div>
                <div className="news-content prose prose-slate max-w-none opacity-80">
                  <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                    {selectedNews.content_eng.replace(/\\n/g, '\n')}
                  </ReactMarkdown>
                </div>
              </section>
            </div>
          </motion.div>
        ) : (
          <div className="grid lg:grid-cols-4 gap-8">
            <aside className="lg:col-span-1 space-y-4">
              <div className="p-6 bg-emerald-600 rounded-3xl text-white shadow-xl shadow-emerald-600/20 relative overflow-hidden group">
                <Megaphone className="w-20 h-20 absolute -right-4 -bottom-4 text-white/10 rotate-12 group-hover:scale-110 transition-transform duration-500" />
                <h2 className="text-2xl font-black mb-1 relative z-10">{language === 'zh' ? '最新公告' : 'News'}</h2>
                <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest relative z-10 opacity-80">
                  {language === 'zh' ? '網站更新與消息' : 'Latest Updates'}
                </p>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
                <button 
                  onClick={() => setIsNavOpen(!isNavOpen)}
                  className="w-full flex items-center justify-between p-6 lg:cursor-default"
                >
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5" />
                    {language === 'zh' ? '分類過濾' : 'Categories'}
                  </h3>
                  <div className="lg:hidden">
                    {isNavOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                <div className={`px-4 pb-6 space-y-1 ${isNavOpen ? 'block' : 'hidden lg:block'}`}>
                  <button
                    onClick={() => {
                      setFilterCategory(null);
                      setIsNavOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${!filterCategory ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <span className="text-sm font-bold">{language === 'zh' ? '全部消息' : 'All News'}</span>
                    {!filterCategory && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>}
                  </button>

                  {['System', 'Community', 'Taxonomy', 'Notice', 'Sales'].map(cat => (
                    <button 
                      key={cat} 
                      onClick={() => {
                        setFilterCategory(cat);
                        setIsNavOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${filterCategory === cat ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      <span className="text-sm font-bold">
                        {getCategoryName(cat)}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md transition-colors ${filterCategory === cat ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        {allNews.filter(n => n.category === cat).length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <div className="lg:col-span-3 space-y-3 w-full max-w-full overflow-hidden flex flex-col">
              {filterCategory && (
                <div className="flex items-center justify-between bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">正在顯示：</span>
                    <span className="px-3 py-1 bg-white border border-emerald-200 text-emerald-700 text-[10px] font-black rounded-lg uppercase tracking-widest">
                      {getCategoryName(filterCategory)}
                    </span>
                  </div>
                  <button 
                    onClick={() => setFilterCategory(null)}
                    className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {paginatedNews.length > 0 ? (
                <div className="space-y-2">
                  {paginatedNews.map((item, idx) => (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => setSelectedNews(item)}
                      className="w-full flex items-center gap-3 md:gap-4 p-2.5 md:p-3.5 bg-white rounded-xl border border-slate-200/60 hover:border-emerald-500/50 hover:shadow-md hover:shadow-emerald-500/5 transition-all duration-300 group text-left relative overflow-hidden box-border"
                    >
                      <div className="hidden md:flex flex-col items-center justify-center w-12 h-12 bg-slate-50 rounded-lg border border-slate-100 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-colors">
                        <span className="text-[9px] font-black text-slate-400 group-hover:text-emerald-400 uppercase tracking-tighter leading-none">
                          {new Date(item.published_at).toLocaleString('en-US', { month: 'short' })}
                        </span>
                        <span className="text-lg font-black text-slate-700 group-hover:text-emerald-700 leading-none mt-0.5">
                          {new Date(item.published_at).getDate()}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${getCategoryColor(item.category)}`}>
                            {getCategoryName(item.category)}
                          </span>
                          <span className="md:hidden text-[10px] font-bold text-slate-400">
                            {new Date(item.published_at).toISOString().split('T')[0]}
                          </span>
                        </div>
                        <h3 className="text-sm md:text-base font-black text-slate-800 group-hover:text-emerald-700 transition-colors truncate">
                          {language === 'zh' ? item.title_chi : item.title_eng}
                        </h3>
                      </div>

                      <div className="shrink-0 w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-emerald-500 group-hover:text-white transition-all transform group-hover:translate-x-1">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-white rounded-3xl border border-slate-200/60 border-dashed">
                  <div className="text-slate-300 mb-4 flex justify-center">
                    <Filter className="w-12 h-12 opacity-20" />
                  </div>
                  <p className="text-slate-400 font-bold">該分類下暫無任何公告</p>
                </div>
              )}

              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-emerald-600 hover:border-emerald-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`w-8 h-8 rounded-lg text-xs font-black transition-all border ${
                          currentPage === page 
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/10' 
                            : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-500/30 hover:text-emerald-600'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-emerald-600 hover:border-emerald-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .news-content {
          color: #334155;
          font-size: 1rem;
          line-height: 1.7;
          word-break: break-word;
          overflow-wrap: break-word;
        }
        .news-content p {
          margin-bottom: 1.25rem;
        }
        .news-content strong {
          font-weight: 800;
          color: #1e293b;
        }
        .news-content h1, .news-content h2, .news-content h3 {
          font-weight: 900;
          color: #0f172a;
          margin-top: 2rem;
          margin-bottom: 1rem;
          letter-spacing: -0.025em;
        }
        .news-content h1 { font-size: 1.5rem; }
        .news-content h2 { font-size: 1.25rem; }
        .news-content blockquote {
          border-left: 4px solid #10b981;
          padding: 0.75rem 1.25rem;
          background: #f8fafc;
          border-radius: 0 0.75rem 0.75rem 0;
          font-style: italic;
          margin: 1.5rem 0;
          color: #475569;
        }
        .news-content ul {
          list-style-type: disc;
          padding-left: 1.25rem;
          margin-bottom: 1.25rem;
        }
        .news-content li {
          margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  );
}

export default function NewsPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#fcfdfd] pt-36 md:pt-44 pb-20 overflow-x-hidden">
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
          </div>
        }>
          <NewsContent />
        </Suspense>
      </main>
    </>
  );
}
