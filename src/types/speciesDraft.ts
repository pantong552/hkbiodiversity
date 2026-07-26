export type SpeciesDraftStatus = 'pending' | 'approved' | 'rejected';

export interface SpeciesDraft {
  id: string;
  species_id: string;
  table_name: string;
  curator_id: string | null;
  curator_name: string | null;
  curator_avatar: string | null;
  draft_data: any;
  status: SpeciesDraftStatus;
  rejection_reason?: string | null;
  approved_by?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  submitted_at: string;
  created_at: string;
}
