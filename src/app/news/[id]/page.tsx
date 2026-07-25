import { getNewsById } from '@/lib/home';
import Header from '@/components/Header';
import { useLanguage } from '@/context/LanguageContext';
import { Calendar, Tag, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import rehypeExternalLinks from 'rehype-external-links';
import { notFound } from 'next/navigation';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const news = await getNewsById(id);
  if (!news) return { title: 'News Not Found' };

  return {
    title: `${news.title_chi} | ${news.title_eng} - HKBC News`,
    description: news.content_chi.substring(0, 160),
  };
}

export default async function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const news = await getNewsById(id);

  if (!news) {
    notFound();
  }

  return <NewsDetailClient news={news} />;
}

// 由於我們需要使用 useLanguage (Client Context)，我們建立一個 Client Component 封裝內容
// 或者更簡單地，我們在 Server Component 中處理翻譯邏輯
function NewsDetailClient({ news }: { news: any }) {
  // 這裡我們直接在頁面內部處理語言邏輯，避免過度複雜化
  // 雖然我們是在 Server Component，但我們可以傳遞給一個 Client Component 渲染
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white pt-32 pb-24">
        <div className="container mx-auto px-6 max-w-4xl">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-600 font-bold text-sm mb-12 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            BACK TO HOME / 返回首頁
          </Link>

          <header className="mb-12">
            <div className="flex items-center gap-4 mb-6">
              <span className="px-4 py-1.5 bg-blue-50 text-[11px] font-black text-blue-600 uppercase tracking-widest rounded-full">
                {news.category}
              </span>
              <span className="text-sm font-bold text-slate-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> 
                {new Date(news.published_at).toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
              {news.title_chi}
            </h1>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-400 tracking-tight leading-tight">
              {news.title_eng}
            </h2>
          </header>

          <article className="grid md:grid-cols-2 gap-12 border-t border-slate-100 pt-12">
            {/* Chinese Content */}
            <div className="prose prose-slate prose-lg max-w-none">
              <div className="flex items-center gap-2 mb-6 text-slate-900 font-black uppercase tracking-wider text-sm border-b-2 border-blue-500 pb-2 w-fit">
                中文內容
              </div>
              <div className="news-content">
                <ReactMarkdown 
                  rehypePlugins={[
                    rehypeRaw,
                    [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }]
                  ]}
                  remarkPlugins={[remarkBreaks]}
                >
                  {news.content_chi.replace(/\\n/g, '\n')}
                </ReactMarkdown>
              </div>
            </div>

            {/* English Content */}
            <div className="prose prose-slate prose-lg max-w-none">
              <div className="flex items-center gap-2 mb-6 text-slate-900 font-black uppercase tracking-wider text-sm border-b-2 border-blue-500 pb-2 w-fit">
                English Content
              </div>
              <div className="news-content">
                <ReactMarkdown 
                  rehypePlugins={[
                    rehypeRaw,
                    [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }]
                  ]}
                  remarkPlugins={[remarkBreaks]}
                >
                  {news.content_eng.replace(/\\n/g, '\n')}
                </ReactMarkdown>
              </div>
            </div>
          </article>

          <style>{`
            .news-content {
              color: #334155;
              line-height: 1.8;
            }
            .news-content p {
              margin-bottom: 1.5rem;
            }
            .news-content strong:not([style*="color"]) {
              font-weight: 800;
              color: #0f172a;
            }
            .news-content em:not([style*="color"]) {
              font-style: italic;
              color: #475569;
            }
            .news-content u {
              text-decoration: underline;
              text-underline-offset: 4px;
            }
            .news-content h1, .news-content h2, .news-content h3 {
              font-weight: 900;
              margin-top: 2.5rem;
              margin-bottom: 1.25rem;
              letter-spacing: -0.025em;
            }
            .news-content h1:not([style*="color"]) { color: #0f172a; }
            .news-content h2:not([style*="color"]) { color: #0f172a; }
            .news-content h3:not([style*="color"]) { color: #0f172a; }
            .news-content h1:not([style*="font-size"]) { font-size: 1.75rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; }
            .news-content h2:not([style*="font-size"]) { font-size: 1.5rem; }
            .news-content h3:not([style*="font-size"]) { font-size: 1.25rem; }
            .news-content ul, .news-content ol {
              margin-bottom: 1.5rem !important;
              padding-left: 2rem !important;
              list-style-position: outside !important;
            }
            .news-content ul { list-style-type: disc; }
            .news-content ol { list-style-type: decimal; }
            .news-content li { margin-bottom: 0.5rem; }
            .news-content blockquote {
              border-left: 4px solid #3b82f6;
              padding-left: 1.25rem;
              font-style: italic;
              color: #64748b;
              margin: 2rem 0;
              background-color: #f8fafc;
              padding-top: 1rem;
              padding-bottom: 1rem;
              border-radius: 0 0.5rem 0.5rem 0;
            }
            .news-content hr {
              border: 0;
              border-top: 1px solid #e2e8f0;
              margin: 2.5rem 0;
            }
            .news-content a {
              color: #059669;
              font-weight: 800;
              text-decoration: underline;
              text-decoration-color: rgba(16, 185, 129, 0.3);
              text-decoration-thickness: 3px;
              text-underline-offset: 3px;
              transition: all 0.2s;
            }
            .news-content a:hover {
              color: #047857;
              text-decoration-color: #059669;
              background-color: rgba(236, 253, 245, 0.5);
              border-radius: 2px;
            }
          `}</style>
        </div>
      </main>
    </>
  );
}
