'use client';

import { Trophy, MessageSquare, Camera, User, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { LeaderboardUser } from '@/lib/home';
import { useLanguage } from '@/context/LanguageContext';

interface LeaderboardProps {
  users: LeaderboardUser[];
}

export default function Leaderboard({ users }: LeaderboardProps) {
  const { t } = useLanguage();

  return (
    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-2xl shadow-slate-200/50">
      <div className="flex items-center gap-4 mb-10">
        <div className="p-3 bg-amber-500 rounded-2xl text-white shadow-lg shadow-amber-500/20">
          <Trophy className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900">{t('home.leaderboard_title')}</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{t('home.top_contributors')}</p>
        </div>
      </div>

      <div className="space-y-6">
        {users.map((user, index) => (
          <motion.div
            key={user.user_id}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            viewport={{ once: true }}
            className="flex items-center gap-5 p-4 rounded-3xl hover:bg-slate-50 transition-colors group"
          >
            {/* Rank */}
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg ${
              index === 0 ? 'bg-amber-100 text-amber-600' : 
              index === 1 ? 'bg-slate-200 text-slate-500' :
              index === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-50 text-slate-400'
            }`}>
              {index + 1}
            </div>

            {/* Avatar */}
            <div className="relative">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.username} className="w-14 h-14 rounded-2xl object-cover shadow-sm" />
              ) : (
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300">
                  <User className="w-8 h-8" />
                </div>
              )}
              {index === 0 && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                  <Star className="w-3 h-3 text-white fill-white" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <h3 className="font-black text-slate-800 group-hover:text-emerald-700 transition-colors">
                {user.username}
              </h3>
              <div className="flex items-center gap-4 mt-1">
                <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                  <MessageSquare className="w-3 h-3" /> {user.comment_count}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                  <Camera className="w-3 h-3" /> {user.photo_count}
                </span>
              </div>
            </div>

            {/* Score */}
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-0.5">{t('home.score')}</p>
              <p className="text-xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors">{user.total_contribution}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <button className="w-full py-4 mt-8 bg-slate-50 text-slate-500 rounded-2xl font-black hover:bg-slate-100 transition-all border border-slate-100">
        {t('home.view_full_leaderboard')}
      </button>
    </div>
  );
}
