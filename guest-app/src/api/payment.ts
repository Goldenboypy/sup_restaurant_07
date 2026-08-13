import { guestRequest } from "./session";
import type { PaymentMethod, PaymentRequestInput } from "../types/order";

/**
 * POST /api/guest/payment — guest picks Card or Cash on the Bill
 * screen; the assigned waiter is notified immediately to come
 * collect payment and clear the table.
 */
export function requestPayment(input: PaymentRequestInput): Promise<void> {
  return guestRequest<void>("/payment", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type { PaymentMethod };