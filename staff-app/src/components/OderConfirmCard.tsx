import type { StaffOrder } from "../types/order";

interface OrderConfirmCardProps {
  order: StaffOrder;
  isConfirming: boolean;
  onConfirm: () => void;
}

/**
 * Waiter view step 3: "The waiter must CONFIRM the order before
 * anything happens. Confirming forwards the order to the Kitchen as
 * a new ticket. Unconfirmed orders never reach the kitchen." Shows
 * items and any configured exclusions so confirming is an informed
 * decision, not a formality.
 */
export default function OrderConfirmCard({
  order,
  isConfirming,
  onConfirm,
}: OrderConfirmCardProps) {
  return (
    <div className="order-confirm-card">
      <div className="order-confirm-card__header">
        <span className="order-confirm-card__table">
          Table {order.table_number}
        </span>
        <span className="order-confirm-card__time">
          {new Date(order.submitted_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      <ul className="order-confirm-card__items">
        {order.items.map((item, index) => (
          <li key={index} className="order-confirm-card__item">
            {item.quantity}× {item.menu_item.name}
            {item.excluded_ingredients.length > 0 && (
              <span className="order-confirm-card__exclusions">
                {" "}
                (no {item.excluded_ingredients.join(", ")})
              </span>
            )}
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="order-confirm-card__confirm"
        onClick={onConfirm}
        disabled={isConfirming}
      >
        {isConfirming ? "Confirming…" : "Confirm"}
      </button>
    </div>
  );
}