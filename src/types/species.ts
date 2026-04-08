export interface Species {
  id: number;
  species_id: number;
  taxa_group: string;
  
  // Names
  common_name: string; // 中文俗名 (Common Name Chi)
  common_name_en: string; // 英文俗名
  scientific_name: string;
  alias_scientific_name?: string;
  alias_common_name?: string;
  alias_common_name_en?: string;
  author: string;
  
  // Taxonomy (Eng / Chi)
  phylum: string;
  phylum_chi: string;
  class: string;
  class_chi: string;
  sub_class?: string;
  sub_class_chi?: string;
  order: string;
  order_chi: string;
  sub_order?: string;
  sub_order_chi?: string;
  superfamily?: string;
  superfamily_chi?: string;
  family: string;
  family_chi: string;
  sub_family?: string;
  sub_family_chi?: string;
  genus: string;
  genus_chi: string;
  species: string; // specific epithet
  sub_species?: string;
  informal_group: string;
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
  description_en?: string;
  description_chi?: string;
  remarks_en?: string;
  remarks_chi?: string;
  hk_distribution_en?: string;
  hk_distribution_chi?: string;
  global_distribution_en?: string;
  global_distribution_chi?: string;
  references_en?: string;
  references_chi?: string;

  // Media
  image_url: string; // Placeholder for main image
  slug: string; // Optional for URL routing
}

export type TaxonomyLevel = 'phylum' | 'class' | 'order' | 'family' | 'genus';
