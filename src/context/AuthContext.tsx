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
            updated_at: new Date().toISOString()
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

  useEffect(() => {
    // Supabase v2 的 onAuthStateChange 會在訂閱時立即觸發一次 INITIAL_SESSION 事件
    // 這樣就不需要額外呼叫 getSession()，從而減少 Auth Lock 競爭
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const profileData = await fetchProfile(currentUser.id, currentUser);
        setProfile(profileData);
      } else {
        setProfile(null);
      }
      
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, signOut }}>
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
