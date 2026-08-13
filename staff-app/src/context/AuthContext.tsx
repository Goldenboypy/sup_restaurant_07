/**
 * Staff App - AuthContext (kept 100% from v1.0)
 *
 * Holds the Bearer-token session for the Staff App: logs in against the
 * staff auth endpoint, persists the token, restores the session on reload,
 * and exposes the logged-in Waiter + role (waiter | kitchen), which decides
 * which screens are shown after login. Consumed via hooks/useAuth.ts.
 */

import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { Waiter, StaffRole } from '../types/table';

export interface AuthContextValue {
  waiter: Waiter | null;
  token: string | null;
  role: StaffRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'staff_auth_token';
const API_BASE = import.meta.env.VITE_STAFF_API_BASE_URL ?? '/api/staff';

interface LoginResponse {
  token: string;
  waiter: Waiter;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY)
  );
  const [waiter, setWaiter] = useState<Waiter | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentWaiter = useCallback(async (authToken: string): Promise<Waiter> => {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to restore session: ${response.status}`);
    }

    return (await response.json()) as Waiter;
  }, []);

  // Restore the session from a stored token on mount / when the token changes.
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const currentWaiter = await fetchCurrentWaiter(token);
        if (!cancelled) {
          setWaiter(currentWaiter);
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          setToken(null);
          setWaiter(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, [token, fetchCurrentWaiter]);

  const login = useCallback(async (username: string, password: string) => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Login failed ${response.status}: ${detail || response.statusText}`);
    }

    const data = (await response.json()) as LoginResponse;
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setToken(data.token);
    setWaiter(data.waiter);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setWaiter(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      waiter,
      token,
      role: waiter?.role ?? null,
      isAuthenticated: Boolean(token && waiter),
      isLoading,
      login,
      logout,
    }),
    [waiter, token, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}