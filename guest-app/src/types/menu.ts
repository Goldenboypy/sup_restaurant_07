export interface Ingredient {
  id: number;
  name: string;
  allergen?: boolean;
}

/** One of: Breakfast | Lunch | Dinner | Offers | Desserts | Soups | Drinks */
export interface MenuCategory {
  id: number;
  name: string;
  image_url?: string;
}

/** Product List entry — photo, name and price ("Amazon-style" grid). */
export interface MenuItemSummary {
  id: number;
  name: string;
  price: number;
  image_url?: string;
  category_id: number;
}

/** Product Detail — adds description and the ingredient list. */
export interface MenuItemDetail extends MenuItemSummary {
  description?: string;
  ingredients: Ingredient[];
}