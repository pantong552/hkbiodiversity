'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Image as ImageIcon, Tag, Send, CheckCircle2, AlertCircle, FileText,
  Languages, Globe, Undo, Redo, Bold, Italic, Heading1, Heading2, List,
  ListOrdered, Type, Palette, Link as LinkIcon, Quote, Code, Folder, ChevronDown, Check,
  BookOpen, Sliders, Smartphone, Eye, EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { EcoCategory, EcoArticle, ArticleLanguage } from '@/types/journal';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { HexColorPicker } from 'react-colorful';
import NovelReaderControlPanel, { 
  NovelReaderSettings, 
  DEFAULT_NOVEL_SETTINGS, 
  NOVEL_THEMES 
} from '@/components/journal/NovelReaderControlPanel';

const ReactQuill = dynamic(
  async () => {
    const { default: RQ, Quill } = await import('react-quill-new');
    
    // Register Style Attributors so Quill applies style="color: ..." and style="font-size: ..." inline
    const SizeStyle = Quill.import('attributors/style/size') as any;
    const ColorStyle = Quill.import('attributors/style/color') as any;
    const fontSizesPx = Array.from({ length: 120 }, (_, i) => `${i + 1}px`).concat(['0.875rem', '1rem', '1.25rem', '1.5rem', '2rem']);
    SizeStyle.whitelist = fontSizesPx;
    
    Quill.register(SizeStyle, true);
    Quill.register(ColorStyle, true);

    // eslint-disable-next-line react/display-name
    return ({ forwardedRef, ...props }: any) => <RQ ref={forwardedRef} {...props} />;
  },
  { 
    ssr: false,
    loading: () => <div className="w-full h-48 bg-slate-50 animate-pulse rounded-2xl" />
  }
);

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

turndownService.keep(['span' as any]);

// Preserve <span> tags with style attribute (for text colors & font sizes) when converting HTML to Markdown
turndownService.addRule('keepInlineSpans', {
  filter: (node: HTMLElement) => {
    const tag = node.nodeName ? node.nodeName.toLowerCase() : '';
    return (tag === 'span' || tag === 'font') && (node.hasAttribute('style') || node.hasAttribute('class') || node.hasAttribute('color'));
  },
  replacement: (content, node: any) => {
    const style = node.getAttribute('style');
    const className = node.getAttribute('class');
    const color = node.getAttribute('color');
    const attrStyle = style ? ` style="${style}"` : '';
    const attrClass = className ? ` class="${className}"` : '';
    const attrColor = color ? ` color="${color}"` : '';
    return `<span${attrStyle}${attrClass}${attrColor}>${content}</span>`;
  }
});

interface JournalEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: EcoCategory[];
  articleToEdit?: EcoArticle | null;
  onSaved: () => void;
  onRejectTrigger?: (article: EcoArticle) => void;
  onApproveTrigger?: (article: EcoArticle) => void;
}

