/**
 * Staff App - table.ts
 * Mirrors the shared Table / Waiter models (core/models.py).
 * Waiter is unchanged from v1.0; Table gained assigned_waiter + qr_token.
 */

export type StaffRole = 'waiter' | 'kitchen';

/** TABLE STATUS state machine: free -> occupied -> bill_requested -> free */
export type TableStatus = 'free' | 'occupied' | 'bill_requested';

export interface Waiter {
  id: string | number;
  name: string;
  role: StaffRole;
}

export interface Table {
  id: string | number;
  number: number | string;
  status: TableStatus;
  assigned_waiter: Waiter | null;
  /** Used to build/print the guest-facing QR code (GET /api/staff/tables/:id/qr). */
  qr_token: string;
}