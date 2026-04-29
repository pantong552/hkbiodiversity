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
