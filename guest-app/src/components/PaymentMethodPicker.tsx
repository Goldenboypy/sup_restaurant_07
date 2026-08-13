import { useState } from "react";
import { requestPayment } from "../api/payment";

export type PaymentMethod = "card" | "cash";

interface PaymentMethodPickerProps {
  onRequested?: (method: PaymentMethod) => void;
}

/**
 * Guest flow step 7 (Payment): "Guest chooses payment method: Card
 * or Cash. The assigned waiter is notified immediately to come
 * collect payment and clear the table."
 *
 * Only rendered on the Bill screen, after [Pay] has already revealed
 * the price — this component itself never displays an amount, it
 * only submits POST /api/guest/payment { method } and triggers the
 * payment.requested websocket notification server-side.
 */
export default function PaymentMethodPicker({
  onRequested,
}: PaymentMethodPickerProps) {
  const [selected, setSelected] = useState<PaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (method: PaymentMethod) => {
    if (submitting) return;
    setSelected(method);
    setSubmitting(true);
    setError(null);

    try {
      await requestPayment({ method });
      onRequested?.(method);
    } catch {
      setError("Could not send your payment request. Please try again.");
      setSelected(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="payment-method-picker"
      role="group"
      aria-label="Choose payment method"
    >
      <button
        type="button"
        className={`payment-method-picker__option${
          selected === "card" ? " payment-method-picker__option--selected" : ""
        }`}
        onClick={() => handleSelect("card")}
        disabled={submitting}
        aria-pressed={selected === "card"}
      >
        Card
      </button>
      <button
        type="button"
        className={`payment-method-picker__option${
          selected === "cash" ? " payment-method-picker__option--selected" : ""
        }`}
        onClick={() => handleSelect("cash")}
        disabled={submitting}
        aria-pressed={selected === "cash"}
      >
        Cash
      </button>

      {submitting && (
        <p className="payment-method-picker__status">Notifying your waiter…</p>
      )}
      {error && (
        <p className="payment-method-picker__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}