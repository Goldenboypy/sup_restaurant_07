export interface Ingredient {
  id: number;
  name: string;
  allergen?: boolean;
}

interface IngredientListProps {
  ingredients: Ingredient[];
}

/**
 * Guest flow step 4 (Product Detail): "Ingredient list next to it
 * (for allergies / dislikes)". Read-only — selecting exclusions
 * happens on the separate ExclusionChecklist ("Configure Order").
 */
export default function IngredientList({ ingredients }: IngredientListProps) {
  if (ingredients.length === 0) {
    return (
      <p className="ingredient-list__empty">
        No ingredient information available.
      </p>
    );
  }

  return (
    <ul className="ingredient-list" aria-label="Ingredients">
      {ingredients.map((ingredient) => (
        <li
          key={ingredient.id}
          className={`ingredient-list__item${
            ingredient.allergen ? " ingredient-list__item--allergen" : ""
          }`}
        >
          {ingredient.name}
          {ingredient.allergen && (
            <span
              className="ingredient-list__allergen-tag"
              aria-label="Contains allergen"
              title="Contains allergen"
            >
              ⚠
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}