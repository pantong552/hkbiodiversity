export interface PlantSpecies {
  id: number;
  taxa_id: string;
  inat_id: number;
  oid: number;
  category_zh: string;
  category_en: string;
  family_zh: string;
  family_en: string;
  genus_zh: string;
  genus_en: string;
  scientific_name: string;
  author: string;
  common_name_zh: string;
  common_name_en: string;
  origin: string;
  is_cap96: string | boolean;
  is_cap586: string | boolean;
  hk_rare_precious_note: string;
  china_red_data_book_note: string;
  flowering_period: string;
  fruiting_period: string;
  flowering_months: number[];
  fruiting_months: number[];
  description: string;
  locality: string;
  distribution: string;
  habitat: string;
  usage: string;
  remark: string;
  description_chi: string;
  locality_chi: string;
  distribution_chi: string;
  habitat_chi: string;
  usage_chi: string;
  remark_chi: string;
  created_at: string;
  updated_at: string;
}

export interface PlantFilterState {
  searchQuery: string;
  categories: string[];
  families: string[];
  genuses: string[];
  origins: string[];
  floweringMonths: number[];
  fruitingMonths: number[];
  isCap96: boolean | null;
  isCap586: boolean | null;
  isRare: boolean | null;
  isInChinaRedBook: boolean | null;
}
