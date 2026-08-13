/**
 * pages/ProductList.tsx
 * Step 3 of the guest flow: grid/list of all items in the tapped
 * category, each with a photo, name and price -- laid out like an
 * Amazon search-results page. Tapping a product opens ProductDetail.tsx.
 */
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import ProductCard from "../components/ProductCard";
import { fetchCategoryItems } from "../api/menu";
import type { MenuItemSummary } from "../types/menu";

export default function ProductList(): JSX.Element {
  const { categoryId } = useParams<{ categoryId: string }>();
  const location = useLocation();
  const [items, setItems] = useState<MenuItemSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!categoryId) return;
    let cancelled = false;
    setItems(null);
    setError(null);

    fetchCategoryItems(Number(categoryId))
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this category. Please try again.");
      });

    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  if (!categoryId) {
    return <p role="alert">No category selected.</p>;
  }

  if (error) {
    return (
      <div className="empty-state" role="alert">
        <h2>No items right now</h2>
        <p>{error}</p>
        <Link className="btn btn--secondary" to="/menu">
          Back to Categories
        </Link>
      </div>
    );
  }

  if (!items) {
    return (
      <div className="product-grid" aria-busy="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="product-card skeleton" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <h2>No items in this category right now</h2>
        <p>Try another category from the menu.</p>
        <Link className="btn btn--secondary" to="/menu">
          Back to Categories
        </Link>
      </div>
    );
  }

  return (
    <div className="product-list">
      {typeof location.state?.addedItemName === "string" && (
        <div className="post-add-notice" role="status">
          <span>{location.state.addedItemName} added to cart.</span>
          <Link className="btn btn--secondary" to="/menu">
            Back to Categories
          </Link>
        </div>
      )}
      <div className="product-list__header">
        <Link className="btn btn--secondary" to="/menu">
          Back to Categories
        </Link>
        <h1>Category Products</h1>
      </div>
      <div className="product-grid">
        {items.map((item) => (
          <ProductCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}