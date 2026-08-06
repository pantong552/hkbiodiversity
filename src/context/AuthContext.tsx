'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { Profile } from '@/types/comments';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X } from 'lucide-react';
import AuthReminderModal from '@/components/ui/AuthReminderModal';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthorized: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  requireAuth: (onSuccess?: () => void, featureName?: string) => boolean;
  openAuthReminder: (featureName?: string) => void;
  closeAuthReminder: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showBlockedModal, setShowBlockedModal] = useState(false);

  // Auth Reminder Modal States
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderFeatureName, setReminderFeatureName] = useState<string | undefined>(undefined);

  const supabase = createClient();

  const fetchProfile = async (userId: string, currentUser?: User | null) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data && currentUser) {
        const { data: newProfile, error: upsertError } = await supabase
          .from('profiles')
          .upsert({
            id: currentUser.id,
            username: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0],
            avatar_url: currentUser.user_metadata?.avatar_url || null,
            role: 'guest',
            status: 'active',
            updated_at: new Date().toISOString(),
            last_online_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (!upsertError) return newProfile;
      }
      return data;
    } catch (err) {
      console.error('Error fetching profile:', err);
      return null;
    }
  };

  const updateLastOnline = async (userId: string) => {
    try {
      await supabase
        .from('profiles')
        .update({ last_online_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (err) {
      console.error('Error updating last online:', err);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setShowBlockedModal(false);
  };

  useEffect(() => {
    let mounted = true;
    let authEventTriggered = false;

    const safetyTimeout = setTimeout(() => {
      if (mounted && !authEventTriggered) {
        setIsLoading(false);
      }
    }, 3500);

    const handleSession = async (session: any) => {
      if (!mounted) return;
      authEventTriggered = true;
      clearTimeout(safetyTimeout);

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const profileData = await fetchProfile(currentUser.id, currentUser);
        
        if (profileData?.status === 'blocked') {
          await supabase.auth.signOut();
          if (mounted) {
            setUser(null);
            setProfile(null);
            setIsLoading(false);
            setShowBlockedModal(true);
          }
          return;
        }

        if (mounted) setProfile(profileData);
        updateLastOnline(currentUser.id);
      } else {
        if (mounted) setProfile(null);
      }
      
      if (mounted) setIsLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      handleSession(session);
    });

    const secondaryCheck = setTimeout(async () => {
      if (mounted && !authEventTriggered) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) handleSession(session);
      }
    }, 500);

    const handleFocus = async () => {
      if (mounted && !user) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) handleSession(sessionData.session);
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      clearTimeout(secondaryCheck);
      window.removeEventListener('focus', handleFocus);
      subscription.unsubscribe();
    };
  }, []);

  // Realtime 封鎖監聽
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile-status-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload: any) => {
          if (payload.new.status === 'blocked') {
            signOut();
            setShowBlockedModal(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id, user);
      setProfile(profileData);
    }
  };

  const isAuthorized = Boolean(user && profile && profile.status === 'active');

  const openAuthReminder = (featureName?: string) => {
    setReminderFeatureName(featureName);
    setShowReminderModal(true);
  };

  const closeAuthReminder = () => {
    setShowReminderModal(false);
    setReminderFeatureName(undefined);
  };

  const requireAuth = (onSuccess?: () => void, featureName?: string): boolean => {
    if (isAuthorized) {
      onSuccess?.();
      return true;
    }
    openAuthReminder(featureName);
    return false;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      isLoading, 
      isAuthorized,
      signOut, 
      refreshProfile,
      requireAuth,
      openAuthReminder,
      closeAuthReminder
    }}>
      {children}

      {/* 權限/登入提醒 Modal */}
      <AuthReminderModal
        isOpen={showReminderModal}
        onClose={closeAuthReminder}
        featureName={reminderFeatureName}
        user={user}
        profile={profile}
      />
      
      {/* 全局封鎖提示 Modal */}
      <AnimatePresence>
        {showBlockedModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl"
              onClick={() => setShowBlockedModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 0 }}
              className="relative w-full max-w-[300px] bg-white/90 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-white overflow-hidden text-center p-6"
            >
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                <ShieldAlert className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-base font-black text-slate-900 tracking-tight mb-2">
                帳號已被封鎖
              </h3>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed px-2">
                您的帳號已被系統封鎖，無法登入或存取數據。如有疑問請聯絡管理員。
              </p>
              <button
                onClick={() => setShowBlockedModal(false)}
                className="w-full py-3 mt-4 text-xs font-black text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all rounded-xl border border-slate-100"
              >
                我知道了
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
