import { guestRequest } from "./session";
import type { MenuCategory, MenuItemDetail, MenuItemSummary } from "../types/menu";

/** GET /api/guest/menu/categories — list the 7 categories. */
export function fetchCategories(): Promise<MenuCategory[]> {
  return guestRequest<MenuCategory[]>("/menu/categories");
}

/** GET /api/guest/menu/categories/:id/items — product list w/ photos. */
export function fetchCategoryItems(categoryId: number): Promise<MenuItemSummary[]> {
  return guestRequest<MenuItemSummary[]>(`/menu/categories/${categoryId}/items`);
}

/** GET /api/guest/menu/items/:id — detail + ingredient list. */
export function fetchItemDetail(itemId: number): Promise<MenuItemDetail> {
  return guestRequest<MenuItemDetail>(`/menu/items/${itemId}`);
}