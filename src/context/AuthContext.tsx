'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { Profile } from '@/types/comments';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
        // 如果沒有 Profile，嘗試建立一個
        const { data: newProfile, error: upsertError } = await supabase
          .from('profiles')
          .upsert({
            id: currentUser.id,
            username: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0],
            avatar_url: currentUser.user_metadata?.avatar_url || null,
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

  useEffect(() => {
    let mounted = true;
    let authEventTriggered = false;

    // 安全超時：如果在 3.5 秒內沒有收到任何 Auth 事件，強制取消 Loading 狀態
    // 解決某些行動裝置瀏覽器不觸發 initial event 的問題
    const safetyTimeout = setTimeout(() => {
      if (mounted && !authEventTriggered) {
        console.warn('Auth initialization timed out, forcing loading to false (Safety Fallback)');
        setIsLoading(false);
      }
    }, 3500);

    // 處理 Session 恢復
    const handleSession = async (session: any) => {
      if (!mounted) return;
      authEventTriggered = true;
      clearTimeout(safetyTimeout);

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const profileData = await fetchProfile(currentUser.id, currentUser);
        if (mounted) setProfile(profileData);
        
        // 自動更新最後上線時間 (心跳)
        updateLastOnline(currentUser.id);
      } else {
        if (mounted) setProfile(null);
      }
      
      if (mounted) setIsLoading(false);
    };

    // 1. 主要偵測：onAuthStateChange (Supabase v2 應立即觸發 INITIAL_SESSION)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      console.log('Auth Event:', event);
      handleSession(session);
    });

    // 2. 次要偵測 (行動裝置補丁)：有些瀏覽器在跳轉後不會觸發初始事件
    // 我們在 500ms 後主動檢查一次
    const secondaryCheck = setTimeout(async () => {
      if (mounted && !authEventTriggered) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            console.log('Handled session via secondary check');
            handleSession(session);
          }
        } catch (e) {
          console.error('Secondary check failed:', e);
        }
      }
    }, 500);

    // 3. 頁面恢復偵測：當使用者從 OAuth 視窗跳回原 Tab 時刷新
    const handleFocus = async () => {
      if (mounted && !user) {
        // 如果還沒登入，嘗試刷新一下 session
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) handleSession(sessionData.session);
        } catch (e) {
          console.error('Focus session check failed:', e);
        }
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

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id, user);
      setProfile(profileData);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, signOut, refreshProfile }}>
      {children}
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
