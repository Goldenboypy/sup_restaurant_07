import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { fetchItemDetail } from "../api/menu";
import { submitOrders } from "../api/orders";
import { useCart } from "../hooks/useCart";
import type { CartItem } from "../types/order";

type CartLine = CartItem & {
  image_url?: string;
  price?: number;
};

export default function Cart(): JSX.Element {
  const { items, isLoading, refresh } = useCart();
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [detailedItems, setDetailedItems] = useState<CartLine[]>([]);

  useEffect(() => {
    if (!items.length) {
      setDetailedItems([]);
      return;
    }

    let cancelled = false;

    Promise.all(
      items.map(async (cartItem) => {
        try {
          const detail = await fetchItemDetail(cartItem.item_id);
          return {
            ...cartItem,
            image_url: detail.image_url,
            price: detail.price,
          };
        } catch {
          return {
            ...cartItem,
            image_url: undefined,
            price: undefined,
          };
        }
      })
    )
      .then((resolved) => {
        if (!cancelled) setDetailedItems(resolved);
      })
      .catch(() => {
        if (!cancelled) setDetailedItems(items);
      });

    return () => {
      cancelled = true;
    };
  }, [items]);

  async function handlePlaceOrder() {
    if (isPlacing || items.length === 0) return;
    setIsPlacing(true);
    setError(null);

    try {
      const order = await submitOrders();
      setLastOrderId(order.id);
      await refresh();
    } catch {
      setError("Could not place your order. Please try again.");
    } finally {
      setIsPlacing(false);
    }
  }

  return (
    <div className="cart">
      <div className="cart__header">
        <div>
          <p className="cart__eyebrow">Your account</p>
          <h1>My Orders</h1>
        </div>
        <Link className="btn btn--secondary" to="/menu">
          Continue Ordering
        </Link>
      </div>

      {lastOrderId !== null && (
        <p className="cart__confirmation" role="status">
          Order #{lastOrderId} placed successfully.
        </p>
      )}

      {isLoading && items.length === 0 ? (
        <p aria-busy="true">Loading your order...</p>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <h2>Your order list is empty</h2>
          <p>Add items from the menu to build your order.</p>
          <Link className="btn btn--primary" to="/menu">
            Browse Menu
          </Link>
        </div>
      ) : (
        <>
          <ul className="cart-list" aria-label="Selected items">
            {detailedItems.map((cartItem) => (
              <li key={cartItem.cart_item_id} className="cart-item">
                <div className="cart-item__image-container">
                  {cartItem.image_url ? (
                    <img className="cart-item__image" src={cartItem.image_url} alt={cartItem.name} />
                  ) : (
                    <div className="cart-item__image--empty" aria-label="No product image" />
                  )}
                </div>

                <div className="cart-item__body">
                  <div className="cart-item__header">
                    <h3 className="cart-item__name">{cartItem.name}</h3>
                    {cartItem.price !== undefined && (
                      <span className="cart-item__price">
                        ${typeof cartItem.price === "number" ? cartItem.price.toFixed(2) : "0.00"}
                      </span>
                    )}
                  </div>

                  {cartItem.excluded_ingredients.length > 0 && (
                    <div className="cart-item__config">
                      <p className="cart-item__config-label">Configured:</p>
                      <ul className="cart-item__exclusions" aria-label="Configured exclusions">
                        {cartItem.excluded_ingredients.map((ingredient) => (
                          <li key={`${cartItem.cart_item_id}-${ingredient}`} className="cart-item__exclusion-tag">
                            No {ingredient}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="cart-item__footer">
                    <span className="cart-item__qty">Qty: <strong>{cartItem.quantity}</strong></span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {error && <p role="alert">{error}</p>}
          <div className="cart__actions">
            <button className="btn btn--primary" type="button" onClick={handlePlaceOrder} disabled={isPlacing}>
              {isPlacing ? "Finishing order..." : "Finish Order"}
            </button>
            <Link className="btn btn--secondary" to="/menu">
              Continue Ordering
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
