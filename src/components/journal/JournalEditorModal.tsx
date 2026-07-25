'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Image as ImageIcon, Tag, Send, CheckCircle2, AlertCircle, FileText,
  Languages, Globe, Undo, Redo, Bold, Italic, Heading1, Heading2, List,
  ListOrdered, Type, Palette, Link as LinkIcon, Quote, Code
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

const ReactQuill = dynamic(
  async () => {
    const { default: RQ, Quill } = await import('react-quill-new');
    
    // Register Style Attributors so Quill applies style="color: ..." and style="font-size: ..." inline
    const SizeStyle = Quill.import('attributors/style/size') as any;
    const ColorStyle = Quill.import('attributors/style/color') as any;
    SizeStyle.whitelist = ['0.875rem', '1rem', '1.25rem', '1.5rem', '2rem'];
    
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
  const [pickerColor, setPickerColor] = useState('#10B981');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const quillRefChi = useRef<any>(null);
  const quillRefEng = useRef<any>(null);

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
              {/* Category Select */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  {language === 'zh' ? '1. 文章分類 Category' : '1. Article Category'} *
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-slate-800 font-bold bg-white text-sm"
                  required
                >
                  <option key="default-placeholder" value="">{language === 'zh' ? '-- 請選擇分類 --' : '-- Select Category --'}</option>
                  {categories.map((cat, idx) => (
                    <option key={cat.id || `cat-${idx}`} value={cat.id}>
                      {language === 'zh' ? cat.name_chi : cat.name_eng}
                    </option>
                  ))}
                </select>
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
                    placeholder="例如：米埔濕地水鳥遷徙與全球保育挑戰"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-emerald-500 outline-none text-slate-800 font-bold bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {language === 'zh' ? '中文摘要 Summary (Chinese)' : 'Summary (Chinese)'}
                  </label>
                  <textarea
                    rows={2}
                    value={summaryChi}
                    onChange={(e) => setSummaryChi(e.target.value)}
                    placeholder="簡短描述文章重點（展示於卡片與搜尋預覽）..."
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-emerald-500 outline-none text-slate-800 text-sm bg-slate-50/50"
                  />
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
                    placeholder="e.g. Migratory Waterbirds and Conservation at Mai Po"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-emerald-500 outline-none text-slate-800 font-bold bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {language === 'zh' ? '英文摘要 Summary (English)' : 'Summary (English)'}
                  </label>
                  <textarea
                    rows={2}
                    value={summaryEng}
                    onChange={(e) => setSummaryEng(e.target.value)}
                    placeholder="Brief summary for card list preview..."
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-emerald-500 outline-none text-slate-800 text-sm bg-slate-50/50"
                  />
                </div>
              </div>
            )}

            {/* Rich Text Editor with Full Toolbar */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
                <span>
                  {language === 'zh'
                    ? `文章內文編輯器 (${activeTab === 'zh' ? '繁體中文' : 'English'})`
                    : `Article Content Editor (${activeTab === 'zh' ? 'Chinese' : 'English'})`}
                </span>
                <span className="text-[11px] text-emerald-600 font-normal">
                  支援高階格式化工具列與圖文編輯
                </span>
              </label>

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
                        className="absolute top-full left-0 mt-2 bg-white border border-slate-200 shadow-xl rounded-2xl p-1.5 z-50 min-w-[130px]"
                      >
                        {[
                          { label: 'Small', value: '0.875rem' },
                          { label: 'Normal', value: '1rem' },
                          { label: 'Large', value: '1.25rem' },
                          { label: 'Extra Large', value: '1.5rem' },
                          { label: 'Heading', value: '2rem' }
                        ].map((size, idx) => (
                          <button
                            key={`font-size-${size.value}-${idx}`}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              insertFormat(`size:${size.value}`);
                              setOpenDropdown(null);
                            }}
                            className="w-full text-left px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                          >
                            {size.label}
                          </button>
                        ))}
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
                        className="absolute top-full left-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 z-50 flex flex-col gap-3 min-w-[220px]"
                      >
                        <HexColorPicker
                          color={pickerColor}
                          onChange={(c) => {
                            setPickerColor(c);
                            insertFormat(`color:${c}`);
                          }}
                        />
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
                              className="w-5 h-5 rounded-md border border-slate-200 transition-transform hover:scale-110"
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

              {/* ReactQuill Content Editors (Borderless Clean View) */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden quill-editor-wrapper">
                {activeTab === 'zh' ? (
                  <ReactQuill
                    forwardedRef={quillRefChi}
                    value={contentChi}
                    onChange={(val: string) => setContentChi(val)}
                    placeholder="請撰寫中文文章內容..."
                    modules={{ toolbar: false }}
                    className="h-full flex flex-col min-h-[260px]"
                  />
                ) : (
                  <ReactQuill
                    forwardedRef={quillRefEng}
                    value={contentEng}
                    onChange={(val: string) => setContentEng(val)}
                    placeholder="Write English article content here..."
                    modules={{ toolbar: false }}
                    className="h-full flex flex-col min-h-[260px]"
                  />
                )}
              </div>
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
        .quill-editor-wrapper .ql-editor.ql-blank::before {
          font-style: normal !important;
          color: #94a3b8 !important;
          left: 1.5rem !important;
        }
      `}</style>
    </AnimatePresence>
  );
}
