export type ArticleStatus = 'submitted' | 'published' | 'rejected' | 'draft';
export type ArticleLanguage = 'zh' | 'en' | 'bilingual';

export interface EcoCategory {
  id: string;
  name_chi: string;
  name_eng: string;
  slug: string;
  description_chi?: string | null;
  description_eng?: string | null;
  sort_order: number;
  created_at?: string;
}

export interface EcoAuthor {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
  role?: string | null;
}

export interface RejectionLog {
  reason: string;
  created_at: string;
  admin_name?: string;
}

export interface EcoArticle {
  id: string;
  author_id: string;
  category_id: string;
  article_language: ArticleLanguage;
  title_chi: string;
  title_eng: string;
  chapter_number?: number | null;
  chapter_title_chi?: string | null;
  chapter_title_eng?: string | null;
  summary_chi?: string | null;
  summary_eng?: string | null;
  content_chi: string;
  content_eng: string;
  cover_image?: string | null;
  tags: string[];
  status: ArticleStatus;
  rejection_reason?: string | null;
  rejection_history?: RejectionLog[];
  last_edited_by_name?: string | null;
  views: number;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  // Joined relation
  eco_categories?: EcoCategory;
  profiles?: EcoAuthor;
}
