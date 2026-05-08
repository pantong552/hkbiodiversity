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
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  UserX,
  UserCheck,
  Calendar
} from 'lucide-react';
import { motion } from 'framer-motion';
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
      alert(t('account.save_error'));
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
        alert(t('account.save_error'));
      } finally {
        setActionLoading(null);
      }
    });
  };

  const filteredProfiles = profiles.filter(p => 
    (p.username?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (p.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (p.inaturalist_username?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'yyyy-MM-dd HH:mm', { 
        locale: language === 'zh' ? zhTW : enUS 
      });
    } catch {
      return dateStr;
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <span className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-black uppercase ring-1 ring-red-100"><ShieldCheck className="w-3 h-3" /> {t('account.role_admin')}</span>;
      case 'curator':
        return <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase ring-1 ring-amber-100"><Shield className="w-3 h-3" /> {t('account.role_curator')}</span>;
      default:
        return <span className="flex items-center gap-1 px-2 py-1 bg-slate-50 text-slate-500 rounded-lg text-[10px] font-black uppercase ring-1 ring-slate-100"><UserCircle className="w-3 h-3" /> {t('account.role_guest')}</span>;
    }
  };

  const getStatusBadge = (status: UserStatus) => {
    if (status === 'blocked') {
      return <span className="px-2 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase ring-1 ring-slate-800">{t('admin.status_blocked')}</span>;
    }
    return <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase ring-1 ring-emerald-100">{t('admin.status_active')}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="relative group max-w-md">
        <div className="absolute inset-0 bg-emerald-500/5 blur-xl rounded-2xl transition-all group-focus-within:bg-emerald-500/10" />
        <div className="relative flex items-center bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-2xl px-4 py-2.5 transition-all focus-within:border-emerald-400 focus-within:shadow-lg focus-within:shadow-emerald-500/5">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <input 
            type="text" 
            placeholder={t('admin.search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-slate-700 text-sm font-medium placeholder:text-slate-400"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
          <p className="text-slate-500 font-medium">{t('loading.message')}</p>
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="text-center py-20 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
          <p className="text-slate-400 font-medium">{t('admin.no_users')}</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto rounded-3xl border border-slate-200/60 bg-white/50 backdrop-blur-md shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-bottom border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('account.username')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('account.email')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('admin.joined_at')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('admin.last_online')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('admin.role')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProfiles.map((profile) => (
                  <motion.tr 
                    key={profile.id}
                    layout
                    className={`hover:bg-emerald-50/30 transition-colors group ${profile.status === 'blocked' ? 'opacity-60 grayscale' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-full overflow-hidden border border-slate-200 bg-slate-100 flex-shrink-0">
                          {profile.avatar_url && !imageErrors[profile.id] ? (
                            <img 
                              src={profile.avatar_url} 
                              alt="" 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                              onError={() => setImageErrors(prev => ({ ...prev, [profile.id]: true }))}
                            />
                          ) : (
                            <User className="w-full h-full p-2 text-slate-400" />
                          )}
                        </div>
                        <span className="font-bold text-slate-700 truncate max-w-[150px]">{profile.username || 'Anonymous'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-slate-500 truncate block max-w-[200px]">{profile.email || '-'}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-500 whitespace-nowrap">
                      {formatDate(profile.created_at)}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-500 whitespace-nowrap">
                      {formatDate(profile.last_online_at)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative inline-block">
                        <select 
                          value={profile.role}
                          onChange={(e) => handleRoleChange(profile.id, e.target.value as UserRole)}
                          disabled={actionLoading === profile.id || profile.status === 'blocked'}
                          className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <option value="guest">{t('account.role_guest')}</option>
                          <option value="curator">{t('account.role_curator')}</option>
                          <option value="admin">{t('account.role_admin')}</option>
                        </select>
                        {getRoleBadge(profile.role)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(profile.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleStatusToggle(profile.id, profile.status)}
                        disabled={actionLoading === profile.id}
                        title={profile.status === 'active' ? 'Block User' : 'Unblock User'}
                        className={`p-2 rounded-xl transition-all ${
                          profile.status === 'active' 
                            ? 'text-slate-300 hover:text-red-500 hover:bg-red-50' 
                            : 'text-emerald-500 bg-emerald-50 hover:bg-emerald-100'
                        }`}
                      >
                        {actionLoading === profile.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : profile.status === 'active' ? (
                          <UserX className="w-4 h-4" />
                        ) : (
                          <UserCheck className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            {filteredProfiles.map((profile) => (
              <motion.div 
                key={profile.id}
                layout
                className={`p-5 bg-white rounded-3xl border border-slate-200/60 shadow-sm space-y-4 ${profile.status === 'blocked' ? 'opacity-70 grayscale' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-200 bg-slate-100">
                      {profile.avatar_url && !imageErrors[profile.id] ? (
                        <img 
                          src={profile.avatar_url} 
                          alt="" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                          onError={() => setImageErrors(prev => ({ ...prev, [profile.id]: true }))}
                        />
                      ) : (
                        <User className="w-full h-full p-2 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 leading-tight">{profile.username || 'Anonymous'}</h4>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{profile.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(profile.status)}
                    <button 
                      onClick={() => handleStatusToggle(profile.id, profile.status)}
                      className={`p-3 rounded-2xl ${
                        profile.status === 'active' ? 'text-red-500 bg-red-50' : 'text-emerald-500 bg-emerald-50'
                      }`}
                    >
                      {profile.status === 'active' ? <UserX className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('admin.joined_at')}</p>
                    <p className="text-xs font-bold text-slate-700">
                      {formatDate(profile.created_at)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('admin.role')}</p>
                    {getRoleBadge(profile.role)}
                  </div>
                  <div className="space-y-1 col-span-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('admin.last_online')}</p>
                    <p className="text-xs font-bold text-slate-700">
                      {formatDate(profile.last_online_at)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
