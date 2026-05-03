export type UserRole = 'admin' | 'curator' | 'guest';

export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role: UserRole;
  updated_at: string;
  last_online_at?: string | null;
  inaturalist_username?: string | null;
  allow_all_rights_reserved_usage?: boolean;
}

export interface Comment {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  taxa_id: string;
  content: string;
  parent_id: string | null;
  is_deleted: boolean;
  
  // Joined fields
  profiles?: Profile;
  replies?: Comment[];
  likes_count?: number;
  user_has_liked?: boolean;
}

export interface CommentLike {
  id: string;
  comment_id: string;
  user_id: string;
}
