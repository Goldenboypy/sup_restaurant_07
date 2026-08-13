import {
  createContext,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import { fetchSession, getStoredSession } from "../api/session";
import type { TableSession } from "../types/session";

interface TableSessionContextValue {
  session: TableSession | null;
  isLoading: boolean;
  error: string | null;
  startSession: (qrToken: string) => Promise<void>;
}

export const TableSessionContext = createContext<
  TableSessionContextValue | undefined
>(undefined);

interface TableSessionProviderProps {
  children: ReactNode;
}

/** Holds the guest's table session established by scanning a table QR code. */
export function TableSessionProvider({ children }: TableSessionProviderProps) {
  const [session, setSession] = useState<TableSession | null>(() => getStoredSession());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSession = useCallback(async (qrToken: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const resolved = await fetchSession(qrToken);
      setSession(resolved);
    } catch {
      setError(
        "This table's QR code could not be recognized. Please ask a waiter for help."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <TableSessionContext.Provider
      value={{ session, isLoading, error, startSession }}
    >
      {children}
    </TableSessionContext.Provider>
  );
}