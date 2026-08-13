/** Mirrors core/models.py Order.status. */
export type OrderStatus =
  | "submitted"
  | "waiter_confirmed"
  | "kitchen_in_progress"
  | "ready"
  | "served";

/** Payload for POST /api/guest/cart/items. */
export interface CartItemInput {
  item_id: number;
  excluded_ingredients?: string[];
}

/**
 * A line in the draft cart. Deliberately has NO price field — the
 * guest-facing cart serializer strips pricing until payment exists.
 */
export interface CartItem {
  cart_item_id: string;
  item_id: number;
  name: string;
  quantity: number;
  excluded_ingredients: string[];
}

export interface Order {
  id: number;
  status: OrderStatus;
  placed_at: string;
  items: CartItem[];
}

/** GET /api/guest/bill response — only reachable after [Pay] is tapped. */
export interface Bill {
  total: number;
  currency: string;
  orders: BillOrder[];
}

export interface BillItem extends CartItem {
  price: number;
  subtotal: number;
}

export interface BillOrder {
  id: number;
  status: OrderStatus;
  placed_at: string;
  items: BillItem[];
}

export type PaymentMethod = "card" | "cash";

/** Payload for POST /api/guest/payment. */
export interface PaymentRequestInput {
  method: PaymentMethod;
}