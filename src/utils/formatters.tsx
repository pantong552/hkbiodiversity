import React from 'react';

/**
 * 格式化生物學名，確保學名部分根據需要斜體/粗體，而作者、年份、縮寫保持正體/常規。
 * @param scientificName 原始學名字符串
 * @param forceItalic 是否強制將學名部分斜體 (通常屬及以下階層需要)
 * @param boldName 是否將學名部分加粗 (作者不加粗)
 * @returns 包含 React 元素的陣列
 */
export function formatScientificName(
  scientificName: string | undefined, 
  forceItalic: boolean = true,
  boldName: boolean = false
): React.ReactNode {
  if (!scientificName) return null;

  // 分類縮寫列表
  const abbreviations = [
    'subsp.', 'ssp.', 'var.', 'f.', 'cv.', 'cf.', 'aff.', 'sp. nov.', 'comb. nov.', 'sp.', 'spp.'
  ];

  // 將字串拆分為單詞與符號
  const parts = scientificName.split(/(\s+|\(|\)|,)/g);
  
  let entityCount = 0;
  const maxEntities = 3; // 屬名、種小名、亞種小名 最多三個學名單詞

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null;

        const trimmed = part.trim();
        if (!trimmed) return <span key={index}>{part}</span>;

        // 符號、縮寫、年份 均保持 Normal/Sans
        const isSymbol = /^[\(\),]$/.test(trimmed);
        const isAbbr = abbreviations.includes(trimmed.toLowerCase());
        const isYear = /^\d{4}$/.test(trimmed);
        const isCapitalized = /^[A-Z]/.test(trimmed);

        if (isSymbol || isAbbr || isYear) {
          return <span key={index} className="not-italic font-sans font-normal">{part}</span>;
        }

        // 判斷是否為學名部分 (Entity)
        // 1. 第一個單詞
        // 2. 之後的小寫單詞（最多到第 3 個）
        let isEntity = false;
        if (entityCount === 0) {
          isEntity = true;
          entityCount++;
        } else if (entityCount < maxEntities && !isCapitalized) {
          isEntity = true;
          entityCount++;
        }

        if (isEntity) {
          return (
            <span key={index} className={`${forceItalic ? 'italic' : 'not-italic'} ${boldName ? 'font-bold' : 'font-medium'}`}>
              {part}
            </span>
          );
        }

        // 否則為作者資訊
        return <span key={index} className="not-italic font-sans font-normal ml-1">{part}</span>;
      })}
    </>
  );
}

/**
 * 關鍵字高亮與學名格式化渲染組件
 * 當 isScientific 為 true 時，自動調用與 formatScientificName 相同的邏輯（屬及物種階層斜體，縮寫/符號/年份/作者正體）
 */
