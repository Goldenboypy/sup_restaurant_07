import { guestRequest } from "./session";
import type { CartItem, CartItemInput } from "../types/order";

/** POST /api/guest/cart/items — add item (+ exclusions opt.). */
export function addCartItem(input: CartItemInput): Promise<CartItem> {
  return guestRequest<CartItem>("/cart/items", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** GET /api/guest/cart — draft cart, NO price field. */
export function fetchCart(): Promise<CartItem[]> {
  return guestRequest<CartItem[]>("/cart");
}