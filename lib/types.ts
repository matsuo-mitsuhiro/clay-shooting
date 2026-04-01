// ============================================================
// 共通型定義
// ============================================================

export type EventType = 'trap' | 'skeet';
export type ClassType = 'A' | 'B' | 'C' | 'D';

// ---------- Tournament ----------
export interface Tournament {
  id: number;
  name: string;
  venue: string | null;
  day1_date: string | null;
  day2_date: string | null;
  event_type: EventType;
  day1_set: string | null;
  day2_set: string | null;
  organizer_cd: number | null;
  is_public: boolean;
  admin_qr: string | null;
  viewer_qr: string | null;
  created_at: string;
  updated_at: string;
}

export interface TournamentInput {
  name: string;
  venue?: string;
  day1_date?: string;
  day2_date?: string;
  event_type?: EventType;
  day1_set?: string;
  day2_set?: string;
  organizer_cd?: number | null;
  admin_qr?: string;
  viewer_qr?: string;
}

// ---------- Member ----------
export interface Member {
  id: number;
  tournament_id: number;
  day: 1 | 2;
  group_number: number;
  position: number;
  member_code: string | null;
  name: string;
  belong: string | null;
  class: ClassType | null;
  is_judge: boolean;
  created_at: string;
}

export interface MemberInput {
  day: 1 | 2;
  group_number: number;
  position: number;
  member_code?: string;
  name: string;
  belong?: string;
  class?: ClassType;
  is_judge?: boolean;
}

// ---------- Score ----------
export type ScoreStatus = 'valid' | 'disqualified' | 'withdrawn';

export interface Score {
  id: number;
  tournament_id: number;
  member_code: string;
  name: string | null;
  r1: number | null;
  r2: number | null;
  r3: number | null;
  r4: number | null;
  r5: number | null;
  r6: number | null;
  r7: number | null;
  r8: number | null;
  cb: number | null;
  fr: number | null;
  status: ScoreStatus;
  created_at: string;
  updated_at: string;
}

export interface ScoreInput {
  member_code: string;
  name?: string;
  r1?: number | null;
  r2?: number | null;
  r3?: number | null;
  r4?: number | null;
  r5?: number | null;
  r6?: number | null;
  r7?: number | null;
  r8?: number | null;
  cb?: number | null;
  fr?: number | null;
  status?: ScoreStatus;
}

// ---------- Result (v_results ビュー) ----------
export interface Result {
  tournament_id: number;
  member_code: string;
  name: string;
  belong: string | null;
  class: ClassType | null;
  is_judge: boolean;
  group1: number;
  group2: number | null;
  r1: number | null;
  r2: number | null;
  r3: number | null;
  r4: number | null;
  r5: number | null;
  r6: number | null;
  r7: number | null;
  r8: number | null;
  cb: number | null;
  fr: number | null;
  status: ScoreStatus;
  day1_total: number;
  day2_total: number;
  total: number;
  average: number | null;
  rank: number | null;
}

// ---------- ViewerLog ----------
export interface ViewerLog {
  id: number;
  tournament_id: number;
  logged_at: string;
  belong: string | null;
  name_input: string | null;
  matched_name: string | null;
  user_agent: string | null;
}

// ---------- TournamentAdmin ----------
export interface TournamentAdmin {
  id: number;
  member_code: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  current_affiliation: string | null;
}

// ---------- API Response ----------
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
