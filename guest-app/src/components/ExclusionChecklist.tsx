import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../hooks/useCart";
import type { Ingredient } from "./IngredientList";

interface ExclusionChecklistProps {
  itemId: number;
  categoryId: number;
  itemName: string;
  ingredients: Ingredient[];
}

/**
 * Guest flow step 4a (Configure Order): "Checklist of ingredients to
 * exclude (e.g. 'no tomatoes'). Confirm -> item added to cart WITH
 * exclusions attached."
 *
 * On confirm this calls useCart().addItem(...), which maps to
 * OrderItem.excluded_ingredients server-side, then — per step 5 of
 * the guest flow — returns to the Category List the product came from.
 */
export default function ExclusionChecklist({
  itemId,
  ingredients,
}: ExclusionChecklistProps) {
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const { addItem } = useCart();
  const navigate = useNavigate();

  const toggle = (ingredientId: number) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(ingredientId)) {
        next.delete(ingredientId);
      } else {
        next.add(ingredientId);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);

    const excludedIngredients = ingredients
      .filter((ingredient) => excludedIds.has(ingredient.id))
      .map((ingredient) => ingredient.name);

    try {
      await addItem({
        item_id: itemId,
        excluded_ingredients: excludedIngredients,
      });
      navigate("/cart");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="exclusion-checklist">
      <p className="exclusion-checklist__hint">Select anything to leave out</p>

      <ul className="exclusion-checklist__list">
        {ingredients.map((ingredient) => (
          <li key={ingredient.id} className="exclusion-checklist__item">
            <label>
              <input
                type="checkbox"
                checked={excludedIds.has(ingredient.id)}
                onChange={() => toggle(ingredient.id)}
              />
              {`No ${ingredient.name}`}
            </label>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="exclusion-checklist__confirm"
        onClick={handleConfirm}
        disabled={submitting}
      >
        {submitting ? "Adding…" : "Confirm"}
      </button>
    </div>
  );
}