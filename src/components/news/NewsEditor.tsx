'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabase';
import { 
  X, Save, Bold, Italic, List, Link as LinkIcon, 
  Heading1, Heading2, Quote, Code, Eye, Edit3, 
  Globe, Languages, ChevronDown, CheckCircle2, AlertCircle,
  Palette, Type, Undo, Redo, ListOrdered, ArrowLeft, Calendar, EyeOff 
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import rehypeExternalLinks from 'rehype-external-links';
import { motion, AnimatePresence } from 'framer-motion';
import { HexColorPicker } from "react-colorful";
import CustomDropdown from '@/components/ui/CustomDropdown';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { useRef } from 'react';

const ReactQuill = dynamic(
  async () => {
    const { default: RQ } = await import('react-quill-new');
    // eslint-disable-next-line react/display-name
    return ({ forwardedRef, ...props }: any) => <RQ ref={forwardedRef} {...props} />;
  },
  { 
    ssr: false,
    loading: () => <div className="w-full h-full bg-slate-50 animate-pulse" />
  }
);

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

interface NewsItem {
  id?: string;
  category: string;
  published_at?: string;
  title_chi: string;
  title_eng: string;
  content_chi: string;
  content_eng: string;
}

interface NewsEditorProps {
  news?: NewsItem | null;
  onClose: () => void;
  onSave: () => void;
}

const CATEGORIES = [
  { id: 'Notice', name: '公告', nameEng: 'Notice' },
  { id: 'System', name: '系統維護', nameEng: 'System' },
  { id: 'Community', name: '社群消息', nameEng: 'Community' },
  { id: 'Taxonomy', name: '物種更新', nameEng: 'Taxonomy' },
  { id: 'Sales', name: '商品消息', nameEng: 'Sales' }
];

export default function NewsEditor({ news, onClose, onSave }: NewsEditorProps) {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'chi' | 'eng'>('chi');
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'size' | 'color' | null>(null);
  const [pickerColor, setPickerColor] = useState("#679758");
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'save' | null>(null);
  const quillRefChi = useRef<any>(null);
  const quillRefEng = useRef<any>(null);

  // 初始化時將 Markdown 轉為 HTML
  const [formData, setFormData] = useState<NewsItem>(() => {
    const initial = {
      category: 'Notice',
      title_chi: '',
      title_eng: '',
      content_chi: '',
      content_eng: '',
      ...news
    };
    return {
      ...initial,
      content_chi: news?.content_chi ? marked.parse(news.content_chi) as string : '',
      content_eng: news?.content_eng ? marked.parse(news.content_eng) as string : ''
    };
  });

  // History management
  const [history, setHistory] = useState<NewsItem[]>([{
    category: 'Notice',
    title_chi: '',
    title_eng: '',
    content_chi: '',
    content_eng: '',
    ...news
  }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const addToHistory = (newSnapshot: NewsItem) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newSnapshot)));
    // Keep last 50 steps
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setFormData(JSON.parse(JSON.stringify(history[prevIndex])));
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setFormData(JSON.parse(JSON.stringify(history[nextIndex])));
    }
  };

  const handleInputChange = (field: keyof NewsItem, value: string, skipHistory = false) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    if (!skipHistory) {
      // Use a timeout to debounce typing history
      const timeoutId = (window as any)._historyTimeout;
      if (timeoutId) clearTimeout(timeoutId);
      (window as any)._historyTimeout = setTimeout(() => {
        addToHistory(newData);
      }, 500);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const text = textarea.value;
      
      // Get current line
      const lines = text.substring(0, start).split('\n');
      const currentLine = lines[lines.length - 1];
      
      // Check for unordered list
      const ulMatch = currentLine.match(/^(\s*)-\s+(.*)/);
      if (ulMatch) {
        if (ulMatch[2].trim() === '') {
          // Empty list item, remove it (backspace behavior)
          e.preventDefault();
          const newText = text.substring(0, start - ulMatch[0].length) + text.substring(start);
          handleInputChange(activeTab === 'chi' ? 'content_chi' : 'content_eng', newText);
          return;
        }
        e.preventDefault();
        const insertion = `\n${ulMatch[1]}- `;
        const newText = text.substring(0, start) + insertion + text.substring(start);
        handleInputChange(activeTab === 'chi' ? 'content_chi' : 'content_eng', newText);
        setTimeout(() => {
          textarea.setSelectionRange(start + insertion.length, start + insertion.length);
        }, 0);
        return;
      }

      // Check for ordered list
      const olMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)/);
      if (olMatch) {
        if (olMatch[3].trim() === '') {
          // Empty list item, remove it
          e.preventDefault();
          const newText = text.substring(0, start - olMatch[0].length) + text.substring(start);
          handleInputChange(activeTab === 'chi' ? 'content_chi' : 'content_eng', newText);
          return;
        }
        e.preventDefault();
        const nextNum = parseInt(olMatch[2]) + 1;
        const insertion = `\n${olMatch[1]}${nextNum}. `;
        const newText = text.substring(0, start) + insertion + text.substring(start);
        handleInputChange(activeTab === 'chi' ? 'content_chi' : 'content_eng', newText);
        setTimeout(() => {
          textarea.setSelectionRange(start + insertion.length, start + insertion.length);
        }, 0);
        return;
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.toolbar-dropdown-container')) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);

  const insertMarkdown = (type: string) => {
    const quill = activeTab === 'chi' ? quillRefChi.current?.getEditor() : quillRefEng.current?.getEditor();
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
        case 'color': quill.format('color', value || '#679758'); break;
        case 'size': quill.format('size', value === '1.25rem' ? 'large' : value === '1.5rem' ? 'huge' : value === '0.875rem' ? 'small' : value); break;
      }
    }
  };

  const handleQuillChange = (content: string) => {
    const field = activeTab === 'chi' ? 'content_chi' : 'content_eng';
    handleInputChange(field, content);
  };

  const handleSave = async () => {
    if (!formData.title_chi || !formData.title_eng) {
      alert(language === 'zh' ? '請填寫標題' : 'Please fill in titles');
      return;
    }

    if (confirmAction !== 'save') {
      setConfirmAction('save');
      return;
    }

    setConfirmAction(null);
    setIsSaving(true);
    try {
      // 儲存前將 HTML 轉回 Markdown 以保持資料格式一致性
      const payload: any = { 
        ...formData,
        content_chi: turndownService.turndown(formData.content_chi),
        content_eng: turndownService.turndown(formData.content_eng)
      };
      
      if (!payload.id) delete payload.id;
      
      const { error } = await supabase
        .from('site_news')
        .upsert({
          ...payload,
          published_at: payload.published_at || new Date().toISOString(),
        });

      if (error) throw error;
      onSave();
    } catch (err: any) {
      console.error('Error saving news details:', err);
      alert(language === 'zh' 
        ? `儲存失敗: ${err.message || err.details || '未知錯誤'}` 
        : `Failed to save: ${err.message || err.details || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col max-w-7xl mx-auto h-[85vh]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
            <Edit3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800 leading-none">
              {news ? (language === 'zh' ? '編輯公告' : 'Edit News') : (language === 'zh' ? '新增公告' : 'Create News')}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {language === 'zh' ? '公告管理系統' : 'News Management System'}
            </p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-slate-200/50 rounded-full text-slate-400 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Editor Area */}
        <div className="flex-1 flex flex-col border-r border-slate-100 overflow-hidden">
          {/* Settings Bar */}
          <div className="p-4 border-b border-slate-50 flex flex-wrap items-center gap-4 bg-white">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 px-1">
                {language === 'zh' ? '公告類別' : 'Category'}
              </label>
              <CustomDropdown
                options={CATEGORIES.map(cat => ({ 
                  value: cat.id, 
                  label: language === 'zh' ? cat.name : cat.nameEng 
                }))}
                value={formData.category}
                onChange={(val) => handleInputChange('category', val)}
                className="w-full"
              />
            </div>
            
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setActiveTab('chi')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'chi' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Languages className="w-3.5 h-3.5" />
                中文
              </button>
              <button 
                onClick={() => setActiveTab('eng')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'eng' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Globe className="w-3.5 h-3.5" />
                English
              </button>
            </div>
          </div>

          {/* Title Input */}
          <div className="px-6 py-4 bg-white border-b border-slate-50">
            <input 
              type="text"
              placeholder={activeTab === 'chi' ? '請輸入中文標題...' : 'Enter English title...'}
              value={activeTab === 'chi' ? formData.title_chi : formData.title_eng}
              onChange={(e) => handleInputChange(activeTab === 'chi' ? 'title_chi' : 'title_eng', e.target.value)}
              className="w-full text-xl md:text-2xl font-black text-slate-800 placeholder-slate-300 border-none focus:ring-0 p-0"
            />
          </div>

          {/* Toolbar */}
          <div className="px-4 py-2 border-b border-slate-50 bg-slate-50/30 flex items-center gap-1 flex-wrap">
            <ToolbarButton icon={<Undo size={16} />} onClick={undo} title="Undo (Ctrl+Z)" disabled={historyIndex <= 0} />
            <ToolbarButton icon={<Redo size={16} />} onClick={redo} title="Redo (Ctrl+Shift+Z)" disabled={historyIndex >= history.length - 1} />
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <ToolbarButton icon={<Bold size={16} />} onClick={() => insertMarkdown('bold')} title="Bold" />
            <ToolbarButton icon={<Italic size={16} />} onClick={() => insertMarkdown('italic')} title="Italic" />
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <ToolbarButton icon={<Heading1 size={16} />} onClick={() => insertMarkdown('h1')} title="H1" />
            <ToolbarButton icon={<Heading2 size={16} />} onClick={() => insertMarkdown('h2')} title="H2" />
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <ToolbarButton icon={<List size={16} />} onClick={() => insertMarkdown('list')} title="List" />
            <ToolbarButton icon={<ListOrdered size={16} />} onClick={() => insertMarkdown('ol')} title="Numbered List" />
            <div className="w-px h-4 bg-slate-200 mx-1" />
            
            {/* Font Size Dropdown */}
            <div className="relative toolbar-dropdown-container">
              <ToolbarButton 
                icon={<Type size={16} />} 
                onClick={() => setOpenDropdown(openDropdown === 'size' ? null : 'size')} 
                title="Font Size"
                active={openDropdown === 'size'}
              />
              <AnimatePresence>
                {openDropdown === 'size' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 mt-2 bg-white border border-slate-100 shadow-xl rounded-xl p-1.5 z-50 min-w-[120px]"
                  >
                    {[
                      { label: 'Small', value: '0.875rem' },
                      { label: 'Normal', value: '1rem' },
                      { label: 'Large', value: '1.25rem' },
                      { label: 'Extra Large', value: '1.5rem' },
                      { label: 'Heading', value: '2rem' }
                    ].map(size => (
                      <button
                        key={size.value}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          insertMarkdown(`size:${size.value}`);
                          setOpenDropdown(null);
                        }}
                        className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-emerald-600 transition-colors"
                      >
                        {size.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Color Palette */}
            <div className="relative toolbar-dropdown-container">
              <ToolbarButton 
                icon={<Palette size={16} />} 
                onClick={() => setOpenDropdown(openDropdown === 'color' ? null : 'color')} 
                title="Text Color"
                active={openDropdown === 'color'}
              />
              <AnimatePresence>
                {openDropdown === 'color' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 mt-2 bg-white border border-slate-100 shadow-2xl rounded-2xl p-4 z-50 flex flex-col gap-4"
                  >
                    <div 
                      className="custom-color-picker"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <HexColorPicker color={pickerColor} onChange={setPickerColor} />
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-xl border border-slate-100 shadow-inner"
                        style={{ backgroundColor: pickerColor }}
                      />
                      <input 
                        type="text" 
                        value={pickerColor} 
                        onChange={(e) => setPickerColor(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 uppercase"
                      />
                    </div>

                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        insertMarkdown(`color:${pickerColor}`);
                        setOpenDropdown(null);
                      }}
                      className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-slate-200"
                    >
                      {language === 'zh' ? '套用顏色' : 'Apply Color'}
                    </button>

                    <div className="grid grid-cols-6 gap-1.5 pt-2 border-t border-slate-50">
                      {[
                        '#1e293b', '#64748b', '#ef4444', '#f59e0b', '#10b981', '#059669',
                        '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#78350f', '#000000'
                      ].map(c => (
                        <button
                          key={c}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setPickerColor(c)}
                          className="w-5 h-5 rounded-md border border-slate-100 transition-transform hover:scale-110"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="w-px h-4 bg-slate-200 mx-1" />
            <ToolbarButton icon={<Quote size={16} />} onClick={() => insertMarkdown('quote')} title="Quote" />
            <ToolbarButton icon={<Code size={16} />} onClick={() => insertMarkdown('code')} title="Code" />
            <ToolbarButton icon={<LinkIcon size={16} />} onClick={() => insertMarkdown('link')} title="Link" />
            <div className="flex-1" />
          </div>

          {/* Content Area */}
          <div className="flex-1 relative bg-white overflow-hidden flex flex-col quill-editor-wrapper">
            <ReactQuill
              forwardedRef={activeTab === 'chi' ? quillRefChi : quillRefEng}
              value={activeTab === 'chi' ? formData.content_chi : formData.content_eng}
              onChange={handleQuillChange}
              placeholder={activeTab === 'chi' ? '開始輸入中文公告內容...' : 'Start typing English content...'}
              theme="snow"
              modules={{
                toolbar: false // 使用我們自定義的工具列
              }}
              className="h-full flex flex-col"
            />
          </div>
        </div>

        {/* Preview Area (Full UI Simulation) */}
        <AnimatePresence>
          {showPreview && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex-1 bg-white overflow-y-auto p-4 md:p-12 news-preview border-l border-slate-100"
            >
              <div className="max-w-4xl mx-auto">
                {/* Simulated detail page layout */}
                <div className="mb-8 flex items-center gap-2 text-slate-400 font-bold text-xs">
                  <ArrowLeft className="w-3 h-3" /> BACK TO HOME / 返回首頁
                </div>

                <header className="mb-10">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="px-3 py-1 bg-emerald-50 text-[10px] font-black text-emerald-600 uppercase tracking-widest rounded-full">
                      {CATEGORIES.find(c => c.id === formData.category)?.name || formData.category}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> 
                      {new Date().toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  
                  <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight mb-4">
                    {activeTab === 'chi' ? (formData.title_chi || '中文標題預覽') : (formData.title_eng || 'English Title Preview')}
                  </h1>
                </header>

                <article className="border-t border-slate-100 pt-10">
                  <div className="news-content prose prose-slate max-w-none">
                    <ReactMarkdown 
                      rehypePlugins={[
                        rehypeRaw,
                        [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }]
                      ]}
                      remarkPlugins={[remarkBreaks]}
                    >
                      {turndownService.turndown(activeTab === 'chi' ? formData.content_chi : formData.content_eng)}
                    </ReactMarkdown>
                  </div>
                </article>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between">
        <p className="text-[10px] font-bold text-slate-400">
          {language === 'zh' ? '* 公告將於發佈後立即顯示在首頁與列表' : '* News will appear on home and list after publishing'}
        </p>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
              showPreview 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-500/30 hover:text-emerald-600 shadow-sm'
            }`}
          >
            {showPreview ? <EyeOff size={18} /> : <Eye size={18} />}
            {showPreview ? (language === 'zh' ? '退出預覽' : 'Exit Preview') : (language === 'zh' ? '預覽公告' : 'Preview News')}
          </button>

          <button 
            onClick={() => setConfirmAction('cancel')}
            className="px-6 py-2.5 rounded-xl text-sm font-black text-slate-500 hover:bg-slate-100 transition-all"
          >
            {language === 'zh' ? '取消' : 'Cancel'}
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-8 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {language === 'zh' ? '發佈公告' : 'Publish News'}
          </button>
        </div>
      </div>

      <style jsx global>{`
        .news-preview .news-content {
          color: #334155;
          font-size: 1rem;
          line-height: 1.7;
        }
        .news-preview .news-content p { margin-bottom: 1.25rem; }
        .news-preview .news-content strong { font-weight: 800; color: #1e293b; }
        .news-preview .news-content h1, .news-preview .news-content h2, .news-preview .news-content h3 {
          font-weight: 900; color: #0f172a; margin-top: 2rem; margin-bottom: 1rem;
        }
        .news-preview .news-content h1 { font-size: 1.5rem !important; }
        .news-preview .news-content h2 { font-size: 1.25rem !important; }
        .news-preview .news-content blockquote {
          border-left: 4px solid #10b981; padding: 0.75rem 1.25rem; background: #f8fafc; border-radius: 0 0.75rem 0.75rem 0; margin: 1.5rem 0;
        }
        .news-preview .news-content ul, .news-preview .news-content ol { 
          padding-left: 2rem !important; margin-bottom: 1.25rem; 
        }
        .news-preview .news-content ul { list-style-type: disc; }
        .news-preview .news-content ol { list-style-type: decimal; }
        .news-preview .news-content li { margin-bottom: 0.5rem; }
        
        .quill-editor-wrapper .ql-container {
          border: none !important;
          font-family: inherit;
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .quill-editor-wrapper .ql-editor {
          padding: 1.5rem 3rem;
          font-size: 1rem;
          line-height: 1.75;
          color: #334155;
          flex: 1;
          overflow-y: auto;
        }
        .quill-editor-wrapper .ql-editor h1 {
          font-size: 1.5rem !important;
          font-weight: 900 !important;
          margin-top: 2rem !important;
          margin-bottom: 1.25rem !important;
          color: #0f172a !important;
          padding-bottom: 0.5rem;
        }
        .quill-editor-wrapper .ql-editor h2 {
          font-size: 1.25rem !important;
          font-weight: 900 !important;
          margin-top: 1.5rem !important;
          margin-bottom: 1rem !important;
          color: #0f172a !important;
        }
        .quill-editor-wrapper .ql-editor ul, 
        .quill-editor-wrapper .ql-editor ol {
          padding-left: 0.75rem !important;
          margin-bottom: 1.25rem !important;
        }
        .quill-editor-wrapper .ql-editor li {
          margin-bottom: 0.5rem !important;
          padding-left: 0.5rem !important;
        }
        .quill-editor-wrapper .ql-editor.ql-blank::before {
          left: 3rem;
          color: #cbd5e1;
          font-style: normal;
        }
        /* 字體大小對應 */
        .ql-size-small { font-size: 0.875rem !important; }
        .ql-size-large { font-size: 1.25rem !important; }
        .ql-size-huge { font-size: 1.5rem !important; }
        
        .custom-color-picker .react-colorful {
          width: 200px;
          height: 160px;
        }
        .custom-color-picker .react-colorful__saturation {
          border-radius: 12px 12px 0 0;
        }
        .custom-color-picker .react-colorful__hue {
          height: 12px;
          border-radius: 0 0 12px 12px;
          margin-top: 8px;
        }
        .custom-color-picker .react-colorful__pointer {
          width: 16px;
          height: 16px;
        }
      `}</style>

      {/* Confirmation Modal Overlay */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center"
            >
              <div className={`w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center ${confirmAction === 'save' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                {confirmAction === 'save' ? <Save size={32} /> : <AlertCircle size={32} />}
              </div>
              
              <h3 className="text-xl font-black text-slate-900 mb-2">
                {confirmAction === 'save' 
                  ? (language === 'zh' ? '確定要發佈嗎？' : 'Ready to Publish?') 
                  : (language === 'zh' ? '放棄編輯？' : 'Discard Changes?')}
              </h3>
              
              <p className="text-sm text-slate-500 font-bold mb-8 leading-relaxed">
                {confirmAction === 'save'
                  ? (language === 'zh' ? '此操作將會立即更新首頁與公告列表，所有使用者皆可看見內容。' : 'This will immediately update the homepage and news list for everyone.')
                  : (language === 'zh' ? '您尚未儲存的內容將會遺失，確定要關閉編輯器嗎？' : 'All unsaved changes will be lost. Are you sure you want to close?')}
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => confirmAction === 'save' ? handleSave() : onClose()}
                  className={`w-full py-3 rounded-2xl text-sm font-black text-white shadow-lg transition-all ${
                    confirmAction === 'save' 
                      ? 'bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-500' 
                      : 'bg-red-600 shadow-red-600/20 hover:bg-red-500'
                  }`}
                >
                  {confirmAction === 'save' 
                    ? (language === 'zh' ? '確定發佈' : 'Confirm Publish') 
                    : (language === 'zh' ? '確定放棄' : 'Confirm Discard')}
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="w-full py-3 rounded-2xl text-sm font-black text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
                >
                  {language === 'zh' ? '返回' : 'Back'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToolbarButton({ icon, onClick, title, active = false, disabled = false }: { icon: React.ReactNode, onClick: () => void, title: string, active?: boolean, disabled?: boolean }) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => { e.preventDefault(); if (!disabled) onClick(); }}
      disabled={disabled}
      className={`p-2 rounded-lg transition-all ${disabled ? 'opacity-30 cursor-not-allowed' : active ? 'bg-emerald-50 text-emerald-600 shadow-inner' : 'text-slate-500 hover:text-emerald-600 hover:bg-white'}`}
      title={title}
    >
      {icon}
    </button>
  );
}
