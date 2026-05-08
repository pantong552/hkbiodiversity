'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { Profile, UserRole, UserStatus } from '@/types/comments';
import { 
  User, 
  Search, 
  ShieldCheck, 
  Shield, 
  UserCircle,
  Loader2,
  UserX,
  UserCheck,
  Clock,
  Mail,
  ChevronDown,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { zhTW, enUS } from 'date-fns/locale';

interface UsersManagerProps {
  onRequestConfirm: (onConfirm: () => void) => void;
}

export default function UsersManager({ onRequestConfirm }: UsersManagerProps) {
  const { language, t } = useLanguage();
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (err) {
      console.error('Error fetching profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;
      setProfiles(profiles.map(p => p.id === userId ? { ...p, role: newRole } : p));
    } catch (err) {
      console.error('Error updating role:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusToggle = (userId: string, currentStatus: UserStatus) => {
    const nextStatus: UserStatus = currentStatus === 'active' ? 'blocked' : 'active';
    onRequestConfirm(async () => {
      setActionLoading(userId);
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ status: nextStatus })
          .eq('id', userId);

        if (error) throw error;
        setProfiles(profiles.map(p => p.id === userId ? { ...p, status: nextStatus } : p));
      } catch (err) {
        console.error('Error toggling status:', err);
      } finally {
        setActionLoading(null);
      }
    });
  };

  const filteredProfiles = profiles.filter(p => 
    (p.username?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (p.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'yy/MM/dd HH:mm', { 
        locale: language === 'zh' ? zhTW : enUS 
      });
    } catch {
      return dateStr;
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <span className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-black uppercase ring-1 ring-red-100"><ShieldCheck className="w-2.5 h-2.5" /> {t('account.role_admin')}</span>;
      case 'curator':
        return <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase ring-1 ring-amber-100"><Shield className="w-2.5 h-2.5" /> {t('account.role_curator')}</span>;
      default:
        return <span className="flex items-center gap-1 px-2 py-1 bg-slate-50 text-slate-500 rounded-lg text-[10px] font-black uppercase ring-1 ring-slate-100"><UserCircle className="w-2.5 h-2.5" /> {t('account.role_guest')}</span>;
    }
  };

  const getStatusBadge = (status: UserStatus) => {
    if (status === 'blocked') {
      return <span className="px-1.5 py-0.5 bg-slate-900 text-white rounded-md text-[9px] font-black tracking-wider shadow-sm">{t('admin.status_blocked')}</span>;
    }
    return <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-md text-[9px] font-black tracking-wider ring-1 ring-emerald-100/50">{t('admin.status_active')}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="relative group max-w-md mx-auto md:mx-0">
        <div className="absolute inset-0 bg-emerald-500/5 blur-xl rounded-2xl transition-all group-focus-within:bg-emerald-500/10" />
        <div className="relative flex items-center bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl px-4 py-2 transition-all focus-within:border-emerald-400">
          <Search className="w-4 h-4 text-slate-400 mr-2" />
          <input 
            type="text" 
            placeholder={t('admin.search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-slate-700 text-xs font-medium placeholder:text-slate-400"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
          <p className="text-slate-400 text-xs font-medium">{t('loading.message')}</p>
        </div>
      ) : (
        <>
          {/* Desktop View */}
          <div className="hidden lg:block overflow-x-auto rounded-[2rem] border border-white bg-white/30 backdrop-blur-xl shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-bottom border-slate-100">
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('account.username')}</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('account.email')}</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('admin.joined_at')}</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('admin.last_online')}</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('admin.role')}</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProfiles.map((profile) => (
                  <tr key={profile.id} className={`hover:bg-white/60 transition-colors ${profile.status === 'blocked' ? 'opacity-50 grayscale' : ''}`}>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 bg-slate-50">
                          {profile.avatar_url && !imageErrors[profile.id] ? (
                            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" onError={() => setImageErrors(prev => ({ ...prev, [profile.id]: true }))}/>
                          ) : (
                            <User className="w-full h-full p-2 text-slate-300" />
                          )}
                        </div>
                        <span className="font-bold text-slate-700 text-sm">{profile.username || 'Anonymous'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-500">{profile.email}</td>
                    <td className="px-6 py-3 text-xs text-slate-500 font-medium">{formatDate(profile.created_at)}</td>
                    <td className="px-6 py-3 text-xs text-slate-400">{formatDate(profile.last_online_at)}</td>
                    <td className="px-6 py-3">
                      <div className="relative inline-block">
                        <select value={profile.role} onChange={(e) => handleRoleChange(profile.id, e.target.value as UserRole)} className="absolute inset-0 opacity-0 cursor-pointer">
                          <option value="guest">Guest</option>
                          <option value="curator">Curator</option>
                          <option value="admin">Admin</option>
                        </select>
                        {getRoleBadge(profile.role)}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-center">{getStatusBadge(profile.status)}</td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => handleStatusToggle(profile.id, profile.status)} className={`p-1.5 rounded-lg transition-all ${profile.status === 'active' ? 'text-slate-300 hover:text-red-500' : 'text-emerald-500'}`}>
                        {profile.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Optimized Mobile Accordion View - Tight Version */}
          <div className="lg:hidden space-y-2.5">
            {filteredProfiles.map((profile) => (
              <motion.div 
                key={profile.id}
                layout
                initial={false}
                className={`overflow-hidden bg-white/60 backdrop-blur-xl rounded-[1.5rem] border border-white transition-all duration-300 ${
                  expandedUserId === profile.id ? 'shadow-lg ring-1 ring-emerald-500/10 bg-white/80' : 'shadow-sm'
                } ${profile.status === 'blocked' ? 'opacity-70 grayscale' : ''}`}
              >
                {/* Accordion Header */}
                <div 
                  onClick={() => setExpandedUserId(expandedUserId === profile.id ? null : profile.id)}
                  className="p-3 flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl overflow-hidden border border-slate-100 bg-slate-50 shrink-0 shadow-inner">
                      {profile.avatar_url && !imageErrors[profile.id] ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" onError={() => setImageErrors(prev => ({ ...prev, [profile.id]: true }))}/>
                      ) : (
                        <User className="w-full h-full p-2 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-slate-800 text-sm truncate leading-tight group-hover:text-emerald-600 transition-colors">
                        {profile.username || 'Anonymous'}
                      </h4>
                      <div className="flex items-center gap-1.5 text-slate-400 mt-0.5">
                        <Mail className="w-2.5 h-2.5 shrink-0" />
                        <p className="text-[10px] font-medium truncate">{profile.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {expandedUserId !== profile.id && getStatusBadge(profile.status)}
                    <motion.div
                      animate={{ rotate: expandedUserId === profile.id ? 180 : 0 }}
                      className="p-1 rounded-full text-slate-300"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </motion.div>
                  </div>
                </div>

                {/* Accordion Content - Tighter Inline Layout */}
                <AnimatePresence>
                  {expandedUserId === profile.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-100/50"
                    >
                      <div className="p-3 space-y-3 bg-slate-50/20">
                        {/* Row 1: Time info in one row */}
                        <div className="flex items-center justify-between text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-slate-300" />
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Joined</span>
                            <span className="text-xs font-bold text-slate-600 ml-1">{formatDate(profile.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <History className="w-3 h-3 text-slate-300" />
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Active</span>
                            <span className="text-[10px] font-medium text-slate-400 italic ml-1">{formatDate(profile.last_online_at)}</span>
                          </div>
                        </div>

                        {/* Row 2: Roles, Status and Action in one row */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100/50">
                          <div className="flex items-center gap-3">
                            <div className="relative inline-block">
                              <select 
                                value={profile.role} 
                                onChange={(e) => handleRoleChange(profile.id, e.target.value as UserRole)}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                              >
                                <option value="guest">Guest</option>
                                <option value="curator">Curator</option>
                                <option value="admin">Admin</option>
                              </select>
                              {getRoleBadge(profile.role)}
                            </div>
                            {getStatusBadge(profile.status)}
                          </div>
                          
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusToggle(profile.id, profile.status);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${
                              profile.status === 'active' 
                                ? 'bg-red-50 text-red-500 border border-red-100 hover:bg-red-100' 
                                : 'bg-emerald-50 text-emerald-500 border border-emerald-100 hover:bg-emerald-100'
                            }`}
                          >
                            {profile.status === 'active' ? (
                              <><UserX className="w-3.5 h-3.5" /> {language === 'zh' ? '封鎖' : 'Block'}</>
                            ) : (
                              <><UserCheck className="w-3.5 h-3.5" /> {language === 'zh' ? '解鎖' : 'Unblock'}</>
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
