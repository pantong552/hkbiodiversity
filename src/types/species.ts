export interface Species {
  id: number;
  common_name: string;
  scientific_name: string;
  image_url: string;
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  rarity: string;
  conservation_status: string;
  slug: string;
}

export type TaxonomyLevel = 'kingdom' | 'phylum' | 'class' | 'order' | 'family' | 'genus';
