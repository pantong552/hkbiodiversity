'use client';

import { motion } from 'framer-motion';
import { MessageSquare, User, Clock, ChevronRight } from 'lucide-react';
import { LatestComment } from '@/lib/home';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

interface LatestCommentsProps {
  comments: LatestComment[];
}

export default function LatestComments({ comments }: LatestCommentsProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-900/10">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{t('home.community_discussion')}</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">{t('home.community_feed')}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {comments.map((comment, index) => (
          <motion.div
            key={comment.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            viewport={{ once: true }}
            className="p-4 bg-white rounded-2xl border border-slate-200/60 hover:border-slate-900/20 hover:shadow-xl hover:shadow-slate-900/5 transition-all duration-300 group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="shrink-0">
                  {comment.profiles?.avatar_url ? (
                    <img src={comment.profiles.avatar_url} alt={comment.profiles.username} className="w-7 h-7 rounded-lg object-cover ring-2 ring-slate-50" />
                  ) : (
                    <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <span className="text-xs font-black text-slate-700 group-hover:text-slate-900 transition-colors">
                  {comment.profiles?.username || 'Member'}
                </span>
              </div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Clock className="w-3 h-3" /> {new Date(comment.created_at).toLocaleDateString()}
              </span>
            </div>
            
            <p className="text-slate-500 text-sm leading-relaxed mb-4 line-clamp-2 italic px-1 border-l-2 border-slate-100 group-hover:border-slate-900/20 transition-colors">
              "{comment.content}"
            </p>

            <div className="flex items-center justify-between">
              <Link 
                href={`/database?species=${comment.taxa_id}`}
                className="inline-flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors group/link"
              >
                {t('home.go_to_discussion')} <ChevronRight className="w-3 h-3 group-hover/link:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </motion.div>
        ))}
      </div>

      {comments.length === 0 && (
        <div className="py-20 text-center text-slate-400 font-bold text-sm bg-white rounded-2xl border border-slate-200/60 border-dashed">
          {t('home.no_comments')}
        </div>
      )}
    </div>
  );
}
