'use client';

import { useState } from 'react';
import { Comment, Profile } from '@/types/comments';
import { useLanguage } from '@/context/LanguageContext';
import { ThumbsUp, Reply, MoreHorizontal, Edit2, Trash2, Heart } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhTW, enUS } from 'date-fns/locale';
import Image from 'next/image';
import CommentInput from './CommentInput';

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  onLike: (id: string) => Promise<void>;
  onReply: (parentId: string, content: string) => Promise<void>;
  onEdit: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  userProfile?: Profile | null;
  isReply?: boolean;
}

export default function CommentItem({
  comment,
  currentUserId,
  onLike,
  onReply,
  onEdit,
  onDelete,
  userProfile,
  isReply = false
}: CommentItemProps) {
  const { language } = useLanguage();
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const isOwner = currentUserId === comment.user_id;
  const timeLabel = formatDistanceToNow(new Date(comment.created_at), {
    addSuffix: true,
    locale: language === 'zh' ? zhTW : enUS
  });

  if (comment.is_deleted) {
    return (
      <div className={`py-4 ${isReply ? 'ml-12 border-l-2 border-slate-100 pl-6' : ''}`}>
        <p className="text-slate-400 italic text-sm py-2 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          {language === 'zh' ? '此評論已被作者刪除' : 'This comment has been deleted by the author.'}
        </p>
        
        {/* Render nested replies even if parent is deleted */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-4 space-y-4">
            {comment.replies.map(reply => (
              <CommentItem 
                key={reply.id} 
                comment={reply} 
                currentUserId={currentUserId}
                onLike={onLike}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                userProfile={userProfile}
                isReply={true}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`group py-6 ${isReply ? 'ml-12 border-l-2 border-slate-100 pl-6 pt-2' : ''}`}>
      <div className="flex gap-4">
        {/* Avatar */}
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-2 ring-white shadow-sm">
          {comment.profiles?.avatar_url ? (
            <Image 
              src={comment.profiles.avatar_url} 
              alt={comment.profiles.username || 'User'} 
              width={40} 
              height={40}
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-200 text-slate-500 font-bold text-sm">
              {comment.profiles?.username?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-800 text-sm">{comment.profiles?.username || '神秘生物'}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{timeLabel}</span>
              {isOwner && (
                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[8px] font-black uppercase tracking-widest border border-emerald-100">
                  {language === 'zh' ? '本人' : 'YOU'}
                </span>
              )}
            </div>
            
            {isOwner && !isEditing && (
              <div className="relative">
                <button 
                  onClick={() => setShowActions(!showActions)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {showActions && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-100 rounded-xl shadow-xl shadow-slate-200/50 z-10 w-32 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button 
                      onClick={() => { setIsEditing(true); setShowActions(false); }}
                      className="w-full px-4 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Edit2 className="w-3 h-3" /> {language === 'zh' ? '編輯' : 'Edit'}
                    </button>
                    <button 
                      onClick={() => { onDelete(comment.id); setShowActions(false); }}
                      className="w-full px-4 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                    >
                      <Trash2 className="w-3 h-3" /> {language === 'zh' ? '刪除' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          {isEditing ? (
            <div className="mt-2">
              <CommentInput 
                initialContent={comment.content}
                onSubmit={async (val) => {
                  await onEdit(comment.id, val);
                  setIsEditing(false);
                }}
                onCancel={() => setIsEditing(false)}
                userProfile={userProfile}
              />
            </div>
          ) : (
            <div className="text-slate-700 text-sm leading-relaxed mb-3 whitespace-pre-wrap">
              {comment.content}
            </div>
          )}

          {/* Actions */}
          {!isEditing && (
            <div className="flex items-center gap-6">
              <button 
                onClick={() => currentUserId && onLike(comment.id)}
                disabled={!currentUserId}
                title={!currentUserId ? (language === 'zh' ? '請先登入以按讚' : 'Please log in to like') : ''}
                className={`flex items-center gap-1.5 text-xs font-bold tracking-tight transition-all active:scale-90 
                  ${!currentUserId ? 'opacity-30 cursor-not-allowed' : ''}
                  ${comment.user_has_liked ? 'text-rose-500' : 'text-slate-400 hover:text-rose-400'}`}
              >
                <Heart className={`w-3.5 h-3.5 ${comment.user_has_liked ? 'fill-current' : ''}`} />
                <span>{comment.likes_count || 0}</span>
              </button>
              
              {!isReply && (
                <button 
                  onClick={() => currentUserId && setIsReplying(!isReplying)}
                  disabled={!currentUserId}
                  title={!currentUserId ? (language === 'zh' ? '請先登入以回覆' : 'Please log in to reply') : ''}
                  className={`flex items-center gap-1.5 text-xs font-bold tracking-tight transition-all 
                    ${!currentUserId ? 'opacity-30 cursor-not-allowed' : ''}
                    ${isReplying ? 'text-emerald-600' : 'text-slate-400 hover:text-emerald-500'}`}
                >
                  <Reply className="w-3.5 h-3.5" />
                  <span>{language === 'zh' ? '回覆' : 'Reply'}</span>
                </button>
              )}
            </div>
          )}

          {/* Reply Input */}
          {isReplying && (
            <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <CommentInput 
                placeholder={language === 'zh' ? `回覆 ${comment.profiles?.username || '神秘生物'}...` : `Reply to ${comment.profiles?.username || 'User'}...`}
                onSubmit={async (val) => {
                  await onReply(comment.id, val);
                  setIsReplying(false);
                }}
                onCancel={() => setIsReplying(false)}
                userProfile={userProfile}
              />
            </div>
          )}
        </div>
      </div>

      {/* Nested Replies Rendering */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-4 space-y-2">
          {comment.replies.map(reply => (
            <CommentItem 
              key={reply.id} 
              comment={reply} 
              currentUserId={currentUserId}
              onLike={onLike}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              userProfile={userProfile}
              isReply={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
