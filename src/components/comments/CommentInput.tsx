'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, X } from 'lucide-react';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';

interface CommentInputProps {
  onSubmit: (content: string) => Promise<void>;
  placeholder?: string;
  initialContent?: string;
  onCancel?: () => void;
  isLoading?: boolean;
  userProfile?: {
    username: string | null;
    avatar_url: string | null;
  } | null;
}

export default function CommentInput({
  onSubmit,
  placeholder,
  initialContent = '',
  onCancel,
  isLoading = false,
  userProfile
}: CommentInputProps) {
  const { language } = useLanguage();
  const [content, setContent] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const defaultPlaceholder = language === 'zh' ? '留下您的評論...' : 'Write a comment...';
  const displayPlaceholder = placeholder || defaultPlaceholder;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isLoading) return;
    
    await onSubmit(content);
    setContent('');
  };

  return (
    <form onSubmit={handleSubmit} className="relative bg-white rounded-3xl border border-slate-200 p-4 shadow-sm transition-all focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
      <div className="flex gap-4 items-start">
        {/* User Avatar */}
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-2 ring-white">
          {userProfile?.avatar_url ? (
            <Image 
              src={userProfile.avatar_url} 
              alt={userProfile.username || 'User'} 
              width={40} 
              height={40}
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-emerald-500 text-white font-bold text-sm">
              {userProfile?.username?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
        </div>

        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={displayPlaceholder}
            rows={1}
            maxLength={1000}
            className="w-full bg-transparent border-none outline-none resize-none py-2 text-slate-700 placeholder:text-slate-400 font-medium"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {content.length} / 1000
            </span>
            
            <div className="flex gap-2">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-colors"
                >
                  {language === 'zh' ? '取消' : 'Cancel'}
                </button>
              )}
              <button
                type="submit"
                disabled={!content.trim() || isLoading}
                className={`
                  flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all
                  ${content.trim() && !isLoading 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:-translate-y-0.5' 
                    : 'bg-slate-100 text-slate-300'}
                `}
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Send className="h-3 w-3" />
                    {language === 'zh' ? '發布' : 'Post'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
