import React from 'react';

/**
 * 格式化生物學名，確保屬名與種小名斜體，而分類縮寫與標誌符號保持正體。
 * @param scientificName 原始學名字符串
 * @returns 包含 React 元素的陣列
 */
export function formatScientificName(scientificName: string | undefined): React.ReactNode {
  if (!scientificName) return null;

  // 生物學名中常見的正體縮寫與符號列表
  const abbreviations = [
    'sp\\. nov\\.', 'comb\\. nov\\.', 'gen\\. nov\\.', 'nom\\. nud\\.',
    'subsp\\.', 'ssp\\.', 'var\\.', 's\\.l\\.', 's\\.str\\.', 'auct\\.',
    'sp\\.', 'spp\\.', 'cv\\.', 'cf\\.', 'aff\\.', 'f\\.', '×'
  ];

  // 建立正則表達式：匹配這些縮寫（考量前後邊界或空格）
  // 使用捕獲括號以便在 split 時保留匹配部分
  const regex = new RegExp(`(\\s?(?:${abbreviations.join('|')})\\s?)`, 'g');

  // 分割字符串
  const parts = scientificName.split(regex);

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null;

        // 檢查該片段是否匹配縮寫列表中的任何一項
        const isAbbreviation = abbreviations.some(abbr => {
          const cleanAbbr = abbr.replace(/\\/g, '');
          return part.trim() === cleanAbbr;
        });

        // 特別處理雜交符號 ×
        const isHybrid = part.includes('×');

        if (isAbbreviation || isHybrid) {
          return <span key={index} className="not-italic font-sans">{part}</span>;
        }

        // 預設為斜體 (屬名、種小名等)
        return <span key={index} className="italic">{part}</span>;
      })}
    </>
  );
}
