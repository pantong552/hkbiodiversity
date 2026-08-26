'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/Header';
import JournalEditorModal from '@/components/journal/JournalEditorModal';
import CategoryAdminModal from '@/components/journal/CategoryAdminModal';
import RejectModal from '@/components/journal/RejectModal';
import NovelReaderControlPanel, {
  NovelReaderSettings,
  DEFAULT_NOVEL_SETTINGS,
  NOVEL_THEMES
} from '@/components/journal/NovelReaderControlPanel';
import { EcoArticle, EcoCategory } from '@/types/journal';
import { supabase } from '@/lib/supabase';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import rehypeExternalLinks from 'rehype-external-links';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Calendar,
  Clock,
  User as UserIcon,
  Tag,
  Search,
  Plus,
  Settings,
  ArrowLeft,
  Eye,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Share2,
  Sparkles,
  ChevronRight,
  Filter,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

const ITEMS_PER_PAGE = 8;

export default function JournalPage() {
  const { language, t } = useLanguage();
  const { profile, user } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [articles, setArticles] = useState<EcoArticle[]>([]);
  const [categories, setCategories] = useState<EcoCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // States
  const [selectedArticle, setSelectedArticle] = useState<EcoArticle | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Admin view filter: 'all' | 'submitted' | 'published' | 'rejected'
  const [adminStatusTab, setAdminStatusTab] = useState<'all' | 'published' | 'submitted' | 'rejected'>('published');

  // Modals
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [articleToEdit, setArticleToEdit] = useState<EcoArticle | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Reading progress
  const [scrollProgress, setScrollProgress] = useState(0);

  // 生態文創小說閱讀控制面板設定
  const [novelSettings, setNovelSettings] = useState<NovelReaderSettings>(DEFAULT_NOVEL_SETTINGS);
  const [isNovelControlPanelOpen, setIsNovelControlPanelOpen] = useState(false);

  // 判定目前開啟的文章是否屬於「生態文創」
  const isSelectedArticleNovel = Boolean(
    selectedArticle && (
      selectedArticle.eco_categories?.name_chi?.includes('文創') ||
      selectedArticle.eco_categories?.name_chi?.includes('小說') ||
      selectedArticle.eco_categories?.name_eng?.toLowerCase().includes('creative') ||
      selectedArticle.eco_categories?.name_eng?.toLowerCase().includes('novel') ||
      selectedArticle.eco_categories?.slug?.includes('creative') ||
      selectedArticle.eco_categories?.slug?.includes('novel')
    )
  );

  // 從 LocalStorage 載入小說偏好設定
  useEffect(() => {
    try {
      const saved = localStorage.getItem('hkbio_novel_reader_settings');
      if (saved) {
        setNovelSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleUpdateNovelSettings = (newSettings: Partial<NovelReaderSettings>) => {
    setNovelSettings(prev => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('hkbio_novel_reader_settings', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // 自動閱讀滾動效果
  useEffect(() => {
    let interval: any;
    if (isSelectedArticleNovel && novelSettings.autoScroll) {
      interval = setInterval(() => {
        window.scrollBy({ top: 2, behavior: 'smooth' });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isSelectedArticleNovel, novelSettings.autoScroll]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Categories
      const { data: catData } = await supabase
        .from('eco_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      setCategories((catData as EcoCategory[]) || []);

      // 2. Fetch Articles with Profile Author info & Category
      let query = supabase
        .from('eco_articles')
        .select(`
          *,
          eco_categories(*),
          profiles(id, username, avatar_url, role)
        `)
        .order('created_at', { ascending: false });

      const { data: artData, error } = await query;
      if (error) throw error;

      const fetchedArticles = (artData as EcoArticle[]) || [];
      setArticles(fetchedArticles);

      // 如果目前在閱讀某篇文章，即時同步更新畫面為最新版本內容
      setSelectedArticle((prevSelected) => {
        if (!prevSelected) return null;
        const updated = fetchedArticles.find((a) => a.id === prevSelected.id);
        return updated || prevSelected;
      });
    } catch (err) {
      console.error('Error fetching journal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Listen to reading scroll progress when viewing an article
  useEffect(() => {
    if (!selectedArticle) return;
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const currentProgress = (window.scrollY / totalHeight) * 100;
        setScrollProgress(Math.min(100, Math.max(0, currentProgress)));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [selectedArticle]);

  // Compute filtered articles
  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      // Admin vs Regular Status filter
      if (!isAdmin) {
        // Regular user: can see published articles, or their own submitted/rejected articles
        if (art.status !== 'published' && art.author_id !== user?.id) {
          return false;
        }
      } else {
        // Admin: filter by admin status tab
        if (adminStatusTab === 'submitted' && art.status !== 'submitted') return false;
        if (adminStatusTab === 'published' && art.status !== 'published') return false;
        if (adminStatusTab === 'rejected' && art.status !== 'rejected') return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && art.category_id !== selectedCategory) {
        return false;
      }

      // Tag filter
      if (selectedTag && (!art.tags || !art.tags.includes(selectedTag))) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (art.title_chi && art.title_chi.toLowerCase().includes(q)) || (art.title_eng && art.title_eng.toLowerCase().includes(q));
        const summaryMatch = (art.summary_chi && art.summary_chi.toLowerCase().includes(q)) || (art.summary_eng && art.summary_eng.toLowerCase().includes(q));
        const contentMatch = (art.content_chi && art.content_chi.toLowerCase().includes(q)) || (art.content_eng && art.content_eng.toLowerCase().includes(q));
        const tagMatch = art.tags && art.tags.some(t => t.toLowerCase().includes(q));
        if (!titleMatch && !summaryMatch && !contentMatch && !tagMatch) return false;
      }

      return true;
    });
  }, [articles, selectedCategory, selectedTag, searchQuery, isAdmin, adminStatusTab, user]);

  const totalPages = Math.ceil(filteredArticles.length / ITEMS_PER_PAGE);
  const paginatedArticles = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredArticles.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredArticles, currentPage]);

  // Helper methods to get language-aware text based on article_language field
  const getArticleTitle = (art: EcoArticle) => {
    if (art.article_language === 'zh') return art.title_chi || art.title_eng;
    if (art.article_language === 'en') return art.title_eng || art.title_chi;
    return language === 'zh' ? (art.title_chi || art.title_eng) : (art.title_eng || art.title_chi);
  };

  const getArticleSummary = (art: EcoArticle) => {
    if (art.article_language === 'zh') return art.summary_chi || art.summary_eng || '';
    if (art.article_language === 'en') return art.summary_eng || art.summary_chi || '';
    return language === 'zh' ? (art.summary_chi || art.summary_eng || '') : (art.summary_eng || art.summary_chi || '');
  };

  const getArticleContent = (art: EcoArticle) => {
    let raw = '';
    if (art.article_language === 'zh') raw = art.content_chi || art.content_eng;
    else if (art.article_language === 'en') raw = art.content_eng || art.content_chi;
    else raw = language === 'zh' ? (art.content_chi || art.content_eng) : (art.content_eng || art.content_chi);
    
    let cleaned = (raw || '').replace(/\\n/g, '\n');
    
    // 若為小說模式，過濾掉 Quill 產生的 inline color / background / font-size 樣式，防止深色背景下字體變黑
    if (isSelectedArticleNovel) {
      cleaned = cleaned
        .replace(/style="[^"]*color:[^"]*"/gi, '')
        .replace(/style="[^"]*background[^"]*"/gi, '')
        .replace(/<font[^>]*>/gi, '')
        .replace(/<\/font>/gi, '');
    }
    return cleaned;
  };

  // Estimated reading time calculation (approx 250 words per min)
  const getReadingTime = (content: string) => {
    const words = content.length;
    const minutes = Math.ceil(words / 400);
    return minutes < 1 ? 1 : minutes;
  };

  const handleOpenArticle = async (art: EcoArticle) => {
    setSelectedArticle(art);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Increment view count
    try {
      await supabase
        .from('eco_articles')
        .update({ views: (art.views || 0) + 1 })
        .eq('id', art.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleApproveArticle = async (art: EcoArticle, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const { error } = await supabase
        .from('eco_articles')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
        })
        .eq('id', art.id);

      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to approve article');
    }
  };

  // Reject Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectArticleTarget, setRejectArticleTarget] = useState<EcoArticle | null>(null);

  const handleOpenRejectModal = (art: EcoArticle, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRejectArticleTarget(art);
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = async (reason: string) => {
    if (!rejectArticleTarget) return;
    try {
      const now = new Date().toISOString();
      const newLog = {
        reason,
        created_at: now,
        admin_name: user?.user_metadata?.full_name || user?.email || 'Admin',
      };

      const history = rejectArticleTarget.rejection_history || [];

      const { error } = await supabase
        .from('eco_articles')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          rejection_history: [newLog, ...history],
        })
        .eq('id', rejectArticleTarget.id);

      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to reject article');
    }
  };

  const handleDeleteArticle = async (art: EcoArticle, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(language === 'zh' ? '確定要刪除這篇文章嗎？此操作無法撤銷。' : 'Are you sure to delete this article? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase.from('eco_articles').delete().eq('id', art.id);
      if (error) throw error;

      if (selectedArticle?.id === art.id) {
        setSelectedArticle(null);
      }
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete article');
    }
  };

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    articles.forEach(art => {
      if (art.tags) art.tags.forEach(t => tagSet.add(t));
    });
    return Array.from(tagSet);
  }, [articles]);

  const pendingCount = useMemo(() => {
    return articles.filter(a => a.status === 'submitted').length;
  }, [articles]);

  const rejectedCount = useMemo(() => {
    return articles.filter(a => a.status === 'rejected').length;
  }, [articles]);

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-slate-900 font-sans selection:bg-emerald-200">
      <Header />

      {/* Article Reading Progress Bar */}
      {selectedArticle && (
        <div
          className="fixed top-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400 z-[100] transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      )}

      {/* Main Container - Padded top to avoid Header overlap */}
      <main className="pt-32 sm:pt-36 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {selectedArticle ? (
          /* ======================================================== */
          /* LONG-FORM ARTICLE READING VIEW - Full Width (max-w-7xl)    */
          /* ======================================================== */
          <motion.article
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-7xl mx-auto"
          >
            {/* Top Bar: Back Button & Author/Admin Edit/Delete Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <button
                onClick={() => setSelectedArticle(null)}
                className="group inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:text-emerald-700 hover:border-emerald-300 shadow-sm transition-all"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                <span className="text-sm font-bold">{t('journal.back_to_list')}</span>
              </button>

              <div className="flex items-center gap-2">
                {(user?.id === selectedArticle.author_id || isAdmin) && (
                  <>
                    <button
                      onClick={() => {
                        setArticleToEdit(selectedArticle);
                        setIsEditorOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      {user?.id === selectedArticle.author_id
                        ? (selectedArticle.status === 'submitted'
                          ? (language === 'zh' ? '編輯並提交新版本' : 'Edit & Resubmit New Version')
                          : (selectedArticle.status === 'rejected'
                            ? (language === 'zh' ? '修改退回內容並重新提交' : 'Modify & Resubmit')
                            : (language === 'zh' ? '編輯文章' : 'Edit Article')))
                        : (language === 'zh' ? '編輯文章內容' : 'Edit Article Content')}
                    </button>

                    <button
                      onClick={(e) => handleDeleteArticle(selectedArticle, e)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-colors cursor-pointer"
                      title="Delete Article"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {language === 'zh' ? '刪除文章' : 'Delete'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Rejection Reason Warning Alert Banner (Only shown to Author when Rejected) */}
            {user?.id === selectedArticle.author_id && selectedArticle.status === 'rejected' && selectedArticle.rejection_reason && (
              <div className="p-4 mb-6 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>{language === 'zh' ? '退回原因反饋 (Rejection Reason)' : 'Rejection Reason'}</span>
                </div>
                <p className="text-sm font-medium text-amber-900 pl-6">
                  {selectedArticle.rejection_reason}
                </p>
                <p className="text-xs text-amber-700 pl-6 pt-1">
                  {language === 'zh'
                    ? '請點擊上方「修改退回內容並重新提交」按鈕進行修訂再重新送審。'
                    : 'Please click "Modify & Resubmit" button above to revise.'}
                </p>
              </div>
            )}

            {/* Category & Status Badge */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {selectedArticle.eco_categories && (
                <span className="px-3.5 py-1 rounded-full bg-emerald-100/80 text-emerald-800 font-semibold text-xs border border-emerald-200">
                  {language === 'zh'
                    ? selectedArticle.eco_categories.name_chi
                    : selectedArticle.eco_categories.name_eng}
                </span>
              )}
              {selectedArticle.status !== 'published' && (
                <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">
                  {t(`journal.status_${selectedArticle.status}`)}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black font-serif text-slate-900 tracking-tight leading-tight mb-6">
              {getArticleTitle(selectedArticle)}
            </h1>

            {/* Article Meta Bar (Author, Date, Reading Time, Views) */}
            <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-y border-slate-200 mb-8 text-xs sm:text-sm text-slate-600">
              <div className="flex items-center gap-3">
                {selectedArticle.profiles?.avatar_url ? (
                  <img
                    src={selectedArticle.profiles.avatar_url}
                    alt="Author"
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/20"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold">
                    <UserIcon className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <div className="font-bold text-slate-900">
                    {selectedArticle.profiles?.username || 'Hong Kong Nature Observer'}
                  </div>
                  <div className="text-slate-500 text-xs flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span>
                      {t('journal.published_at')}{' '}
                      {new Date(selectedArticle.published_at || selectedArticle.created_at).toLocaleString(language === 'zh' ? 'zh-HK' : 'en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      })}
                    </span>
                    {selectedArticle.updated_at && (new Date(selectedArticle.updated_at).getTime() - new Date(selectedArticle.published_at || selectedArticle.created_at).getTime() > 60000) && (
                      <span className="text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1">
                        <span>{t('journal.updated_at')}:</span>
                        <span>
                          {new Date(selectedArticle.updated_at).toLocaleString(language === 'zh' ? 'zh-HK' : 'en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })}
                        </span>
                        <span>
                          ({language === 'zh' ? '編輯者' : 'Editor'}: {selectedArticle.last_edited_by_name || selectedArticle.profiles?.username || 'Author'})
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-slate-500 text-xs">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  {getReadingTime(getArticleContent(selectedArticle))}{' '}
                  {t('journal.reading_time')}
                </span>
                <span className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-slate-400" />
                  {selectedArticle.views || 1} {t('journal.views')}
                </span>
              </div>
            </div>

            {/* Cover Image */}
            {selectedArticle.cover_image && (
              <div className="relative rounded-3xl overflow-hidden mb-10 shadow-xl border border-slate-200 max-h-[450px]">
                <img
                  src={selectedArticle.cover_image}
                  alt="Article Cover"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Article Content Body (Editorial Rich Typography with Novel Mode Support) */}
            <div 
              id="novel-page-reader-content"
              key={`novel-reader-${selectedArticle.id}-${novelSettings.theme}-${novelSettings.lineHeight}-${novelSettings.fontSize}`}
              className={`rounded-3xl p-4 sm:p-8 transition-all duration-300 ${
                isSelectedArticleNovel
                  ? 'border border-current/10 shadow-sm font-serif [&_p]:indent-8'
                  : 'text-slate-800'
              } text-base sm:text-lg leading-relaxed mb-12`}
              style={
                isSelectedArticleNovel
                  ? {
                      backgroundColor: NOVEL_THEMES[novelSettings.theme]?.bg || '#F5ECD7',
                      color: NOVEL_THEMES[novelSettings.theme]?.color || '#3E2723',
                      fontSize: `${novelSettings.fontSize}px`,
                      lineHeight: novelSettings.lineHeight === 'compact' ? 1.5 : (novelSettings.lineHeight === 'spacious' ? 2.7 : 2.0),
                    }
                  : undefined
              }
            >
              {isSelectedArticleNovel && (
                <style jsx global>{`
                  #novel-page-reader-content,
                  #novel-page-reader-content * {
                    color: ${NOVEL_THEMES[novelSettings.theme]?.color || '#3E2723'} !important;
                    line-height: ${novelSettings.lineHeight === 'compact' ? 1.5 : (novelSettings.lineHeight === 'spacious' ? 2.7 : 2.0)} !important;
                  }
                  #novel-page-reader-content p,
                  #novel-page-reader-content div {
                    font-size: ${novelSettings.fontSize}px !important;
                    line-height: ${novelSettings.lineHeight === 'compact' ? 1.5 : (novelSettings.lineHeight === 'spacious' ? 2.7 : 2.0)} !important;
                    margin-bottom: ${novelSettings.lineHeight === 'compact' ? '0.75rem' : (novelSettings.lineHeight === 'spacious' ? '1.85rem' : '1.25rem')} !important;
                    text-indent: 2em !important;
                    color: ${NOVEL_THEMES[novelSettings.theme]?.color || '#3E2723'} !important;
                  }
                `}</style>
              )}
              <ReactMarkdown
                rehypePlugins={[rehypeRaw, [rehypeExternalLinks, { target: '_blank' }]]}
                remarkPlugins={[remarkBreaks]}
                components={{
                  h1: ({ children }) => (
                    <h1 
                      style={isSelectedArticleNovel ? { color: NOVEL_THEMES[novelSettings.theme]?.color, lineHeight: novelSettings.lineHeight === 'compact' ? 1.4 : (novelSettings.lineHeight === 'spacious' ? 2.2 : 1.7) } : undefined}
                      className={`text-2xl sm:text-3xl font-bold font-serif ${isSelectedArticleNovel ? 'border-current/20' : 'text-slate-900 border-slate-200'} mt-8 mb-4 border-b pb-3`}
                    >
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 
                      style={isSelectedArticleNovel ? { color: NOVEL_THEMES[novelSettings.theme]?.color, lineHeight: novelSettings.lineHeight === 'compact' ? 1.4 : (novelSettings.lineHeight === 'spacious' ? 2.2 : 1.7) } : undefined}
                      className={`text-xl sm:text-2xl font-bold font-serif ${isSelectedArticleNovel ? '' : 'text-slate-900'} mt-6 mb-3`}
                    >
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 
                      style={isSelectedArticleNovel ? { color: NOVEL_THEMES[novelSettings.theme]?.color, lineHeight: novelSettings.lineHeight === 'compact' ? 1.4 : (novelSettings.lineHeight === 'spacious' ? 2.2 : 1.7) } : undefined}
                      className={`text-lg sm:text-xl font-bold font-serif ${isSelectedArticleNovel ? '' : 'text-slate-800'} mt-5 mb-2`}
                    >
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p 
                      style={
                        isSelectedArticleNovel
                          ? {
                              fontSize: `${novelSettings.fontSize}px`,
                              lineHeight: novelSettings.lineHeight === 'compact' ? 1.5 : (novelSettings.lineHeight === 'spacious' ? 2.7 : 2.0),
                              color: NOVEL_THEMES[novelSettings.theme]?.color,
                              marginBottom: novelSettings.lineHeight === 'compact' ? '0.75rem' : (novelSettings.lineHeight === 'spacious' ? '1.85rem' : '1.25rem'),
                              textIndent: '2em',
                            }
                          : undefined
                      }
                      className={`my-4 ${isSelectedArticleNovel ? '' : 'text-slate-800 leading-relaxed'}`}
                    >
                      {children}
                    </p>
                  ),
                  span: ({ children }) => (
                    <span style={isSelectedArticleNovel ? { color: NOVEL_THEMES[novelSettings.theme]?.color } : undefined}>
                      {children}
                    </span>
                  ),
                  strong: ({ children }) => (
                    <strong style={isSelectedArticleNovel ? { color: NOVEL_THEMES[novelSettings.theme]?.color, fontWeight: 'bold' } : undefined}>
                      {children}
                    </strong>
                  ),
                  em: ({ children }) => (
                    <em style={isSelectedArticleNovel ? { color: NOVEL_THEMES[novelSettings.theme]?.color } : undefined}>
                      {children}
                    </em>
                  ),
                  ul: ({ children }) => (
                    <ul 
                      style={isSelectedArticleNovel ? { color: NOVEL_THEMES[novelSettings.theme]?.color } : undefined}
                      className={`list-disc list-outside ml-6 my-4 space-y-2 ${isSelectedArticleNovel ? '' : 'text-slate-800'}`}
                    >
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol 
                      style={isSelectedArticleNovel ? { color: NOVEL_THEMES[novelSettings.theme]?.color } : undefined}
                      className={`list-decimal list-outside ml-6 my-4 space-y-2 ${isSelectedArticleNovel ? '' : 'text-slate-800'}`}
                    >
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li 
                      style={isSelectedArticleNovel ? { color: NOVEL_THEMES[novelSettings.theme]?.color, lineHeight: novelSettings.lineHeight === 'compact' ? 1.5 : (novelSettings.lineHeight === 'spacious' ? 2.7 : 2.0) } : undefined}
                      className="pl-1 leading-relaxed"
                    >
                      {children}
                    </li>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote 
                      style={isSelectedArticleNovel ? { color: NOVEL_THEMES[novelSettings.theme]?.color } : undefined}
                      className={`border-l-4 ${isSelectedArticleNovel ? 'border-amber-600 bg-black/10' : 'border-emerald-600 bg-emerald-50/60 text-slate-700'} pl-5 py-3 my-6 rounded-r-2xl italic font-serif`}
                    >
                      {children}
                    </blockquote>
                  ),
                  code: ({ children }) => (
                    <code 
                      style={isSelectedArticleNovel ? { color: NOVEL_THEMES[novelSettings.theme]?.color } : undefined}
                      className={`px-2 py-1 ${isSelectedArticleNovel ? 'bg-black/20 border border-current/20' : 'bg-slate-100 border border-slate-200 text-emerald-800'} rounded-lg font-mono text-xs`}
                    >
                      {children}
                    </code>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${isSelectedArticleNovel ? 'text-amber-500' : 'text-emerald-700'} font-semibold underline underline-offset-4 hover:opacity-80 transition-colors`}
                    >
                      {children}
                    </a>
                  ),
                  img: ({ src, alt }) => (
                    <span className="block my-8">
                      <img
                        src={src}
                        alt={alt || 'Article illustration'}
                        className="w-full rounded-3xl shadow-lg border border-slate-200 object-cover max-h-[500px]"
                      />
                      {alt && (
                        <span className="block text-center text-xs text-slate-500 mt-2 font-medium">
                          {alt}
                        </span>
                      )}
                    </span>
                  ),
                }}
              >
                {getArticleContent(selectedArticle)}
              </ReactMarkdown>
            </div>

            {/* 生態文創專屬：閱讀控制面板 (Control Panel) */}
            {isSelectedArticleNovel && (
              <NovelReaderControlPanel
                isOpen={isNovelControlPanelOpen}
                onToggle={() => setIsNovelControlPanelOpen(!isNovelControlPanelOpen)}
                settings={novelSettings}
                onUpdateSettings={handleUpdateNovelSettings}
              />
            )}

            {/* Tags Footer */}
            {selectedArticle.tags && selectedArticle.tags.length > 0 && (
              <div className="pt-6 border-t border-slate-200 flex flex-wrap items-center gap-2 mb-12">
                <Tag className="w-4 h-4 text-emerald-600 mr-1" />
                {selectedArticle.tags.map((t) => (
                  <span
                    key={t}
                    onClick={() => {
                      setSelectedTag(t);
                      setSelectedArticle(null);
                    }}
                    className="px-3 py-1 rounded-full bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs font-medium cursor-pointer transition-colors"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </motion.article>
        ) : (
          /* ======================================================== */
          /* ECO-JOURNAL LIST & DIRECTORY VIEW                          */
          /* ======================================================== */
          <div>
            {/* Top Editorial Banner */}
            <div className="relative rounded-[2.5rem] bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white p-8 sm:p-12 mb-10 overflow-hidden shadow-2xl border border-emerald-900/40">
              <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="relative z-10 max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-4">
                  <Sparkles className="w-3.5 h-3.5" />
                  {t('journal.badge')}
                </div>
                <h1 className="text-4xl sm:text-5xl font-black font-serif tracking-tight text-white mb-4">
                  {t('journal.title')}
                </h1>
                <p className="text-slate-300 text-base sm:text-lg font-light leading-relaxed mb-8">
                  {t('journal.subtitle')}
                </p>

                {/* Actions: Write Article Button & Admin Panel */}
                <div className="flex flex-wrap items-center gap-4">
                  {user ? (
                    <button
                      onClick={() => {
                        setArticleToEdit(null);
                        setIsEditorOpen(true);
                      }}
                      className="px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-sm shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      {t('journal.submit_article')}
                    </button>
                  ) : (
                    <div className="text-xs text-emerald-200 bg-white/10 px-4 py-3 rounded-2xl border border-white/10 backdrop-blur-sm">
                      {language === 'zh' ? '請先登入帳號以發表/投稿生態誌長文' : 'Please log in to submit or publish articles.'}
                    </div>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => setIsCategoryModalOpen(true)}
                      className="px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/15 backdrop-blur-sm flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-emerald-300" />
                      {t('journal.manage_categories')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Admin Management Toolbar Bar (If Admin) */}
            {isAdmin && (
              <div className="p-4 mb-8 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-2xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    Admin Mode
                  </div>
                  <span className="text-sm font-semibold text-slate-800">
                    {language === 'zh'
                      ? `待審核 (${pendingCount}) · 已退回 (${rejectedCount})`
                      : `Pending (${pendingCount}) · Rejected (${rejectedCount})`}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setAdminStatusTab('all');
                      setCurrentPage(1);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${adminStatusTab === 'all' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
                  >
                    {language === 'zh' ? '全部狀態' : 'All Statuses'}
                  </button>
                  <button
                    onClick={() => {
                      setAdminStatusTab('published');
                      setCurrentPage(1);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${adminStatusTab === 'published' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
                  >
                    {t('journal.status_published')}
                  </button>
                  <button
                    onClick={() => {
                      setAdminStatusTab('submitted');
                      setCurrentPage(1);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all relative ${adminStatusTab === 'submitted' ? 'bg-amber-600 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
                  >
                    {t('journal.status_submitted')}
                    {pendingCount > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px]">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setAdminStatusTab('rejected');
                      setCurrentPage(1);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all relative ${adminStatusTab === 'rejected' ? 'bg-rose-600 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
                  >
                    {t('journal.status_rejected')}
                    {rejectedCount > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px]">
                        {rejectedCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Controls: Search Bar & Category Filter Tabs */}
            <div className="space-y-6 mb-8">
              {/* Category Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setCurrentPage(1);
                  }}
                  className={`px-5 py-2.5 rounded-2xl text-xs font-bold tracking-wide whitespace-nowrap transition-all cursor-pointer ${selectedCategory === 'all' ? 'bg-emerald-800 text-white shadow-md shadow-emerald-900/10' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'}`}
                >
                  {t('journal.all_categories')}
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setCurrentPage(1);
                    }}
                    className={`px-5 py-2.5 rounded-2xl text-xs font-bold tracking-wide whitespace-nowrap transition-all cursor-pointer ${selectedCategory === cat.id ? 'bg-emerald-800 text-white shadow-md shadow-emerald-900/10' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'}`}
                  >
                    {language === 'zh' ? cat.name_chi : cat.name_eng}
                  </button>
                ))}
              </div>

              {/* Search & Tag Clear Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    suppressHydrationWarning
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder={t('journal.search_placeholder')}
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border border-slate-200/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-slate-800 text-sm shadow-sm"
                  />
                </div>

                {selectedTag && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                    <span>Tag: #{selectedTag}</span>
                    <button
                      onClick={() => setSelectedTag(null)}
                      className="hover:text-rose-600 font-bold ml-1"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Articles Grid / Editorial Cards */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-12">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="h-80 rounded-3xl bg-slate-200/60 animate-pulse" />
                ))}
              </div>
            ) : paginatedArticles.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
                <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-1">{t('journal.no_articles')}</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">{t('journal.no_articles_desc')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                {paginatedArticles.map((art) => (
                  <motion.div
                    key={art.id}
                    whileHover={{ y: -4 }}
                    onClick={() => handleOpenArticle(art)}
                    className="group flex flex-col bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all overflow-hidden cursor-pointer"
                  >
                    {/* Card Cover Image */}
                    {art.cover_image ? (
                      <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                        <img
                          src={art.cover_image}
                          alt="Article Cover"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        {art.eco_categories && (
                          <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-emerald-900 font-bold text-[11px] shadow-sm">
                            {language === 'zh'
                              ? art.eco_categories.name_chi
                              : art.eco_categories.name_eng}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="h-28 w-full bg-gradient-to-br from-emerald-900 to-teal-950 p-6 flex items-end">
                        {art.eco_categories && (
                          <span className="px-3 py-1 rounded-full bg-white/20 text-emerald-200 font-bold text-[11px]">
                            {language === 'zh'
                              ? art.eco_categories.name_chi
                              : art.eco_categories.name_eng}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Card Body */}
                    <div className="p-6 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Status Tag for Admin or Author */}
                        {art.status !== 'published' && (
                          <div className="mb-2">
                            <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                              {t(`journal.status_${art.status}`)}
                            </span>
                          </div>
                        )}

                        <h3 className="text-xl font-bold font-serif text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-2 mb-2 leading-snug">
                          {getArticleTitle(art)}
                        </h3>

                        <p className="text-xs text-slate-600 line-clamp-3 font-normal leading-relaxed mb-4">
                          {getArticleSummary(art) || getArticleContent(art).substring(0, 120)}
                        </p>
                      </div>

                      {/* Card Footer Info */}
                      <div>
                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-700">
                            {art.profiles?.username || 'Nature Observer'}
                          </span>
                          <span>
                            {new Date(art.published_at || art.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Author & Admin Action Buttons on Card */}
                        {(user?.id === art.author_id || isAdmin) && (
                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setArticleToEdit(art);
                                  setIsEditorOpen(true);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-bold text-xs flex items-center gap-1 transition-colors"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                {user?.id === art.author_id
                                  ? (art.status === 'submitted'
                                    ? (language === 'zh' ? '編輯並重提交' : 'Edit & Resubmit')
                                    : (art.status === 'rejected'
                                      ? (language === 'zh' ? '修改再提交' : 'Modify & Resubmit')
                                      : (language === 'zh' ? '編輯文章' : 'Edit Article')))
                                  : (language === 'zh' ? '編輯內容' : 'Edit Content')}
                              </button>

                              <button
                                onClick={(e) => handleDeleteArticle(art, e)}
                                className="p-1.5 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                                title="Delete Article"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {isAdmin && art.status === 'submitted' && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => handleOpenRejectModal(art, e)}
                                  className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1 transition-colors"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  {t('journal.reject')}
                                </button>
                                <button
                                  onClick={(e) => handleApproveArticle(art, e)}
                                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-600/20 transition-all"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  {t('journal.approve')}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 pt-6">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setCurrentPage(p);
                      window.scrollTo({ top: 400, behavior: 'smooth' });
                    }}
                    className={`w-10 h-10 rounded-2xl text-xs font-bold transition-all cursor-pointer ${currentPage === p ? 'bg-emerald-800 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Editor Modal */}
      <JournalEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        categories={categories}
        articleToEdit={articleToEdit}
        onSaved={fetchData}
        onRejectTrigger={(art) => handleOpenRejectModal(art)}
        onApproveTrigger={(art) => handleApproveArticle(art, undefined as any)}
      />

      {/* Admin Category Modal */}
      <CategoryAdminModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        onRefresh={fetchData}
      />

      {/* Admin Reject Modal */}
      <RejectModal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        onConfirmReject={handleConfirmReject}
        articleTitle={
          rejectArticleTarget
            ? getArticleTitle(rejectArticleTarget)
            : ''
        }
      />
    </div>
  );
}
