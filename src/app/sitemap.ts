import { MetadataRoute } from 'next'
import { supabase } from '@/lib/supabase'

/**
 * 這是 Next.js 內建的 Sitemap 產生器。
 * 修正說明：
 * 1. 使用分頁循環 (Pagination Loop) 抓取資料，以繞過 Supabase 伺服器端的單次回傳筆數限制 (1000 筆)。
 * 2. 依照使用者要求，將物種 URL 格式改為首頁參數模式：/?species=ID
 */

export const revalidate = 86400 // 每 24 小時重新驗證一次

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://hkbiodiversity.org'
  
  const allSpecies: { id: number }[] = []
  let from = 0
  const batchSize = 1000
  let hasMore = true

  // 1. 循環抓取所有物種 ID (分頁處理)
  while (hasMore) {
    const { data, error } = await supabase
      .from('species')
      .select('id')
      .order('id')
      .range(from, from + batchSize - 1)

    if (error) {
      console.error('Sitemap fetch error:', error)
      break
    }

    if (data && data.length > 0) {
      allSpecies.push(...(data as { id: number }[]))
      from += batchSize
      // 如果回傳數量少於 batchSize，表示已經抓完最後一頁
      if (data.length < batchSize) {
        hasMore = false
      }
    } else {
      hasMore = false
    }

    // 安全限制：避免無窮迴圈（最高支援 10 萬筆）
    if (from >= 100000) break
  }

  // 2. 生成物種頁面 Entry (使用 ?species=ID 格式)
  const speciesEntries: MetadataRoute.Sitemap = allSpecies.map((s) => ({
    url: `${baseUrl}/?species=${s.id}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  // 3. 基本固定頁面
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    },
  ]

  return [...staticEntries, ...speciesEntries]
}
