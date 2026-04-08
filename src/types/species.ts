export interface Species {
  id: number;
  common_name: string;
  common_name_en: string; // 新增英文俗名
  scientific_name: string;
  image_url: string;
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  rarity: string;
  rarity_en: string; // 新增英文稀有度
  conservation_status: string;
  conservation_status_en: string; // 新增英文保護現狀
  slug: string;
}

export type TaxonomyLevel = 'kingdom' | 'phylum' | 'class' | 'order' | 'family' | 'genus';
