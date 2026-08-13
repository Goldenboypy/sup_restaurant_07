/**
 * Staff App - payment.ts
 * Mirrors core/models.py PaymentRequest.
 *
 * PAYMENT STATUS state machine (per table session):
 *   hidden -> requested (guest tapped Pay, picked a method) -> completed
 * "completed" is what flips the table back to Free.
 */

export type PaymentMethod = 'card' | 'cash';
export type PaymentStatus = 'requested' | 'completed';

export interface PaymentRequest {
  id: string | number;
  session_id: string | number;
  table_id: string | number;
  method: PaymentMethod;
  status: PaymentStatus;
  requested_at: string;
  completed_at: string | null;
}

export type StaffPaymentRequest = Omit<PaymentRequest, 'id'> & {
  id: number;
  table_number: string | number;
  currency?: string;
  total?: number;
};