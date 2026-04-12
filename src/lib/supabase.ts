import { createClient } from '@/utils/supabase/client';

// 重新匯出 Singleton 實例，維持向後相容
// 所有 import { supabase } from '@/lib/supabase' 的地方都能繼續運作
export const supabase = createClient();

