import { createBrowserClient } from '@supabase/ssr'

// Singleton：確保整個瀏覽器環境只有一個 Supabase Client 實例
// 避免多個 GoTrueClient 互搶同一個 storage key 的 lock
let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return browserClient
}
