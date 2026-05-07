'use client';

import { Trophy, MessageSquare, Camera, User, Star, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { LeaderboardUser } from '@/lib/home';
import { useLanguage } from '@/context/LanguageContext';

interface LeaderboardProps {
  users: LeaderboardUser[];
}

export default function Leaderboard({ users }: LeaderboardProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-600/10">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{t('home.leaderboard_title')}</h2>
            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.2em] mt-0.5">{t('home.top_contributors')}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {users.map((user, index) => (
          <motion.div
            key={user.user_id}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            viewport={{ once: true }}
            className="flex items-center gap-4 p-3 bg-white rounded-2xl border border-slate-200/60 hover:border-amber-500/30 hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300 group"
          >
            {/* Rank */}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
              index === 0 ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 
              index === 1 ? 'bg-slate-200 text-slate-600' :
              index === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-50 text-slate-400'
            }`}>
              {index + 1}
            </div>

            {/* Avatar */}
            <div className="relative shrink-0">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.username} className="w-11 h-11 rounded-xl object-cover shadow-sm ring-2 ring-slate-50" />
              ) : (
                <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center text-slate-300">
                  <User className="w-6 h-6" />
                </div>
              )}
              {index === 0 && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                  <Star className="w-2.5 h-2.5 text-white fill-white" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-black text-slate-800 group-hover:text-amber-700 transition-colors truncate">
                {user.username}
              </h3>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                  <MessageSquare className="w-3 h-3" /> {user.comment_count}
                </span>
                <span className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                  <Camera className="w-3 h-3" /> {user.photo_count}
                </span>
              </div>
            </div>

            {/* Score */}
            <div className="text-right shrink-0">
              <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">{t('home.score')}</p>
              <p className="text-base font-black text-slate-900 group-hover:text-amber-600 transition-colors leading-none">{user.total_contribution}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <button className="w-full flex items-center justify-center gap-2 py-3.5 mt-8 bg-slate-50 text-slate-500 rounded-2xl text-xs font-black hover:bg-slate-900 hover:text-white transition-all border border-slate-200/60 uppercase tracking-widest group">
        {t('home.view_full_leaderboard')} <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
}
