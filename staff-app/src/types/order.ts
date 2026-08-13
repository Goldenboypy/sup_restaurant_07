/**
 * Staff App - order.ts
 * Mirrors core/models.py Order + OrderItem.
 *
 * ORDER STATUS state machine:
 *   submitted -> waiter_confirmed -> kitchen_in_progress -> ready -> served
 * "served" is what unlocks the guest's [ Pay ] button for that order.
 */

export type OrderStatus =
  | 'submitted'
  | 'waiter_confirmed'
  | 'kitchen_in_progress'
  | 'ready'
  | 'served';

export interface OrderItem {
  id: string | number;
  menu_item_id: string | number;
  name: string;
  quantity: number;
  /** Set via the guest's "Configure Order" step, e.g. ["tomato"]. */
  excluded_ingredients: string[];
}

export interface Order {
  id: string | number;
  session_id: string | number;
  table_id: string | number;
  status: OrderStatus;
  items: OrderItem[];
  confirmed_by_waiter: boolean;
  confirmed_at: string | null;
  served_at: string | null;
  served_by: string | number | null;
  /** Staff-facing serializer only - the guest never sees this before payment. */
  total_price: number;
  created_at: string;
}

export interface StaffOrder {
  id: number;
  table_number: number;
  status: OrderStatus;
  submitted_at: string;
  confirmed_by_waiter: boolean;
  items: Array<{
    id: number;
    menu_item: { id: number; name: string; price: number };
    quantity: number;
    excluded_ingredients: string[];
  }>;
}