export function HighlightText({ 
  text, 
  query, 
  isSelected, 
  isScientific = false,
  className = ''
}: { 
  text: string | undefined | null; 
  query: string; 
  isSelected?: boolean; 
  isScientific?: boolean;
  className?: string;
}) {
  if (!text) return null;

  const highlightClass = isSelected 
    ? "text-yellow-300 font-extrabold bg-white/20 px-0.5 rounded" 
    : "text-emerald-600 font-extrabold bg-emerald-500/10 px-0.5 rounded";

  const renderPartWithHighlight = (partText: string, isItalic: boolean) => {
    if (!query) {
      return (
        <span className={isItalic ? 'italic' : 'not-italic font-sans font-normal'}>
          {partText}
        </span>
      );
    }

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const subParts = partText.split(regex);

    return (
      <span className={isItalic ? 'italic' : 'not-italic font-sans font-normal'}>
        {subParts.map((sub, i) =>
          regex.test(sub) ? (
            <span key={i} className={highlightClass}>
              {sub}
            </span>
          ) : (
            <span key={i}>{sub}</span>
          )
        )}
      </span>
    );
  };

  if (!isScientific) {
    if (!query) return <span className={className}>{text}</span>;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
      <span className={className}>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <span key={i} className={highlightClass}>
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  }

  // 依據 formatScientificName 的指引格式化學名
  const abbreviations = [
    'subsp.', 'ssp.', 'var.', 'f.', 'cv.', 'cf.', 'aff.', 'sp. nov.', 'comb. nov.', 'sp.', 'spp.'
  ];
  const tokens = text.split(/(\s+|\(|\)|,)/g);
  let entityCount = 0;
  const maxEntities = 3;

  return (
    <span className={className}>
      {tokens.map((token, index) => {
        if (!token) return null;
        const trimmed = token.trim();
        if (!trimmed) {
          return <span key={index}>{token}</span>;
        }

        const isSymbol = /^[\(\),]$/.test(trimmed);
        const isAbbr = abbreviations.includes(trimmed.toLowerCase());
        const isYear = /^\d{4}$/.test(trimmed);
        const isCapitalized = /^[A-Z]/.test(trimmed);

        if (isSymbol || isAbbr || isYear) {
          return <React.Fragment key={index}>{renderPartWithHighlight(token, false)}</React.Fragment>;
        }

        let isEntity = false;
        if (entityCount === 0) {
          isEntity = true;
          entityCount++;
        } else if (entityCount < maxEntities && !isCapitalized) {
          isEntity = true;
          entityCount++;
        }

        return (
          <React.Fragment key={index}>
            {renderPartWithHighlight(token, isEntity)}
          </React.Fragment>
        );
      })}
    </span>
  );
}

/**
 * 格式化原生狀態，根據語言環境將英文狀態轉換為中文。
 * @param status 原始狀態字串 (如 Native, Exotic, Reintroduced, Introduced)
 * @param language 當前語言 ('zh' | 'en')
 * @returns 格式化後的狀態字串
 */
export function formatNativeStatus(status: string | undefined | null, language: string): string {
  if (!status) return '-';
  if (language !== 'zh') return status;

  const statusMap: Record<string, string> = {
    'Native': '原生',
    'Exotic': '外來',
    'Reintroduced': '重新引入',
    'Introduced': '引入'
  };

  // 處理可能的複合字串或大小寫問題
  const trimmedStatus = status.trim();
  const capitalizedStatus = trimmedStatus.charAt(0).toUpperCase() + trimmedStatus.slice(1).toLowerCase();
  
  return statusMap[trimmedStatus] || statusMap[capitalizedStatus] || status;
}

/**
 * 統一處理物種圖片 URL
 * 優先序：指定封面 (profile_picture) > iNaturalist 圖片 > 預設圖片
 * @param species 物種物件
 * @param size 所需尺寸 ('square' | 'medium' | 'large')
 * @returns 最終圖片 URL
 */
export function getSpeciesImageUrl(species: any, size: 'square' | 'medium' | 'large' = 'medium'): string {
  const profilePic = species?.profile_picture;
  const inatId = species?.inat_id;
  const placeholder = '/images/placeholder/no-species-image.svg';

  let url = profilePic || (inatId ? `https://api.inaturalist.org/v1/taxa/${inatId}` : placeholder);

  // 如果是 API URL (待轉換)，返回空字串或由 hook 處理
  // 這裡回傳空字串，讓組件知道需要依賴 hook (inatPhoto)
  if (url.includes('api.inaturalist.org/v1/taxa')) {
    return '';
  }

  // 如果是 placeholder，直接返回
  if (url === placeholder) {
    return url;
  }

  // 處理 iNaturalist URL 轉換尺寸
  if (url.includes('inaturalist')) {
    // 移除可能存在的代理路徑
    if (url.includes('/api/image/transform')) {
      const urlParams = new URLSearchParams(url.split('?')[1]);
      url = urlParams.get('url') || url;
    }
    // 轉換尺寸
    url = url.replace(/\/(square|large|medium|small|original)\./, `/${size}.`);
  }

  // 封裝代理路徑 (這部分維持動態生成，不存入 DB)
  if (url.includes('inaturalist')) {
    return `/api/image/transform?url=${encodeURIComponent(url)}&size=${size}`;
  }

  return url;
}
