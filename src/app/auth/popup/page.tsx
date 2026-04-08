'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function PopupPage() {
  const [message, setMessage] = useState('Google 登入中...')
  const [isProcessing, setIsProcessing] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const handleOAuth = async () => {
      // 防止重複執行
      if (isProcessing) return
      setIsProcessing(true)

      try {
        const { searchParams } = new URL(window.location.href)
        const status = searchParams.get('status')
        const error = searchParams.get('error')

        // 1. 如果有錯誤參數
        if (error) {
          console.error('OAuth error:', error)
          if (window.opener) {
            try {
              window.opener.postMessage(
                { type: 'auth:error', error: error || 'Authentication failed' },
                '*'
              )
            } catch (e) {
              console.error('postMessage error:', e)
            }
          }
          setMessage(`錯誤: ${error}`)
          setTimeout(() => window.close(), 2000)
          return
        }

        // 2. 如果狀態為成功（Server 已經處理完 Code Exchange）
        if (status === 'success') {
          setMessage('登入成功！')
          
          if (window.opener) {
            try {
              // 在生產環境中，Origin 可能因為 www 或 Vercel 預覽網址微小差異而不匹配
              // 這裡使用 '*' 是安全的，因為我們只發送一個不含敏感資訊的成功信號
              window.opener.postMessage({ type: 'auth:success' }, '*')
            } catch (e) {
              console.error('postMessage error:', e)
            }
          } else {
            console.warn('找不到父視窗 (window.opener)')
            localStorage.setItem('supabase-auth-status', 'success')
          }

          // 立即嘗試關閉，並設一個備案
          setTimeout(() => {
            window.close()
          }, 500)
          
          // 如果 2 秒後還沒關閉（例如被瀏覽器阻擋），至少訊息已經發出去了
          return
        }

        // 3. 如果既沒有 status 也沒有 error，表示是剛開啟 Popup，準備開始 OAuth 流程
        setMessage('正在重定向到 Google...')
        const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/popup/callback`,
            skipBrowserRedirect: true,
          },
        })

        if (oauthError) {
          throw oauthError
        }

        // 重定向到 OAuth provider
        if (data?.url) {
          window.location.href = data.url
        }
      } catch (error: any) {
        console.error('OAuth error:', error)
        if (window.opener) {
          window.opener.postMessage(
            { type: 'auth:error', error: error.message || 'OAuth flow failed' },
            window.location.origin
          )
        }
        setMessage(`發生錯誤: ${error.message}`)
        setTimeout(() => window.close(), 2000)
      }
    }

    handleOAuth()
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900">
      <div className="text-center">
        <div className="inline-flex items-center justify-center mb-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
        </div>
        <p className="text-white text-lg font-medium">{message}</p>
        <p className="text-slate-400 text-sm mt-2">成功後將自動關閉此視窗</p>
      </div>
    </div>
  )
}
