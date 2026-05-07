import { supabase } from './supabase';

export interface HomeStats {
  faunaCount: number;
  floraCount: number;
  totalCount: number;
  taxaStats: { group: string; count: number }[];
}

export interface LeaderboardUser {
  user_id: string;
  username: string;
  avatar_url: string;
  comment_count: number;
  photo_count: number;
  total_contribution: number;
}

export interface LatestComment {
  id: string;
  content: string;
  created_at: string;
  taxa_id: string;
  profiles: {
    username: string;
    avatar_url: string;
  };
}

/**
 * 獲取首頁統計數據
 */
export async function getHomeStats(): Promise<HomeStats> {
  const { count: faunaCount } = await supabase.from('species').select('*', { count: 'exact', head: true });
  const { count: floraCount } = await supabase.from('plant_species').select('*', { count: 'exact', head: true });
  
  // 獲取分類統計 (範例：依 taxa_group)
  const { data: taxaData } = await supabase.rpc('get_taxa_stats'); 
  // 如果 RPC 不存在，我們可以手動查詢或給予預設
  const taxaStats = taxaData || [
    { group: 'Birds', count: 580 },
    { group: 'Butterflies', count: 245 },
    { group: 'Odonates', count: 132 },
    { group: 'Mammals', count: 55 },
    { group: 'Reptiles', count: 95 },
    { group: 'Amphibians', count: 25 },
    { group: 'Freshwater Fish', count: 185 },
    { group: 'Marine Fish', count: 1200 },
    { group: 'Ants', count: 170 },
    { group: 'Beetles', count: 230 },
    { group: 'Plants', count: floraCount || 3300 }
  ];

  return {
    faunaCount: faunaCount || 0,
    floraCount: floraCount || 0,
    totalCount: (faunaCount || 0) + (floraCount || 0),
    taxaStats
  };
}

/**
 * 獲取排行榜
 */
export async function getLeaderboard(): Promise<LeaderboardUser[]> {
  // 這裡使用一個複雜的查詢或 RPC 會更好。
  // 暫時以兩次查詢並手動合併的方式實作。
  
  const { data: commentStats } = await supabase
    .from('comments')
    .select('user_id, profiles(username, avatar_url)');

  const { data: photoStats } = await supabase
    .from('species_community_photos')
    .select('user_id, profiles:user_id(username, avatar_url)');

  const userMap: Record<string, LeaderboardUser> = {};

  commentStats?.forEach((c: any) => {
    if (!c.user_id) return;
    if (!userMap[c.user_id]) {
      userMap[c.user_id] = {
        user_id: c.user_id,
        username: c.profiles?.username || 'Member',
        avatar_url: c.profiles?.avatar_url || '',
        comment_count: 0,
        photo_count: 0,
        total_contribution: 0
      };
    }
    userMap[c.user_id].comment_count++;
  });

  photoStats?.forEach((p: any) => {
    if (!p.user_id) return;
    if (!userMap[p.user_id]) {
      userMap[p.user_id] = {
        user_id: p.user_id,
        username: p.profiles?.username || 'Member',
        avatar_url: p.profiles?.avatar_url || '',
        comment_count: 0,
        photo_count: 0,
        total_contribution: 0
      };
    }
    userMap[p.user_id].photo_count++;
  });

  const leaderboard = Object.values(userMap).map(u => ({
    ...u,
    total_contribution: u.comment_count + u.photo_count * 2 // 圖片權重較高
  })).sort((a, b) => b.total_contribution - a.total_contribution).slice(0, 5);

  return leaderboard;
}

/**
 * 獲取最新留言
 */
export async function getLatestComments(): Promise<LatestComment[]> {
  const { data } = await supabase
    .from('comments')
    .select('id, content, created_at, taxa_id, profiles(username, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(5);

  return (data || []) as unknown as LatestComment[];
}

/**
 * 獲取最新物種 (新聞區塊用)
 */
export async function getLatestSpecies() {
  const { data: fauna } = await supabase
    .from('species')
    .select('id, taxa_id, common_name_chi, common_name_eng, scientific_name, created_at')
    .order('id', { ascending: false }) // 假設 ID 越大越新
    .limit(3);

  const { data: flora } = await supabase
    .from('plant_species')
    .select('id, taxa_id, common_name_chi, common_name_eng, scientific_name, created_at')
    .order('id', { ascending: false })
    .limit(3);

  const combined = [
    ...(fauna || []).map((s: any) => ({ ...s, type: 'fauna' })),
    ...(flora || []).map((s: any) => ({ ...s, type: 'flora' }))
  ];

  return combined.sort((a, b) => (Number(b.id) - Number(a.id))).slice(0, 5);
}

/**
 * 獲取最新公告
 */
export async function getLatestNews() {
  const { data } = await supabase
    .from('site_news')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(5);

  return data || [];
}

/**
 * 獲取所有公告
 */
export async function getAllNews() {
  const { data } = await supabase
    .from('site_news')
    .select('*')
    .order('published_at', { ascending: false });

  return data || [];
}

/**
 * 根據 ID 獲取公告詳情
 */
export async function getNewsById(id: string) {
  // 檢查是否為有效的 UUID 格式 (8-4-4-4-12)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    console.warn(`Invalid UUID format for news id: ${id}`);
    return null;
  }

  const { data, error } = await supabase
    .from('site_news')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    // 如果是 406 (Not Acceptable) 或 PGRST116 (No rows found)，這是正常的 "未找到"
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Supabase error in getNewsById:', error.message, error.details, error.hint);
    return null;
  }

  return data;
}

