/**
 * Staff App - Kitchen API client
 *
 * Talks to /api/staff/kitchen/* and the "served" action on /api/staff/orders/*.
 * All requests are authenticated with the Bearer token issued at staff login
 * (same auth.py pattern as v1.0). Guest-side prices are never touched here.
 *
 * Endpoints:
 *   GET   /api/staff/kitchen/tickets           active tickets (kitchen view)
 *   PATCH /api/staff/kitchen/tickets/:id        status: in_progress | ready
 *   PATCH /api/staff/orders/:id/served          mark delivered to the table
 */

import type { KitchenTicket } from '../types/ticket';
import type { Order } from '../types/order';

const API_BASE = import.meta.env.VITE_STAFF_API_BASE_URL ?? '/api/staff';

/** Ticket status values the kitchen is allowed to set (see state machine in spec). */
export type KitchenTicketStatus = 'in_progress' | 'ready';

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
    throw new Error(`Kitchen API error ${response.status}: ${detail || response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** GET /api/staff/kitchen/tickets - active tickets for the kitchen board. */
export function getActiveTickets(): Promise<KitchenTicket[]> {
  return staffFetch<KitchenTicket[]>('/kitchen/tickets');
}

export const fetchKitchenTickets = getActiveTickets;

/** PATCH /api/staff/kitchen/tickets/:id - move a ticket to in_progress or ready. */
export function updateTicketStatus(
  ticketId: string | number,
  status: KitchenTicketStatus
): Promise<KitchenTicket> {
  return staffFetch<KitchenTicket>(`/kitchen/tickets/${ticketId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

/**
 * PATCH /api/staff/orders/:id/served
 * Called by the waiter after delivering a "ready" order to the table.
 * This is what unlocks the guest's [ Pay ] button for that order.
 */
export function markOrderServed(orderId: string | number): Promise<Order> {
  return staffFetch<Order>(`/orders/${orderId}/served`, {
    method: 'PATCH',
  });
}