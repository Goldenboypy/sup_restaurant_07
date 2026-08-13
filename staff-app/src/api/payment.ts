/**
 * Staff App - Payment Requests API client
 *
 * Talks to /api/staff/payment-requests. Fired only after a guest has
 * tapped [ Pay ] in the Guest App and picked Card or Cash (see
 * PAYMENT STATUS state machine: hidden -> requested -> completed).
 * Authenticated with the Bearer token from staff login.
 *
 * Endpoints:
 *   GET   /api/staff/payment-requests           tables awaiting payment
 *   PATCH /api/staff/payment-requests/:id        complete -> table becomes Free
 */

import type { PaymentRequest, StaffPaymentRequest } from '../types/payment';

const API_BASE = import.meta.env.VITE_STAFF_API_BASE_URL ?? '/api/staff';

function getAuthToken(): string | null {
  return localStorage.getItem('staff_auth_token');
}

async function staffFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken();

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Payment API error ${response.status}: ${detail || response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** GET /api/staff/payment-requests - tables currently in "Bill Requested" status. */
export function getPaymentRequests(): Promise<StaffPaymentRequest[]> {
  return staffFetch<StaffPaymentRequest[]>('/payment-requests');
}

export const fetchPaymentRequests = getPaymentRequests;

/**
 * PATCH /api/staff/payment-requests/:id
 * Called once the waiter has collected payment and cleared the table.
 * Flips the payment status to "completed" and the table back to Free.
 */
export function completePaymentRequest(
  paymentRequestId: string | number
): Promise<PaymentRequest> {
  return staffFetch<PaymentRequest>(`/payment-requests/${paymentRequestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'completed' }),
  });
}