export type UserRole = 'admin' | 'curator' | 'guest';
export type UserStatus = 'active' | 'blocked';
export type CuratorApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  last_online_at?: string | null;
  inaturalist_username?: string | null;
  allow_all_rights_reserved_usage?: boolean;
  curator_application_status?: CuratorApplicationStatus | null;
  curator_application_reason?: string | null;
  curator_application_submitted_at?: string | null;
  curator_application_reviewed_at?: string | null;
  curator_application_reviewed_by?: string | null;
  curator_application_rejection_reason?: string | null;
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
