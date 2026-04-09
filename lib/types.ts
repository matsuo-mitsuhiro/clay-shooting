// ============================================================
// 共通型定義
// ============================================================

export type EventType = 'trap' | 'skeet';
export type ClassType = 'AA' | 'A' | 'B' | 'C';

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
  // 申込設定
  max_participants: number | null;
  apply_start_at: string | null;
  apply_end_at: string | null;
  cancel_end_at: string | null;
  competition_start_time: string | null;
  gate_open_time: string | null;
  reception_start_time: string | null;
  practice_clay_time: string | null;
  cancellation_notice: string | null;
  notes: string | null;
  apply_qr: string | null;
  // 保存者・日時
  info_saved_at: string | null;
  info_saved_by: string | null;
  apply_saved_at: string | null;
  apply_saved_by: string | null;
  reset_at: string | null;
  reset_by: string | null;
  // 記録審査
  rule_type: string | null;
  weather: string | null;
  temperature: string | null;
  wind_speed: string | null;
  chief_judge: string | null;
  operation_manager: string | null;
  record_manager: string | null;
  set_checker: string | null;
  clay_name: string | null;
  class_division: string | null;
  // 組発表
  squad_published_at: string | null;
  squad_comment: string | null;
  // 進捗判定用（一覧取得時のみ付与）
  member_count?: number;
  score_count?: number;
}

export interface SquadMember {
  id: number;
  day: number;
  group_number: number;
  position: number;
  name: string;
  belong: string | null;
  class: string | null;
  is_judge: boolean;
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
  // 申込設定（オプショナル）
  max_participants?: number | null;
  apply_start_at?: string | null;
  apply_end_at?: string | null;
  cancel_end_at?: string | null;
  competition_start_time?: string | null;
  gate_open_time?: string | null;
  reception_start_time?: string | null;
  practice_clay_time?: string | null;
  cancellation_notice?: string | null;
  notes?: string | null;
  apply_qr?: string | null;
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
  manual_rank: number | null;
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
  position: number;
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
  manual_rank: number | null;
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

// ---------- Registration ----------
export type ParticipationDay = 'day1' | 'day2' | 'both';

export interface Registration {
  id: number;
  tournament_id: number;
  member_code: string;
  name: string;
  belong: string | null;
  email: string;
  event_type: string;
  participation_day: ParticipationDay;
  class: ClassType | null;
  is_judge: boolean;
  status: 'active' | 'cancelled';
  cancelled_at: string | null;
  cancelled_by: 'user' | 'admin' | null;
  cancelled_by_name: string | null;
  applied_at: string;
  source: 'web' | 'manual';
  transferred_at: string | null;
}

export interface RegistrationToken {
  id: number;
  tournament_id: number;
  email: string;
  token: string;
  purpose: 'apply' | 'cancel';
  registration_id: number | null;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

// ---------- Association ----------
export interface Association {
  cd: number;
  name: string;
  cancellation_notice: string | null;
  notes: string | null;
  president_name: string | null;
}

// ---------- TournamentReport ----------
export interface TournamentReport {
  id: number;
  tournament_id: number | null;
  paired_tournament_id: number | null;
  report_date: string | null;
  certification_fee: number;
  advertising_fee: number;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportIncentive {
  id?: number;
  report_id?: number;
  event_type: string;
  straight_type: number;
  player_name: string;
  member_code: string;
  belong: string;
  amount: number;
  sort_order: number;
}

// ---------- ShootingRange ----------
export interface ShootingRange {
  id: number;
  prefecture: string;
  name: string;
}

// ---------- Operation Log ----------
export type OperationAction =
  | 'tournament_delete'
  | 'tournament_reset'
  | 'tournament_create'
  | 'tournament_update'
  | 'apply_settings'
  | 'registration_manual'
  | 'registration_transfer'
  | 'registration_cancel'
  | 'registration_delete'
  | 'registration_restore'
  | 'member_delete'
  | 'login'
  | 'inspection_save'
  | 'inspection_download'
  | 'report_save'
  | 'report_download';

export interface OperationLog {
  id: number;
  tournament_id: number | null;
  tournament_name: string | null;
  logged_at: string;
  admin_name: string | null;
  admin_affiliation: string | null;
  action: OperationAction;
  detail: string | null;
}

// ---------- API Response ----------
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
