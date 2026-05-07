'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabase';
import { 
  X, Save, Bold, Italic, List, Link as LinkIcon, 
  Heading1, Heading2, Quote, Code, Eye, Edit3, 
  Globe, Languages, ChevronDown, CheckCircle2, AlertCircle,
  Palette, Type, Undo, Redo 
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import rehypeExternalLinks from 'rehype-external-links';
import { motion, AnimatePresence } from 'framer-motion';
import { HexColorPicker } from "react-colorful";
import CustomDropdown from '@/components/ui/CustomDropdown';

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
  const [formData, setFormData] = useState<NewsItem>({
    category: 'Notice',
    title_chi: '',
    title_eng: '',
    content_chi: '',
    content_eng: '',
    ...news
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
    const textarea = document.getElementById(activeTab === 'chi' ? 'content_chi' : 'content_eng') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    let insertion = '';

    const [action, value] = type.split(':');
    switch (action) {
      case 'bold': insertion = `**${selectedText || '粗體文字'}**`; break;
      case 'italic': insertion = `*${selectedText || '斜體文字'}*`; break;
      case 'h1': insertion = `# ${selectedText || '標題 1'}\n`; break;
      case 'h2': insertion = `## ${selectedText || '標題 2'}\n`; break;
      case 'list': insertion = `- ${selectedText || '清單項目'}\n`; break;
      case 'quote': insertion = `\n> ${selectedText || '引用文字'}\n`; break;
      case 'code': insertion = `\n\`\`\`\n${selectedText || '程式碼'}\n\`\`\`\n`; break;
      case 'link': insertion = `[${selectedText || '連結文字'}](https://)`; break;
      case 'color': insertion = `<span style="color: ${value || '#679758'}">${selectedText || '有色文字'}</span>`; break;
      case 'size': insertion = `<span style="font-size: ${value || '1.25rem'}">${selectedText || '大號文字'}</span>`; break;
    }

    const newValue = text.substring(0, start) + insertion + text.substring(end);
    const newData = { ...formData, [activeTab === 'chi' ? 'content_chi' : 'content_eng']: newValue };
    setFormData(newData);
    addToHistory(newData);
    
    // Reset focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 0);
  };

  const handleSave = async () => {
    if (!formData.title_chi || !formData.title_eng) {
      alert(language === 'zh' ? '請填寫標題' : 'Please fill in titles');
      return;
    }

    setIsSaving(true);
    try {
      // 移除 undefined 的欄位 (特別是 id)
      const payload: any = { ...formData };
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
            <button 
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${showPreview ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              <Eye size={14} />
              {language === 'zh' ? '預覽' : 'Preview'}
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 relative bg-white">
            <textarea
              id={activeTab === 'chi' ? 'content_chi' : 'content_eng'}
              value={activeTab === 'chi' ? formData.content_chi : formData.content_eng}
              onChange={(e) => handleInputChange(activeTab === 'chi' ? 'content_chi' : 'content_eng', e.target.value)}
              placeholder={activeTab === 'chi' ? '開始輸入中文公告內容 (Markdown 格式)...' : 'Start typing English content (Markdown format)...'}
              className="w-full h-full p-6 text-slate-700 font-medium resize-none border-none focus:ring-0 leading-relaxed text-base"
            />
          </div>
        </div>

        {/* Preview Area (Desktop side-by-side or overlay) */}
        <AnimatePresence>
          {showPreview && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 bg-slate-50/80 overflow-y-auto p-8 news-preview border-l border-emerald-100/50"
            >
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-2 mb-6">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded uppercase tracking-widest">
                    {language === 'zh' ? '即時預覽' : 'Live Preview'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {activeTab === 'chi' ? '繁體中文' : 'English'}
                  </span>
                </div>
                <h1 className="text-3xl font-black text-slate-900 mb-8">
                  {activeTab === 'chi' ? formData.title_chi : formData.title_eng}
                </h1>
                <div className="prose prose-slate max-w-none news-content">
                  <ReactMarkdown 
                    rehypePlugins={[
                      rehypeRaw,
                      [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }]
                    ]}
                    remarkPlugins={[remarkBreaks]}
                  >
                    {(activeTab === 'chi' ? formData.content_chi : formData.content_eng).replace(/\\n/g, '\n')}
                  </ReactMarkdown>
                </div>
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
            onClick={onClose}
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
        .news-preview .news-content blockquote {
          border-left: 4px solid #10b981; padding: 0.75rem 1.25rem; background: #f8fafc; border-radius: 0 0.75rem 0.75rem 0; margin: 1.5rem 0;
        }
        .news-preview .news-content ul { list-style-type: disc; padding-left: 1.25rem; margin-bottom: 1.25rem; }
        
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