export default function JournalEditorModal({
  isOpen,
  onClose,
  categories,
  articleToEdit,
  onSaved,
  onRejectTrigger,
  onApproveTrigger,
}: JournalEditorModalProps) {
  const { language, t } = useLanguage();
  const { profile, user } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // Article Language Mode: 'bilingual' | 'zh' | 'en'
  const [articleLanguage, setArticleLanguage] = useState<ArticleLanguage>('bilingual');
  const [activeTab, setActiveTab] = useState<'zh' | 'en'>('zh');

  const [titleChi, setTitleChi] = useState('');
  const [titleEng, setTitleEng] = useState('');
  const [chapterNumber, setChapterNumber] = useState<string>('');
  const [chapterTitleChi, setChapterTitleChi] = useState('');
  const [chapterTitleEng, setChapterTitleEng] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [summaryChi, setSummaryChi] = useState('');
  const [summaryEng, setSummaryEng] = useState('');
  const [contentChi, setContentChi] = useState(''); // HTML in Quill, converts to MD
  const [contentEng, setContentEng] = useState(''); // HTML in Quill, converts to MD
  const [coverImage, setCoverImage] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<'submitted' | 'published' | 'rejected'>('submitted');

  const [openDropdown, setOpenDropdown] = useState<'size' | 'color' | null>(null);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [pickerColor, setPickerColor] = useState('#10B981');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const quillRefChi = useRef<any>(null);
  const quillRefEng = useRef<any>(null);

  const [customFontSize, setCustomFontSize] = useState('16');
  
  // 小說沉浸式閱讀模式設定與控制面板狀態
  const [novelSettings, setNovelSettings] = useState<NovelReaderSettings>(DEFAULT_NOVEL_SETTINGS);
  const [isNovelControlPanelOpen, setIsNovelControlPanelOpen] = useState(false);
  const [isNovelMobilePreview, setIsNovelMobilePreview] = useState(false);

  // 判斷當前選擇的分類是否屬於「生態文創」
  const currentCategory = categories.find(c => c.id === categoryId);
  const isNovelCategory = Boolean(
    currentCategory && (
      currentCategory.name_chi?.includes('文創') ||
      currentCategory.name_chi?.includes('小說') ||
      currentCategory.name_eng?.toLowerCase().includes('creative') ||
      currentCategory.name_eng?.toLowerCase().includes('novel') ||
      currentCategory.slug?.includes('creative') ||
      currentCategory.slug?.includes('novel')
    )
  );

  // 從 LocalStorage 載入讀者自訂小說設定
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
    if (novelSettings.autoScroll) {
      interval = setInterval(() => {
        const previewContainer = document.getElementById('novel-mobile-reader-content');
        if (previewContainer) {
          previewContainer.scrollTop += 2;
        } else {
          window.scrollBy({ top: 2, behavior: 'smooth' });
        }
      }, 50);
    }
    return () => clearInterval(interval);
  }, [novelSettings.autoScroll]);

  // Close dropdown when clicking outside (keep open when selecting/highlighting text in Quill editor)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInsideDropdown = target.closest('.toolbar-dropdown-container');
      const isInsideEditor = target.closest('.quill-editor-wrapper') || target.closest('.ql-editor');
      if (!isInsideDropdown && !isInsideEditor) {
        setOpenDropdown(null);
        setIsCategoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown, isCategoryOpen]);

  // Undo & Redo History
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    if (articleToEdit) {
      const lang = articleToEdit.article_language || 'bilingual';
      setArticleLanguage(lang);
      setActiveTab(lang === 'en' ? 'en' : 'zh');
      setTitleChi(articleToEdit.title_chi || '');
      setTitleEng(articleToEdit.title_eng || '');
      setChapterNumber(articleToEdit.chapter_number !== undefined && articleToEdit.chapter_number !== null ? String(articleToEdit.chapter_number) : '');
      setChapterTitleChi(articleToEdit.chapter_title_chi || '');
      setChapterTitleEng(articleToEdit.chapter_title_eng || '');
      setCategoryId(articleToEdit.category_id || (categories[0]?.id || ''));
      setSummaryChi(articleToEdit.summary_chi || '');
      setSummaryEng(articleToEdit.summary_eng || '');
      
      // Load HTML/Markdown into Quill Editor seamlessly with \n escape cleanup
      const parseContent = (text?: string | null): string => {
        if (!text) return '';
        const cleaned = text.replace(/\\n/g, '\n');
        return cleaned.startsWith('<') ? cleaned : (marked.parse(cleaned) as string);
      };

      setContentChi(parseContent(articleToEdit.content_chi));
      setContentEng(parseContent(articleToEdit.content_eng));
      
      setCoverImage(articleToEdit.cover_image || '');
      setTags(articleToEdit.tags || []);
      setStatus(articleToEdit.status as any || 'submitted');
    } else {
      setArticleLanguage('bilingual');
      setActiveTab('zh');
      setTitleChi('');
      setTitleEng('');
      setChapterNumber('');
      setChapterTitleChi('');
      setChapterTitleEng('');
      setCategoryId(categories[0]?.id || '');
      setSummaryChi('');
      setSummaryEng('');
      setContentChi('');
      setContentEng('');
      setCoverImage('');
      setTags([]);
      setStatus('submitted');
    }
    setErrorMsg(null);
  }, [articleToEdit, categories, isOpen]);

  if (!isOpen) return null;

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // Rich Text Editor Toolbar Helpers
  const insertFormat = (type: string) => {
    const quill = activeTab === 'zh' ? quillRefChi.current?.getEditor() : quillRefEng.current?.getEditor();
    if (!quill) return;

    const [action, value] = type.split(':');
    const range = quill.getSelection();
    
    if (range) {
      switch (action) {
        case 'bold': quill.format('bold', !quill.getFormat(range).bold); break;
        case 'italic': quill.format('italic', !quill.getFormat(range).italic); break;
        case 'h1': quill.format('header', quill.getFormat(range).header === 1 ? false : 1); break;
        case 'h2': quill.format('header', quill.getFormat(range).header === 2 ? false : 2); break;
        case 'list': quill.format('list', quill.getFormat(range).list === 'bullet' ? false : 'bullet'); break;
        case 'ol': quill.format('list', quill.getFormat(range).list === 'ordered' ? false : 'ordered'); break;
        case 'quote': quill.format('blockquote', !quill.getFormat(range).blockquote); break;
        case 'code': quill.format('code-block', !quill.getFormat(range)['code-block']); break;
        case 'link': {
          const url = prompt('Enter URL:', 'https://');
          if (url) quill.format('link', url);
          break;
        }
        case 'color': quill.format('color', value || '#10B981'); break;
        case 'size': quill.format('size', value); break;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) {
      setErrorMsg(language === 'zh' ? '請選擇文章分類' : 'Please select a category.');
      return;
    }

    // Validate fields according to articleLanguage
    if (articleLanguage === 'bilingual' || articleLanguage === 'zh') {
      if (!titleChi.trim()) {
        setErrorMsg(language === 'zh' ? '請填寫中文標題' : 'Please enter Chinese title.');
        return;
      }
      if (!contentChi.trim()) {
        setErrorMsg(language === 'zh' ? '請填寫中文內文' : 'Please enter Chinese content.');
        return;
      }
    }

    if (articleLanguage === 'bilingual' || articleLanguage === 'en') {
      if (!titleEng.trim()) {
        setErrorMsg(language === 'zh' ? '請填寫英文標題' : 'Please enter English title.');
        return;
      }
      if (!contentEng.trim()) {
        setErrorMsg(language === 'zh' ? '請填寫英文內文' : 'Please enter English content.');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const now = new Date().toISOString();

      const payload: any = {
        category_id: categoryId,
        article_language: articleLanguage,
        title_chi: articleLanguage === 'en' ? '' : titleChi.trim(),
        title_eng: articleLanguage === 'zh' ? '' : titleEng.trim(),
        chapter_number: isNovelCategory && chapterNumber.trim() ? parseInt(chapterNumber.trim(), 10) : null,
        chapter_title_chi: isNovelCategory && articleLanguage !== 'en' ? (chapterTitleChi.trim() || null) : null,
        chapter_title_eng: isNovelCategory && articleLanguage !== 'zh' ? (chapterTitleEng.trim() || null) : null,
        summary_chi: articleLanguage === 'en' ? null : (summaryChi.trim() || null),
        summary_eng: articleLanguage === 'zh' ? null : (summaryEng.trim() || null),
        content_chi: articleLanguage === 'en' ? '' : contentChi,
        content_eng: articleLanguage === 'zh' ? '' : contentEng,
        cover_image: coverImage.trim() || null,
        tags,
        updated_at: now,
      };

      const editorName = profile?.username || user?.user_metadata?.full_name || user?.email || 'Editor';

      if (articleToEdit) {
        payload.last_edited_by_name = editorName;
        if (isAdmin) {
          payload.status = status;
          if (status === 'published' && !articleToEdit.published_at) {
            payload.published_at = now;
          }
        } else {
          // 一般作者編輯修正後重新提交，狀態重置為 'submitted' 再次排隊送審
          payload.status = 'submitted';
        }
        const { error } = await supabase
          .from('eco_articles')
          .update(payload)
          .eq('id', articleToEdit.id);

        if (error) throw error;
      } else {
        payload.author_id = user?.id;
        payload.created_at = now;
        payload.status = isAdmin ? 'published' : 'submitted';
        if (payload.status === 'published') {
          payload.published_at = now;
        }

        const { error } = await supabase
          .from('eco_articles')
          .insert([payload]);

        if (error) throw error;
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Error saving article:', err);
      setErrorMsg(err.message || 'Failed to save article.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div key="journal-editor-modal-wrapper" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden my-6 border border-slate-100 flex flex-col max-h-[92vh]"
        >
          {/* Top Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15">
                <FileText className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold">
                  {articleToEdit
                    ? (language === 'zh' ? '編輯生態誌文章' : 'Edit Eco-Journal Article')
                    : (language === 'zh' ? '投稿 / 撰寫生態誌長文' : 'Submit / Draft Eco-Journal Article')}
                </h3>
                <p className="text-xs text-emerald-200/80">
                  {isAdmin
                    ? (language === 'zh' ? '管理員編輯模式' : 'Admin Edit & Publish Mode')
                    : (language === 'zh' ? '提交後將由管理員審核發布' : 'Requires admin approval after submission')}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1">
            {errorMsg && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Rejection Feedback Alert (Only shown to Author when article was rejected) */}
            {(user?.id === articleToEdit?.author_id) && articleToEdit?.rejection_reason && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>{language === 'zh' ? '退回意見反饋 Rejection Reason' : 'Rejection Feedback'}</span>
                </div>
                <p className="text-sm font-medium text-amber-900 pl-6">
                  {articleToEdit.rejection_reason}
                </p>
                <p className="text-[11px] text-amber-700/80 pl-6">
                  {language === 'zh' ? '請依照上述建議修改內容，點擊「更新內容」後將重新送交審核。' : 'Please revise based on feedback and click "Update Content".'}
                </p>
              </div>
            )}

            {/* Admin View: Historical Rejection Log */}
            {isAdmin && articleToEdit?.rejection_history && articleToEdit.rejection_history.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-700">
                  <span>{language === 'zh' ? '歷史退回紀錄 Rejection History' : 'Rejection History'} ({articleToEdit.rejection_history.length})</span>
                </div>
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {articleToEdit.rejection_history.map((log, index) => (
                    <div key={index} className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs space-y-1">
                      <div className="flex items-center justify-between text-slate-500 text-[11px]">
                        <span>{log.admin_name || 'Admin'}</span>
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-800 font-medium">{log.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Language & Category Selection Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              {/* Category Custom Dropdown (Parity with News Editor) */}
              <div className="relative toolbar-dropdown-container">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  {language === 'zh' ? '1. 文章分類 Category' : '1. Article Category'} *
                </label>
                <button
                  type="button"
                  onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-slate-800 font-bold bg-white text-sm cursor-pointer shadow-sm hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-emerald-600" />
                    {categories.find(c => c.id === categoryId) 
                      ? (language === 'zh' ? categories.find(c => c.id === categoryId)?.name_chi : categories.find(c => c.id === categoryId)?.name_eng)
                      : (language === 'zh' ? '-- 請選擇分類 --' : '-- Select Category --')}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isCategoryOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-2xl p-1.5 z-50 flex flex-col gap-1 max-h-60 overflow-y-auto"
                    >
                      {categories.map((cat, idx) => (
                        <button
                          key={cat.id || `cat-${idx}`}
                          type="button"
                          onClick={() => {
                            setCategoryId(cat.id);
                            setIsCategoryOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${categoryId === cat.id ? 'bg-emerald-50 text-emerald-700 font-extrabold' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                          <span>{language === 'zh' ? cat.name_chi : cat.name_eng}</span>
                          {categoryId === cat.id && <Check className="w-4 h-4 text-emerald-600" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Language Selection Field */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-emerald-600" />
                  {language === 'zh' ? '2. 文章語言 Language' : '2. Article Language'} *
                </label>
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setArticleLanguage('bilingual');
                      setActiveTab('zh');
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${articleLanguage === 'bilingual' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {language === 'zh' ? '中英雙語' : 'Bilingual'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setArticleLanguage('zh');
                      setActiveTab('zh');
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${articleLanguage === 'zh' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {language === 'zh' ? '只有中文' : 'Chinese Only'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setArticleLanguage('en');
                      setActiveTab('en');
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${articleLanguage === 'en' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {language === 'zh' ? '只有英文' : 'English Only'}
                  </button>
                </div>
              </div>
            </div>

            {/* Bilingual Tab Bar (Only visible when language is 'bilingual') */}
            {articleLanguage === 'bilingual' && (
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('zh')}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'zh' ? 'bg-emerald-800 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  <Languages className="w-4 h-4" />
                  {language === 'zh' ? '繁體中文內容' : 'Chinese Content'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('en')}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'en' ? 'bg-emerald-800 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  <Globe className="w-4 h-4" />
                  {language === 'zh' ? '英文內容' : 'English Content'}
                </button>
              </div>
            )}

            {/* Title & Summary Section */}
            {(articleLanguage === 'bilingual' ? activeTab === 'zh' : articleLanguage === 'zh') && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {language === 'zh' ? '中文標題 Title (Chinese)' : 'Title (Chinese)'} *
                  </label>
                  <input
                    type="text"
                    suppressHydrationWarning
                    value={titleChi}
                    onChange={(e) => setTitleChi(e.target.value)}
                    placeholder="例如：森人大冒險（1）仲夏之聲"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-emerald-500 outline-none text-slate-800 font-bold bg-slate-50/50"
                  />
                </div>

                {/* 生態文創小說專屬：章節編號與章節標題 (中文) */}
                {isNovelCategory && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-amber-900 mb-1.5 flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                        {language === 'zh' ? '章節編號 Chapter Number' : 'Chapter Number'}
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={chapterNumber}
                        onChange={(e) => setChapterNumber(e.target.value)}
                        placeholder="例如：1"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300/80 focus:border-amber-600 outline-none text-slate-800 font-bold bg-white text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-amber-900 mb-1.5">
                        {language === 'zh' ? '章節標題 Chapter Title (Chinese)' : 'Chapter Title (Chinese)'}
                      </label>
                      <input
                        type="text"
                        value={chapterTitleChi}
                        onChange={(e) => setChapterTitleChi(e.target.value)}
                        placeholder="例如：第1章 仲夏之聲"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300/80 focus:border-amber-600 outline-none text-slate-800 font-bold bg-white text-sm"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {language === 'zh' ? '中文摘要 Summary (Chinese)' : 'Summary (Chinese)'}
                  </label>
                  <div className="relative">
                    <textarea
                      rows={2}
                      value={summaryChi}
                      onChange={(e) => setSummaryChi(e.target.value)}
                      placeholder="簡短描述文章重點（展示於卡片與搜尋預覽）..."
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60 outline-none text-slate-800 text-sm bg-slate-50/50 resize-y transition-[border-color,box-shadow]"
                    />
                    <div className="absolute right-2 bottom-2 pointer-events-none text-slate-400 opacity-60">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 2L2 8M8 5L5 8M8 8H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(articleLanguage === 'bilingual' ? activeTab === 'en' : articleLanguage === 'en') && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {language === 'zh' ? '英文標題 Title (English)' : 'Title (English)'} *
                  </label>
                  <input
                    type="text"
                    suppressHydrationWarning
                    value={titleEng}
                    onChange={(e) => setTitleEng(e.target.value)}
                    placeholder="e.g. Forest Adventurers (1) Voice of Midsummer"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-emerald-500 outline-none text-slate-800 font-bold bg-slate-50/50"
                  />
                </div>

                {/* 生態文創小說專屬：章節編號與章節標題 (英文) */}
                {isNovelCategory && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-amber-900 mb-1.5 flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                        {language === 'zh' ? '章節編號 Chapter Number' : 'Chapter Number'}
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={chapterNumber}
                        onChange={(e) => setChapterNumber(e.target.value)}
                        placeholder="e.g. 1"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300/80 focus:border-amber-600 outline-none text-slate-800 font-bold bg-white text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-amber-900 mb-1.5">
                        {language === 'zh' ? '英文章節標題 Chapter Title (English)' : 'Chapter Title (English)'}
                      </label>
                      <input
                        type="text"
                        value={chapterTitleEng}
                        onChange={(e) => setChapterTitleEng(e.target.value)}
                        placeholder="e.g. Chapter 1: Voice of Midsummer"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300/80 focus:border-amber-600 outline-none text-slate-800 font-bold bg-white text-sm"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {language === 'zh' ? '英文摘要 Summary (English)' : 'Summary (English)'}
                  </label>
                  <div className="relative">
                    <textarea
                      rows={2}
                      value={summaryEng}
                      onChange={(e) => setSummaryEng(e.target.value)}
                      placeholder="Brief summary for card list preview..."
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60 outline-none text-slate-800 text-sm bg-slate-50/50 resize-y transition-[border-color,box-shadow]"
                    />
                    <div className="absolute right-2 bottom-2 pointer-events-none text-slate-400 opacity-60">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 2L2 8M8 5L5 8M8 8H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Rich Text Editor with Full Toolbar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <span>
                    {language === 'zh'
                      ? `文章內文編輯器 (${activeTab === 'zh' ? '繁體中文' : 'English'})`
                      : `Article Content Editor (${activeTab === 'zh' ? 'Chinese' : 'English'})`}
                  </span>
                  {isNovelCategory && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px]">
                      <BookOpen className="w-3 h-3 text-amber-700" />
                      生態文創小說模式
                    </span>
                  )}
                </label>

                {/* 生態文創專屬：手機閱讀模擬與控制面板按鈕 */}
                {isNovelCategory && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsNovelMobilePreview(!isNovelMobilePreview)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isNovelMobilePreview
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      {isNovelMobilePreview ? (language === 'zh' ? '返回編輯器' : 'Back to Editor') : (language === 'zh' ? '手機小說閱讀預覽' : 'Mobile Novel Preview')}
                    </button>

                    {isNovelMobilePreview && (
                      <button
                        type="button"
                        onClick={() => setIsNovelControlPanelOpen(true)}
                        className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                        {language === 'zh' ? '閱讀設定 (Panel)' : 'Reading Panel'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 當處於生態文創手機預覽模式時，渲染沉浸式小說閱讀器體驗 */}
              {isNovelCategory && isNovelMobilePreview ? (
                <div 
                  id="novel-mobile-reader-container"
                  className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-inner flex flex-col items-center py-6 px-4 sm:px-8 transition-colors duration-300 min-h-[460px] max-h-[70vh] overflow-y-auto"
                  style={{
                    backgroundColor: NOVEL_THEMES[novelSettings.theme]?.bg || '#F5ECD7',
                    color: NOVEL_THEMES[novelSettings.theme]?.color || '#3E2723',
                  }}
                >
                  {/* 手機模擬器框頂部裝飾 */}
                  <div className="w-full max-w-md flex items-center justify-between text-[11px] opacity-70 pb-3 mb-4 border-b border-current/15 font-sans">
                    <span className="font-semibold truncate max-w-[280px]">
                      {activeTab === 'zh'
                        ? (chapterTitleChi || (chapterNumber ? `第${chapterNumber}章 ${titleChi || ''}` : (titleChi || '第1章 生態篇章')))
                        : (chapterTitleEng || (chapterNumber ? `Chapter ${chapterNumber}: ${titleEng || ''}` : (titleEng || 'Chapter 1')))}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-amber-600 dark:text-amber-400 font-bold">+12 金幣</span>
                      <div className="w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[9px] font-bold">¥</div>
                    </div>
                  </div>

                  {/* 小說正文內容容器 (動態強制覆蓋行高、字級、文字顏色與段落間距) */}
                  <div 
                    id="novel-mobile-reader-content"
                    key={`novel-preview-${novelSettings.theme}-${novelSettings.lineHeight}-${novelSettings.fontSize}`}
                    className="w-full max-w-md font-serif text-justify select-none transition-all duration-200"
                    style={{
                      fontSize: `${novelSettings.fontSize}px`,
                      lineHeight: novelSettings.lineHeight === 'compact' ? 1.5 : (novelSettings.lineHeight === 'spacious' ? 2.7 : 2.0),
                      color: NOVEL_THEMES[novelSettings.theme]?.color || '#3E2723',
                    }}
                    dangerouslySetInnerHTML={{
                      __html: (() => {
                        const rawHtml = (activeTab === 'zh' ? contentChi : contentEng) || '';
                        const currentColor = NOVEL_THEMES[novelSettings.theme]?.color || '#3E2723';
                        const currentLh = novelSettings.lineHeight === 'compact' ? 1.5 : (novelSettings.lineHeight === 'spacious' ? 2.7 : 2.0);
                        const currentMb = novelSettings.lineHeight === 'compact' ? '0.75rem' : (novelSettings.lineHeight === 'spacious' ? '1.85rem' : '1.25rem');
                        const currentFs = `${novelSettings.fontSize}px`;

                        if (!rawHtml.trim()) return `<p style="opacity: 0.5; text-align: center; padding: 2.5rem 0; color: ${currentColor};">尚無內容，請在編輯器中輸入小說內文...</p>`;

                        // 徹底清除 Quill 殘留的 inline color/font 樣式，並統一注入小說主題當前 line-height 與 color
                        const cleaned = rawHtml
                          .replace(/style="[^"]*"/gi, '')
                          .replace(/<font[^>]*>/gi, '')
                          .replace(/<\/font>/gi, '');

                        // 將動態行高與文字顏色直接套用到所有 <p> 標籤
                        const transformed = cleaned
                          .replace(/<p([^>]*)>/gi, `<p style="font-size: ${currentFs} !important; line-height: ${currentLh} !important; margin-bottom: ${currentMb} !important; color: ${currentColor} !important; text-indent: 0 !important;"$1>`)
                          .replace(/<span([^>]*)>/gi, `<span style="font-size: ${currentFs} !important; line-height: ${currentLh} !important; color: ${currentColor} !important;"$1>`)
                          .replace(/<div([^>]*)>/gi, `<div style="font-size: ${currentFs} !important; line-height: ${currentLh} !important; margin-bottom: ${currentMb} !important; color: ${currentColor} !important; text-indent: 0 !important;"$1>`);

                        return transformed;
                      })()
                    }}
                  />

                  {/* 閱讀控制面板 (Control Panel) */}
                  <NovelReaderControlPanel
                    isOpen={isNovelControlPanelOpen}
                    onToggle={() => setIsNovelControlPanelOpen(!isNovelControlPanelOpen)}
                    settings={novelSettings}
                    onUpdateSettings={handleUpdateNovelSettings}
                  />
                </div>
              ) : (
                <>
                  {/* Full Toolbar - Matches NewsEditor Bar */}
                  <div className="p-2 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const quill = activeTab === 'zh' ? quillRefChi.current?.getEditor() : quillRefEng.current?.getEditor();
                        if (quill) quill.history.undo();
                      }}
                      className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-slate-600 hover:text-emerald-600 transition-colors"
                      title="Undo (Ctrl+Z)"
                    >
                      <Undo className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const quill = activeTab === 'zh' ? quillRefChi.current?.getEditor() : quillRefEng.current?.getEditor();
                        if (quill) quill.history.redo();
                      }}
                      className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-slate-600 hover:text-emerald-600 transition-colors"
                      title="Redo (Ctrl+Shift+Z)"
                    >
                      <Redo className="w-4 h-4" />
                    </button>

                    <div className="w-px h-4 bg-slate-300 mx-1" />

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertFormat('bold')}
                      className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-slate-700 hover:text-emerald-700 transition-colors"
                      title="Bold"
                    >
                      <Bold className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertFormat('italic')}
                      className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-slate-700 hover:text-emerald-700 transition-colors"
                      title="Italic"
                    >
                      <Italic className="w-4 h-4" />
                    </button>

                    <div className="w-px h-4 bg-slate-300 mx-1" />

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertFormat('h1')}
                      className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-slate-700 hover:text-emerald-700 transition-colors"
                      title="Heading 1"
                    >
                      <Heading1 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertFormat('h2')}
                      className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-slate-700 hover:text-emerald-700 transition-colors"
                      title="Heading 2"
                    >
                      <Heading2 className="w-4 h-4" />
                    </button>

                    <div className="w-px h-4 bg-slate-300 mx-1" />

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertFormat('list')}
                      className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-slate-700 hover:text-emerald-700 transition-colors"
                      title="Bullet List"
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertFormat('ol')}
                      className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-slate-700 hover:text-emerald-700 transition-colors"
                      title="Numbered List"
                    >
                      <ListOrdered className="w-4 h-4" />
                    </button>

                    <div className="w-px h-4 bg-slate-300 mx-1" />

                    {/* Font Size Dropdown */}
                    <div className="relative toolbar-dropdown-container">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setOpenDropdown(openDropdown === 'size' ? null : 'size')}
                        className={`p-2 rounded-xl transition-colors ${openDropdown === 'size' ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-white text-slate-700 hover:text-emerald-700'}`}
                        title="Font Size"
                      >
                        <Type className="w-4 h-4" />
                      </button>
                      <AnimatePresence>
                        {openDropdown === 'size' && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-full left-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-2xl p-3.5 z-50 flex flex-col gap-3.5 w-[232px]"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-500 shrink-0">
                                px
                              </div>
                              <input 
                                type="number"
                                min="8"
                                max="120"
                                suppressHydrationWarning
                                value={customFontSize} 
                                onChange={(e) => setCustomFontSize(e.target.value)}
                                placeholder="8-72"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
                              />
                            </div>

                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                const val = parseInt(customFontSize, 10);
                                if (val > 0) {
                                  insertFormat(`size:${val}px`);
                                  setOpenDropdown(null);
                                }
                              }}
                              className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-emerald-600 transition-all shadow-md shadow-slate-900/10 active:scale-95 cursor-pointer"
                            >
                              {language === 'zh' ? '套用字級' : 'Apply Size'}
                            </button>

                            <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-100 max-h-44 overflow-y-auto pr-0.5">
                              {[8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72].map((num) => (
                                <button
                                  key={num}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setCustomFontSize(num.toString());
                                    insertFormat(`size:${num}px`);
                                    setOpenDropdown(null);
                                  }}
                                  className="py-1.5 px-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-center border border-slate-100 cursor-pointer"
                                >
                                  {num}px
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Color Palette Dropdown */}
                    <div className="relative toolbar-dropdown-container">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setOpenDropdown(openDropdown === 'color' ? null : 'color')}
                        className={`p-2 rounded-xl transition-colors ${openDropdown === 'color' ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-white text-slate-700 hover:text-emerald-700'}`}
                        title="Text Color"
                      >
                        <Palette className="w-4 h-4" />
                      </button>
                      <AnimatePresence>
                        {openDropdown === 'color' && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-full left-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-2xl p-3.5 z-50 flex flex-col gap-3.5 w-[232px]"
                          >
                            <div 
                              className="custom-color-picker w-full [&_.react-colorful]:w-full [&_.react-colorful]:h-[160px]"
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              <HexColorPicker color={pickerColor} onChange={setPickerColor} />
                            </div>
                            
                            <div className="flex items-center gap-2.5">
                              <div 
                                className="w-8 h-8 rounded-xl border border-slate-200 shadow-inner shrink-0"
                                style={{ backgroundColor: pickerColor }}
                              />
                              <input 
                                type="text" 
                                suppressHydrationWarning
                                value={pickerColor} 
                                onChange={(e) => setPickerColor(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-700 focus:outline-none focus:border-emerald-500 uppercase"
                              />
                            </div>

                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                insertFormat(`color:${pickerColor}`);
                                setOpenDropdown(null);
                              }}
                              className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-emerald-600 transition-all shadow-md shadow-slate-900/10 active:scale-95 cursor-pointer"
                            >
                              {language === 'zh' ? '套用顏色' : 'Apply Color'}
                            </button>

                            <div className="grid grid-cols-6 gap-1.5 pt-2 border-t border-slate-100">
                              {["#10B981", "#059669", "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899", "#EF4444", "#F59E0B", "#D97706", "#0F172A", "#475569", "#94A3B8"].map((c, idx) => (
                                <button
                                  key={`${c}-${idx}`}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setPickerColor(c);
                                    insertFormat(`color:${c}`);
                                    setOpenDropdown(null);
                                  }}
                                  className="w-5 h-5 rounded-md border border-slate-200 transition-transform hover:scale-110 cursor-pointer"
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="w-px h-4 bg-slate-300 mx-1" />

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertFormat('quote')}
                      className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-slate-700 hover:text-emerald-700 transition-colors"
                      title="Quote"
                    >
                      <Quote className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertFormat('code')}
                      className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-slate-700 hover:text-emerald-700 transition-colors"
                      title="Code Block"
                    >
                      <Code className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertFormat('link')}
                      className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-slate-700 hover:text-emerald-700 transition-colors"
                      title="Insert Link"
                    >
                      <LinkIcon className="w-4 h-4" />
                    </button>
                  </div>

                  {/* ReactQuill Content Editors (Borderless Clean View with Resizer) */}
                  <div className="rounded-2xl border border-slate-200 bg-white quill-editor-wrapper relative resize-y overflow-auto min-h-[260px] max-h-[75vh] focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-200/60 transition-[border-color,box-shadow]">
                    {activeTab === 'zh' ? (
                      <ReactQuill
                        forwardedRef={quillRefChi}
                        value={contentChi}
                        onChange={(val: string) => setContentChi(val)}
                        placeholder="請撰寫中文文章內容..."
                        modules={{ toolbar: false }}
                        className="h-full flex flex-col"
                      />
                    ) : (
                      <ReactQuill
                        forwardedRef={quillRefEng}
                        value={contentEng}
                        onChange={(val: string) => setContentEng(val)}
                        placeholder="Write English article content here..."
                        modules={{ toolbar: false }}
                        className="h-full flex flex-col"
                      />
                    )}
                    {/* Drag Handle Visual Icon */}
                    <div className="absolute right-1.5 bottom-1.5 pointer-events-none text-slate-400 opacity-60">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 2L2 8M8 5L5 8M8 8H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Cover Image URL */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                {language === 'zh' ? '文章封面圖片 URL (Cover Image URL)' : 'Cover Image URL'}
              </label>
              <input
                type="url"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://images.unsplash.com/photo-..."
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-emerald-500 outline-none text-slate-800 text-sm bg-slate-50/50"
              />
              {coverImage && (
                <div className="mt-2 h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                  <img src={coverImage} alt="Cover Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* Tags System */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-emerald-600" />
                {language === 'zh' ? '文章標籤 Tags (可多選/自訂)' : 'Article Tags'}
              </label>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="輸入標籤按下 Enter 或點擊新增 (例: 黑臉琵鷺, 濕地保育)"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-slate-800 text-sm bg-slate-50/50"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl transition-colors"
                >
                  {language === 'zh' ? '新增 Tag' : 'Add Tag'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, idx) => (
                  <span
                    key={`${tag}-${idx}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-rose-600 font-bold ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Read-Only Admin Status Badge */}
            {isAdmin && articleToEdit && (
              <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {language === 'zh' ? '當前文章審核狀態 Current Status' : 'Current Article Status'}
                </span>
                <span className={`px-3.5 py-1 rounded-full text-xs font-bold ${
                  articleToEdit.status === 'published'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : (articleToEdit.status === 'rejected'
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200')
                }`}>
                  {t(`journal.status_${articleToEdit.status}`)}
                </span>
              </div>
            )}

            {/* Submit & Action Buttons */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              {/* Admin Action Buttons: Reject & Approve */}
              {isAdmin && articleToEdit && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onRejectTrigger) onRejectTrigger(articleToEdit);
                    }}
                    className="px-4 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    {t('journal.reject')}
                  </button>
                  {articleToEdit.status !== 'published' && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (onApproveTrigger) onApproveTrigger(articleToEdit);
                      }}
                      className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {t('journal.approve')}
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-6 py-3 rounded-2xl text-slate-600 hover:bg-slate-100 font-medium text-sm transition-colors"
                >
                  {language === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting
                    ? (language === 'zh' ? '處理中...' : 'Saving...')
                    : (articleToEdit
                      ? (language === 'zh' ? '更新文章內容' : 'Update Content')
                      : (isAdmin
                        ? (language === 'zh' ? '直接發布文章' : 'Publish Article')
                        : (language === 'zh' ? '提交投稿文章' : 'Submit Article')))}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>

      <style jsx global>{`
        .quill-editor-wrapper .ql-toolbar.ql-snow {
          border: none !important;
        }
        .quill-editor-wrapper .ql-container.ql-snow {
          border: none !important;
        }
        .quill-editor-wrapper .ql-editor {
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          padding: 1.25rem 1.5rem !important;
          font-size: 1rem !important;
          line-height: 1.7 !important;
          color: #1e293b !important;
          min-height: 240px !important;
        }
        .quill-editor-wrapper::-webkit-resizer {
          display: none !important;
          background: transparent !important;
        }
        .quill-editor-wrapper .ql-editor.ql-blank::before {
          font-style: normal !important;
          color: #94a3b8 !important;
          left: 1.5rem !important;
        }
        #novel-mobile-reader-content,
        #novel-mobile-reader-content * {
          font-size: ${novelSettings.fontSize}px !important;
          line-height: ${novelSettings.lineHeight === 'compact' ? 1.5 : (novelSettings.lineHeight === 'spacious' ? 2.7 : 2.0)} !important;
          color: ${NOVEL_THEMES[novelSettings.theme]?.color || '#3E2723'} !important;
        }
        #novel-mobile-reader-content p,
        #novel-mobile-reader-content div {
          margin-bottom: ${novelSettings.lineHeight === 'compact' ? '0.75rem' : (novelSettings.lineHeight === 'spacious' ? '1.85rem' : '1.25rem')} !important;
          text-indent: 0 !important;
        }
      `}</style>
    </AnimatePresence>
  );
}
