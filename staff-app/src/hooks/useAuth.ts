/**
 * Staff App - useAuth hook
 *
 * Thin, typed wrapper around AuthContext (context/AuthContext.tsx, kept
 * 100% from v1.0). Exposes the Bearer-token session and the logged-in
 * waiter, plus their role - which decides whether the Waiter View or the
 * Kitchen View is shown after login.
 */

import { useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import type { Waiter } from '../types/table';

export type StaffRole = 'waiter' | 'kitchen';

export interface AuthContextValue {
  waiter: Waiter | null;
  token: string | null;
  role: StaffRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export interface UseAuthResult extends AuthContextValue {
  /** Convenience check used to gate Waiter View vs Kitchen View screens. */
  hasRole: (role: StaffRole) => boolean;
}

export function useAuth(): UseAuthResult {
  const context = useContext(AuthContext) as AuthContextValue | undefined;

  if (!context) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }

  const hasRole = useCallback(
    (role: StaffRole) => context.role === role,
    [context.role]
  );

  return { ...context, hasRole };
}