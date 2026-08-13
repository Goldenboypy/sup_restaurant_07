import { guestRequest } from "./session";
import type { Bill, Order } from "../types/order";

/** POST /api/guest/orders — submit cart -> order_id. */
export function submitOrders(): Promise<Order> {
  return guestRequest<Order>("/orders", { method: "POST" });
}

/** GET /api/guest/orders — this session's orders and their status. */
export function fetchOrders(): Promise<Order[]> {
  return guestRequest<Order[]>("/orders");
}

/**
 * GET /api/guest/bill — 403 until payment is requested, then returns
 * the full itemized total. First point at which any price is shown
 * to the guest.
 */
export function fetchBill(): Promise<Bill> {
  return guestRequest<Bill>("/bill");
}