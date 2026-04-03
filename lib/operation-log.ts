import { sql } from '@/lib/db';
import type { OperationAction } from '@/lib/types';

/**
 * 操作ログを記録する
 */
export async function writeOperationLog(params: {
  tournamentId: number | null;
  tournamentName: string | null;
  adminName: string | null;
  adminAffiliation: string | null;
  action: OperationAction;
  detail?: string | null;
}) {
  await sql`
    INSERT INTO operation_logs (tournament_id, tournament_name, logged_at, admin_name, admin_affiliation, action, detail)
    VALUES (
      ${params.tournamentId},
      ${params.tournamentName},
      NOW(),
      ${params.adminName},
      ${params.adminAffiliation},
      ${params.action},
      ${params.detail ?? null}
    )
  `;
}
