import { staffRequest } from "./auth";
import type { StaffOrder } from "../types/order";

/** GET /api/staff/orders/pending — awaiting waiter confirmation. */
export function fetchPendingOrders(): Promise<StaffOrder[]> {
  return staffRequest<StaffOrder[]>("/orders/pending");
}

/**
 * PATCH /api/staff/orders/:id/confirm — confirm -> creates ticket.
 * "Unconfirmed orders never reach the kitchen."
 */
export function confirmOrder(orderId: number): Promise<StaffOrder> {
  return staffRequest<StaffOrder>(`/orders/${orderId}/confirm`, {
    method: "PATCH",
  });
}

/**
 * PATCH /api/staff/orders/:id/served — mark delivered to the table.
 * This is what unlocks the guest's [Pay] button for this order.
 */
export function markOrderServed(orderId: number): Promise<StaffOrder> {
  return staffRequest<StaffOrder>(`/orders/${orderId}/served`, {
    method: "PATCH",
  });
}