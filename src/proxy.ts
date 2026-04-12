import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // 攔截：如果 ?code= 出現在非 /auth/callback 路徑上，重導到 callback handler
  // 這是修復 Supabase OAuth 在 Vercel 上回調到 / 而非 /auth/callback 的關鍵
  const url = request.nextUrl.clone()
  const code = url.searchParams.get('code')
  if (code && !url.pathname.startsWith('/auth/callback')) {
    url.pathname = '/auth/callback'
    return NextResponse.redirect(url)
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // 重要：不要在 createServerClient 和 supabase.auth.getUser() 之間執行任何邏輯。
  // 一個簡單的錯誤就可能導致使用者在很難偵測的情況下隨機登出。
  //
  // 重要：不要移除 auth.getUser()
  // 此呼叫會刷新 auth token 並確保 server/client 的 auth state 一致

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * 匹配所有請求路徑，除了以下開頭的：
     * - _next/static (靜態檔案)
     * - _next/image (圖片最佳化檔案)
     * - favicon.ico (瀏覽器圖示)
     * 也排除所有帶有常見靜態副檔名的檔案
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
