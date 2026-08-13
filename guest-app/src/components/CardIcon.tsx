import { Link } from "react-router-dom";
import { useCart } from "../hooks/useCart";

/**
 * Guest flow step 5/6: "Cart icon updates to show the item is inside
 * (NO price shown)." This component intentionally never renders a
 * price — pricing is stripped server-side until the guest taps [Pay]
 * on the Bill screen (see PaymentMethodPicker).
 */
export default function CartIcon() {
  const { items } = useCart();
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);

  return (
    <Link to="/cart" className="cart-icon" aria-label={`My Orders, ${itemCount} items`}>
      <svg
        className="cart-icon__glyph"
        viewBox="0 0 24 24"
        width="24"
        height="24"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M7 4h-2l-1 2h2l3.6 7.59-1.35 2.44c-.16.28-.25.61-.25.97 0 1.1.9 2 2 2h12v-2h-11.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1h-14.34l-.94-2z"
        />
      </svg>
      {itemCount > 0 && (
        <span className="cart-icon__badge" aria-hidden="true">
          {itemCount}
        </span>
      )}
    </Link>
  );
}