/**
 * pages/ProductDetail.tsx
 * Step 4 of the guest flow: large product photo, ingredient list next
 * to it (for allergies / dislikes), and three buttons:
 *   [ Back to Category List ] [ Configure Order ] [ Order ]
 * "Order" (4b, direct) adds the item to the cart with no modifications,
 * then returns to the Category List the product came from (Step 5).
 * "Configure Order" (4a) hands off to ConfigureOrder.tsx for exclusions.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import IngredientList from "../components/IngredientList";
import { fetchItemDetail } from "../api/menu";
import { useCart } from "../hooks/useCart";
import { useTableSession } from "../hooks/useTableSession";
import type { MenuItemDetail } from "../types/menu";

export default function ProductDetail(): JSX.Element {
  const { categoryId, itemId } = useParams<{ categoryId: string; itemId: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { session } = useTableSession();

  const [item, setItem] = useState<MenuItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    setItem(null);
    setError(null);

    fetchItemDetail(Number(itemId))
      .then((data) => {
        if (!cancelled) setItem(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this item.");
      });

    return () => {
      cancelled = true;
    };
  }, [itemId]);

  function handleBack() {
    navigate(categoryId ? `/menu/${categoryId}` : "/menu");
  }

  function handleConfigure() {
    if (categoryId && itemId) navigate(`/menu/${categoryId}/${itemId}/configure`);
  }

  async function handleOrderDirect() {
    if (!item || !session) return;
    setIsAdding(true);
    try {
      await addItem({ item_id: item.id });
      navigate("/cart");
    } catch {
      setError("Could not add this item to your cart. Please try again.");
      setIsAdding(false);
    }
  }

  if (error && !item) {
    return (
      <div className="empty-state" role="alert">
        <h2>Item unavailable</h2>
        <p>{error}</p>
        <button className="btn btn--secondary" onClick={handleBack} type="button">
          Back to Category List
        </button>
      </div>
    );
  }

  if (!item) {
    return <div className="product-detail skeleton" aria-busy="true" style={{ minHeight: 320 }} />;
  }

  return (
    <div className="product-detail">
      <div className="product-detail__media">
        {item.image_url ? (
          <img className="product-detail__photo" src={item.image_url} alt={item.name} />
        ) : (
          <div className="product-detail__photo product-detail__photo--empty" aria-label="No product image" />
        )}
      </div>
      <div className="product-detail__info">
        <h1 className="product-detail__name">{item.name}</h1>
        <IngredientList ingredients={item.ingredients} />
      </div>

      {error && <p role="alert">{error}</p>}

      <div className="product-detail__actions">
        <button className="btn btn--secondary" onClick={handleBack} type="button">
          Back to Category List
        </button>
        <button
          className="btn btn--secondary"
          onClick={handleConfigure}
          type="button"
          disabled={!session}
        >
          Configure Order
        </button>
        <button
          className="btn btn--primary"
          onClick={handleOrderDirect}
          type="button"
          disabled={!session || isAdding}
        >
          {isAdding ? "Adding..." : session ? "Order" : "Scan QR to order"}
        </button>
      </div>
      {!session && (
        <p className="product-detail__hint">
          This product is visible to everyone. Scan the table QR code to order.
        </p>
      )}
    </div>
  );
}