import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { addCartItem, fetchCart } from "../api/cart";
import { useTableSession } from "../hooks/useTableSession";
import type { CartItem, CartItemInput } from "../types/order";

interface CartContextValue {
  items: CartItem[];
  isLoading: boolean;
  addItem: (input: CartItemInput) => Promise<void>;
  refresh: () => Promise<void>;
}

export const CartContext = createContext<CartContextValue | undefined>(
  undefined
);

interface CartProviderProps {
  children: ReactNode;
}

/**
 * Guest flow steps 5-6: the draft cart. Server-backed and
 * deliberately carries no price fields — only item names, quantities
 * and any exclusions configured via "Configure Order".
 */
export function CartProvider({ children }: CartProviderProps) {
  const { session } = useTableSession();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!session) {
      setItems([]);
      return;
    }
    setIsLoading(true);
    try {
      const cart = await fetchCart();
      setItems(cart);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  const addItem = useCallback(
    async (input: CartItemInput) => {
      await addCartItem(input);
      await refresh();
    },
    [refresh]
  );

  useEffect(() => {
    void refresh();
  }, [refresh, session]);

  return (
    <CartContext.Provider value={{ items, isLoading, addItem, refresh }}>
      {children}
    </CartContext.Provider>
  );
}