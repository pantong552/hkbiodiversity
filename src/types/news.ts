export type NewsCategory = 'System' | 'Community' | 'Taxonomy' | 'Notice' | 'Sales';

export interface NewsItem {
  id: string;
  category: NewsCategory;
  published_at: string;
  title_chi: string;
  title_eng: string;
  content_chi: string;
  content_eng: string;
  created_at: string;
}
