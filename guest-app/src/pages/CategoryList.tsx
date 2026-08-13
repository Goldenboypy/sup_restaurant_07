/**
 * pages/CategoryList.tsx
 * Step 2 of the guest flow: Breakfast | Lunch | Dinner | Offers |
 * Desserts | Soups | Drinks. Tapping a category opens ProductList.tsx
 * for that category.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import CategoryCard from "../components/CategoryCard";
import { fetchCategories } from "../api/menu";
import type { MenuCategory } from "../types/menu";

const CATEGORY_ORDER = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Offers",
  "Desserts",
  "Soups",
  "Drinks",
];

export default function CategoryList(): JSX.Element {
  const [categories, setCategories] = useState<MenuCategory[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchCategories()
      .then((data) => {
        if (!cancelled) {
          const ordered = [...data].sort(
            (left, right) =>
              CATEGORY_ORDER.indexOf(left.name) - CATEGORY_ORDER.indexOf(right.name)
          );
          setCategories(ordered);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the menu. Please try again.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="empty-state" role="alert">
        <h2>Menu is being updated</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!categories) {
    return (
      <div className="category-grid" aria-busy="true">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="category-card skeleton" />
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="empty-state">
        <h2>Menu is being updated</h2>
        <p>Please ask a member of staff, or check back in a moment.</p>
      </div>
    );
  }

  return (
    <div className="category-list">
      <div className="category-list__header">
        <Link className="btn btn--secondary" to="/">
          Back to Home
        </Link>
        <h1>Choose a category</h1>
      </div>
      <div className="category-grid">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </div>
    </div>
  );
}