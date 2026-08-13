import { useContext } from "react";
import { CartContext } from "../context/CartContext";

/**
 * Access the draft cart and add items to it. Must be used within a
 * <CartProvider>. Consumed by CartIcon and ExclusionChecklist.
 */
export function useCart() {
  const context = useContext(CartContext);

  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }

  return context;
}