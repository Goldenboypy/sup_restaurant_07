export type TableSessionStatus = "active" | "closed";

/**
 * Mirrors core/models.py TableSession: table (FK), qr_token,
 * started_at, ended_at, status (active|closed).
 */
export interface TableSession {
  session_token: string;
  table_id: number;
  table_number?: string;
  status: TableSessionStatus;
  started_at: string;
  ended_at: string | null;
}