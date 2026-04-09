export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  updated_at: string;
}

export interface Comment {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  species_id: number;
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
