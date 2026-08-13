import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ExclusionChecklist from "../components/ExclusionChecklist";
import { fetchItemDetail } from "../api/menu";
import type { MenuItemDetail } from "../types/menu";

export default function ConfigureOrder(): JSX.Element {
  const { categoryId, itemId } = useParams<{ categoryId: string; itemId: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<MenuItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;

    fetchItemDetail(Number(itemId))
      .then((data) => {
        if (!cancelled) setItem(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this item's ingredients.");
      });

    return () => {
      cancelled = true;
    };
  }, [itemId]);

  function handleBack() {
    navigate(categoryId && itemId ? `/menu/${categoryId}/${itemId}` : "/menu");
  }

  if (error && !item) {
    return (
      <div className="empty-state" role="alert">
        <p>{error}</p>
        <button className="btn btn--secondary" onClick={handleBack} type="button">
          Back to Product
        </button>
      </div>
    );
  }

  if (!item) {
    return <div className="configure-order skeleton" aria-busy="true" style={{ minHeight: 240 }} />;
  }

  return (
    <div className="configure-order">
      <h1 className="configure-order__title">Configure {item.name}</h1>
      <p className="configure-order__hint">Select ingredients to exclude from your order.</p>
      <ExclusionChecklist
        itemId={item.id}
        categoryId={Number(categoryId)}
        itemName={item.name}
        ingredients={item.ingredients}
      />
      {error && <p role="alert">{error}</p>}
      <button className="btn btn--secondary" onClick={handleBack} type="button">
        Cancel
      </button>
    </div>
  );
}
