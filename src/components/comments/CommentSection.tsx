'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Comment } from '@/types/comments';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { MessageSquare, LogIn, Loader2, AlertCircle } from 'lucide-react';
import CommentInput from './CommentInput';
import CommentItem from './CommentItem';

interface CommentSectionProps {
  inatId: number;
}

export default function CommentSection({ inatId }: CommentSectionProps) {
  const { language, t } = useLanguage();
  const { user, profile: userProfile } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Fetch Comments
  const fetchComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles (
            username,
            avatar_url
          ),
          comment_likes (
            user_id
          )
        `)
        .eq('inat_id', inatId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch comments details:', error);
        throw error;
      }

      if (data) {
        const userId = user?.id;
        const formatted = data.map((c: any) => ({
          ...c,
          likes_count: c.comment_likes?.length || 0,
          user_has_liked: c.comment_likes?.some((l: any) => l.user_id === userId)
        }));

        const mainComments = formatted.filter((c: any) => !c.parent_id);
        const replies = formatted.filter((c: any) => c.parent_id);

        const structured = mainComments.map((main: any) => ({
          ...main,
          replies: replies.filter((r: any) => r.parent_id === main.id).reverse()
        }));

        setComments(structured);
      }
    } catch (err) {
      console.error('Failed to format or fetch comments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [inatId, user?.id, supabase]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // 3. Actions
  const handlePostComment = async (content: string, parentId: string | null = null) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          content,
          inat_id: inatId,
          user_id: user.id,
          parent_id: parentId
        });

      if (error) {
        console.error('Post comment details:', error);
        alert(`發布失敗: ${error.message || '未知錯誤'}`);
        throw error;
      }
      await fetchComments();
    } catch (err) {
      console.error('Post comment catch block:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (commentId: string) => {
    if (!user) return;
    try {
      // 檢查是否已點讚
      const { data: existingLike } = await supabase
        .from('comment_likes')
        .select('*')
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingLike) {
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('comment_likes')
          .insert({ comment_id: commentId, user_id: user.id });
      }
      await fetchComments();
    } catch (err) {
      console.error('Like action failed:', err);
    }
  };

  const handleEdit = async (commentId: string, content: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .update({ content })
        .eq('id', commentId);
      
      if (error) throw error;
      await fetchComments();
    } catch (err) {
      console.error('Edit comment failed:', err);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm(language === 'zh' ? '確定要刪除此評論嗎？' : 'Are you sure you want to delete this comment?')) return;
    try {
      // 採取 (B) 策略：標記為已刪除
      const { error } = await supabase
        .from('comments')
        .update({ is_deleted: true, content: 'DELETED' })
        .eq('id', commentId);
      
      if (error) throw error;
      await fetchComments();
    } catch (err) {
      console.error('Delete comment failed:', err);
    }
  };

  return (
    <div id="comment-section" className="mt-20 pt-20 border-t border-slate-100">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-2xl">
              <MessageSquare className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800">
                {language === 'zh' ? '社群討論' : 'Community Discussion'}
              </h2>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
                {comments.length} {language === 'zh' ? '條評論' : 'Comments'}
              </p>
            </div>
          </div>
        </div>

        {/* Post Input */}
        {user ? (
          <div className="mb-12">
            <CommentInput 
              onSubmit={(val) => handlePostComment(val)} 
              isLoading={isSubmitting}
              userProfile={userProfile}
            />
          </div>
        ) : (
          <div className="mb-12 p-8 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200 flex flex-col items-center text-center">
            <LogIn className="w-10 h-10 text-slate-300 mb-4" />
            <h3 className="text-lg font-black text-slate-700 mb-2">
              {language === 'zh' ? '加入討論' : 'Join the discussion'}
            </h3>
            <p className="text-slate-400 text-sm mb-6 max-w-xs">
              {language === 'zh' ? '登入後即可發表評論、回覆他人以及為喜歡的內容點讚。' : 'Log in to post comments, reply to others, and like content.'}
            </p>
            {/* Note: This assumes a Header or Auth modal handles login */}
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">
              Please use the login button in the header
            </p>
          </div>
        )}

        {/* Comments List */}
        {isLoading ? (
          <div className="flex flex-col items-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
              {language === 'zh' ? '載入評論中...' : 'Loading comments...'}
            </span>
          </div>
        ) : comments.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
            <AlertCircle className="w-12 h-12 text-slate-200 mb-4" />
            <p className="text-slate-400 font-medium italic">
              {language === 'zh' ? '目前尚無評論，快來搶沙發！' : 'No comments yet. Be the first to start the conversation!'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {comments.map(comment => (
              <CommentItem 
                key={comment.id}
                comment={comment}
                currentUserId={user?.id}
                onLike={handleLike}
                onReply={(parentId, val) => handlePostComment(val, parentId)}
                onEdit={handleEdit}
                onDelete={handleDelete}
                userProfile={userProfile}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
