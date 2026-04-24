export interface Species {
  id: number;
  taxa_id: string;
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
  
  // Taxonomy (Eng / Chi)
  phylum_eng: string;
  phylum_chi: string;
  class_eng: string;
  class_chi: string;
  sub_class_eng?: string;
  sub_class_chi?: string;
  order_eng: string;
  order_chi: string;
  sub_order_eng?: string;
  sub_order_chi?: string;
  superfamily_eng?: string;
  superfamily_chi?: string;
  family_eng: string;
  family_chi: string;
  sub_family_eng?: string;
  sub_family_chi?: string;
  genus_eng: string;
  genus_chi: string;
  species_eng: string; // specific epithet
  sub_species_eng?: string;
  informal_group_eng: string;
  informal_group_chi: string;

  // Status & Conservation
  afcd?: string;
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
  remarks_eng?: string;
  remarks_chi?: string;
  hk_distribution_eng?: string;
  hk_distribution_chi?: string;
  global_distribution_eng?: string;
  global_distribution_chi?: string;
  references_eng?: string;
  references_chi?: string;

  // Media
  image_url: string; // Placeholder for main image
  slug: string; // Optional for URL routing
}

export type TaxonomyLevel = 'phylum_eng' | 'class_eng' | 'order_eng' | 'family_eng' | 'genus_eng';
