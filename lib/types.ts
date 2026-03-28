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
  day1_total: number;
  day2_total: number;
  total: number;
  average: number | null;
  rank: number;
}

// ---------- API Response ----------
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
