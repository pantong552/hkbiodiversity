export interface Species {
  id: number;
  taxa_id?: string;
  inat_id: number;
  taxa_group: string;
  
  // Names
  common_name_chi: string; // 中文俗名
  common_name_eng: string; // 英文俗名
  scientific_name: string;
  alias_scientific_name?: string;
  alias_common_name_chi?: string;
  alias_common_name_eng?: string;
  author: string;
  
  // Taxonomy (Eng / Chi) - _chi 欄位已從資料庫移除，請使用 TaxonomyContext 獲取中文名稱
  phylum_eng: string;
  phylum_chi?: string;
  class_eng: string;
  class_chi?: string;
  order_eng: string;
  order_chi?: string;
  family_eng: string;
  family_chi?: string;
  genus_eng: string;
  genus_chi?: string;
  species_eng: string;
  sub_species_eng?: string;
  informal_group_eng: string;
  informal_group_chi?: string;

  // Status & Conservation
  afcd?: string;
  hkbws_cat?: string;
  china_red_list?: string;
  cites?: string;
  endemic?: string;
  hk_protection?: string;
  iucn: string;
  native_status?: string;
  restrictedness?: string;
  china_vertebrates_red_list?: string;
  
  // Descriptions & Info (Eng / Chi)
  description_eng?: string;
  description_chi?: string;
  habitat_eng?: string;
  habitat_chi?: string;
  host_plants_eng?: string;
  host_plants_chi?: string;
  remarks_eng?: string;
  remarks_chi?: string;
  hk_distribution_eng?: string;
  hk_distribution_chi?: string;
  global_distribution_eng?: string;
  global_distribution_chi?: string;
  reference_codes?: string;
  references_codes?: string;
  references_eng?: string;
  references_chi?: string;
  profile_picture?: string;
  introduction_chi?: string;
  introduction_eng?: string;
  microhabitat_chi?: string;
  microhabitat_eng?: string;
  similar_species?: string;
}

export type TaxonomyLevel = 'phylum_eng' | 'class_eng' | 'order_eng' | 'family_eng' | 'genus_eng' | 'informal_group_eng';
