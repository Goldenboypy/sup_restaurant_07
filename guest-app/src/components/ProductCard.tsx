import { Link } from "react-router-dom";

export interface MenuItemSummary {
  id: number;
  name: string;
  price: number;
  image_url?: string;
  category_id: number;
}

interface ProductCardProps {
  item: MenuItemSummary;
  currency?: string;
}

/**
 * Guest flow step 3 (Product List): "Grid/list of all items in that
 * category, each with a photo, name and price -- laid out like an
 * Amazon search-results page." Tapping it opens Product Detail.
 * Prices ARE shown here (unlike the cart/bill, which hide them).
 */
export default function ProductCard({ item, currency = "€" }: ProductCardProps) {
  return (
    <Link
      to={`/menu/${item.category_id}/${item.id}`}
      className="product-card"
      aria-label={`View ${item.name}`}
    >
      <span className="product-card__image-wrap">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt=""
            className="product-card__image"
            loading="lazy"
          />
        ) : (
          <span className="product-card__image-placeholder" aria-hidden="true" />
        )}
      </span>
      <div className="product-card__info">
        <span className="product-card__name">{item.name}</span>
        <span className="product-card__price">
          {currency}
          {item.price.toFixed(2)}
        </span>
      </div>
    </Link>
  );
}