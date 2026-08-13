const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const TOKEN_STORAGE_KEY = "staff_auth_token";

export type StaffRole = "waiter" | "kitchen";

export interface StaffUser {
  id: number;
  name: string;
  role: StaffRole;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: StaffUser;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

function storeToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

/**
 * Shared request helper for every /api/staff/* call. Attaches the
 * Bearer token issued at login -- "Login required (Bearer token,
 * same auth.py as v1.0)". Clears a stale token on 401 so the next
 * render falls through to the login screen.
 */
export async function staffRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();

  const response = await fetch(`${API_BASE}/api/staff${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (response.status === 401) {
    clearStoredToken();
  }

  if (!response.ok) {
    throw new Error(
      `Staff API request failed: ${init.method ?? "GET"} ${path} (${response.status})`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** POST /api/staff/auth/login */
export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  const response = await fetch(`${API_BASE}/api/staff/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error(`Login failed (${response.status})`);
  }

  const result = (await response.json()) as LoginResult;
  storeToken(result.token);
  return result;
}

/** GET /api/staff/auth/me — restores the session on page reload. */
export function fetchCurrentUser(): Promise<StaffUser> {
  return staffRequest<StaffUser>("/auth/me");
}

/** Clears the local session (no server-side call implied by the spec). */
export function logout(): void {
  clearStoredToken();
}