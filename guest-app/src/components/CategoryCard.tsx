import { Link } from "react-router-dom";

export interface MenuCategorySummary {
  id: number;
  name: string;
  image_url?: string;
}

interface CategoryCardProps {
  category: MenuCategorySummary;
}

/**
 * Guest flow step 2 (Category List): one tile per category
 * (Breakfast | Lunch | Dinner | Offers | Desserts | Soups | Drinks).
 * Tapping it opens the Product List for that category.
 */
export default function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link
      to={`/menu/${category.id}`}
      className="category-card"
      aria-label={`Browse ${category.name}`}
    >
      {category.image_url && (
        <img
          src={category.image_url}
          alt=""
          className="category-card__image"
          loading="lazy"
        />
      )}
      <span className="category-card__name">{category.name}</span>
    </Link>
  );
}