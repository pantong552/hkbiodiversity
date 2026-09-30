/**
 * 將 Cloudinary 圖片 URL 轉換為自動格式 (f_auto) 與自動畫質 (q_auto)，在現代瀏覽器下通常為 WebP/AVIF
 * 並轉寫為本地 External Rewrite 路徑 (/cloudinary-img/...)，讓瀏覽器經由反向代理發起請求
 * @param url 原始圖片 URL
 * @param width 可選的圖片寬度
 * @returns 優化並轉寫後的圖片 URL
 */
export function getOptimizedImageUrl(url: string | null | undefined, width?: number): string {
  if (!url) return "";

  let processedUrl = url;

  // 1. 處理 Cloudinary 圖片優化參數
  if (processedUrl.includes("cloudinary.com") || processedUrl.includes("/cloudinary-img/")) {
    if (!processedUrl.includes("/upload/f_auto")) {
      const params = width ? `f_auto,q_auto,w_${width},c_scale` : "f_auto,q_auto";
      processedUrl = processedUrl.replace("/upload/", `/upload/${params}/`);
    } else if (width && !processedUrl.includes(",w_")) {
      processedUrl = processedUrl.replace("/upload/f_auto", `/upload/f_auto,w_${width},c_scale`);
    }

    // 2. 將完整域名轉換為 External Rewrite (反向代理) 路徑
    // 例如 https://res.cloudinary.com/dusun9dtd/... -> /cloudinary-img/dusun9dtd/...
    processedUrl = processedUrl.replace(/^https?:\/\/res\.cloudinary\.com\//, "/cloudinary-img/");
  }

  return processedUrl;
}

