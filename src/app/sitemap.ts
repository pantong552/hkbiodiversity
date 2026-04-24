import { MetadataRoute } from 'next'

/**
 * 這是 Next.js 內建的 Sitemap 產生器。
 * 依照要求：移除所有 species page 相關的 URL。
 */

export const revalidate = 86400 // 每 24 小時重新驗證一次

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://hkbiodiversity.org'
  
  // 基本固定頁面
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

  return [...staticEntries]
}
