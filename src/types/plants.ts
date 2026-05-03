export interface PlantSpecies {
  id: number;
  taxa_id?: string;
  inat_id: number;
  oid: number;
  category_chi: string;
  category_eng: string;
  family_chi: string;
  family_eng: string;
  genus_chi: string;
  genus_eng: string;
  scientific_name: string;
  author: string;
  common_name_chi: string;
  common_name_eng: string;
  origin: string;
  is_cap96: string | boolean;
  is_cap586: string | boolean;
  hk_rare_precious_note: string;
  china_red_data_book_note: string;
  flowering_period: string;
  fruiting_period: string;
  flowering_months: number[];
  fruiting_months: number[];
  description_eng: string;
  locality_eng: string;
  distribution_eng: string;
  habitat_eng: string;
  usage_eng: string;
  remark_eng: string;
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
