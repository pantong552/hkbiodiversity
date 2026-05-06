'use client';

import { motion } from 'framer-motion';
import { MessageSquare, User, Clock, ArrowUpRight } from 'lucide-react';
import { LatestComment } from '@/lib/home';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

interface LatestCommentsProps {
  comments: LatestComment[];
}

export default function LatestComments({ comments }: LatestCommentsProps) {
  const { t } = useLanguage();

  return (
    <div className="bg-slate-900 rounded-[3rem] p-10 shadow-2xl shadow-slate-900/40 relative overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
      
      <div className="flex items-center gap-4 mb-10 relative z-10">
        <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
          <MessageSquare className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white">{t('home.community_discussion')}</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{t('home.community_feed')}</p>
        </div>
      </div>

      <div className="space-y-6 relative z-10">
        {comments.map((comment, index) => (
          <motion.div
            key={comment.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            viewport={{ once: true }}
            className="p-6 bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 hover:bg-white/10 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {comment.profiles?.avatar_url ? (
                  <img src={comment.profiles.avatar_url} alt={comment.profiles.username} className="w-8 h-8 rounded-full border border-white/20" />
                ) : (
                  <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-slate-400">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <span className="font-bold text-slate-200">{comment.profiles?.username || 'Member'}</span>
              </div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <Clock className="w-3 h-3" /> {new Date(comment.created_at).toLocaleDateString()}
              </span>
            </div>
            
            <p className="text-slate-300 text-sm leading-relaxed mb-4 line-clamp-2 italic">
              "{comment.content}"
            </p>

            <Link 
              href={`/database?species=${comment.taxa_id}`}
              className="inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-400 uppercase tracking-widest hover:text-emerald-300 transition-colors"
            >
              {t('home.go_to_discussion')} <ArrowUpRight className="w-3 h-3" />
            </Link>
          </motion.div>
        ))}
      </div>

      {comments.length === 0 && (
        <div className="py-20 text-center text-slate-500 italic">
          {t('home.no_comments')}
        </div>
      )}
    </div>
  );
}
