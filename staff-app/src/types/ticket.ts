/**
 * Staff App - ticket.ts
 * Mirrors core/models.py KitchenTicket, created once a waiter confirms
 * an order (Order.confirmed_by_waiter -> forwarded to kitchen).
 *
 * TICKET STATUS: new -> in_progress -> ready
 * Reaching "ready" notifies the ORIGINAL assigned waiter, never a broadcast.
 */

export type TicketStatus = 'new' | 'in_progress' | 'ready';

export interface KitchenTicketItem {
  name: string;
  quantity: number;
  excluded_ingredients: string[];
}

export interface KitchenTicket {
  id: string | number;
  order_id: string | number;
  table_number: string | number;
  status: TicketStatus;
  items: KitchenTicketItem[];
  created_at: string;
}