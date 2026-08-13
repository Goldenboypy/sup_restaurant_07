import type { TableSession } from "../types/session";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const SESSION_STORAGE_KEY = "guest_session_token";
const SESSION_RECORD_KEY = "guest_session";

export function getStoredSessionToken(): string | null {
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

function storeSessionToken(token: string): void {
  localStorage.setItem(SESSION_STORAGE_KEY, token);
}

export function getStoredSession(): TableSession | null {
  const raw = localStorage.getItem(SESSION_RECORD_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as TableSession;
    } catch {
      localStorage.removeItem(SESSION_RECORD_KEY);
    }
  }

  // Fallback: allow server to inject an existing session token into the
  // page. Support two mechanisms used in templates: a global
  // `window.__GUEST_SESSION_TOKEN` or a <meta name="guest-session-token">.
  // If present, persist a minimal TableSession so the SPA can use it
  // immediately (avoids "Unauthorized" when the user already has a
  // server-created session).
  try {
    const win = window as unknown as { __GUEST_SESSION_TOKEN?: string } & Window;
    const token = win.__GUEST_SESSION_TOKEN || document.querySelector('meta[name="guest-session-token"]')?.getAttribute("content");
    if (token) {
      const session: TableSession = {
        session_token: token,
        table_id: 0,
        table_number: "",
        status: "active",
        started_at: new Date().toISOString(),
        ended_at: null,
      };
      storeSessionToken(token);
      localStorage.setItem(SESSION_RECORD_KEY, JSON.stringify(session));
      return session;
    }
  } catch (_) {
    // ignore any DOM/window issues in non-browser environments
  }

  return null;
}

export function clearStoredSessionToken(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(SESSION_RECORD_KEY);
}

/**
 * Shared request helper for every /api/guest/* call. Attaches the
 * table-session token as a header — per "ARCHITECTURE OVERVIEW":
 * "No username/password -- identity = table-session token in the QR".
 */
export async function guestRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getStoredSessionToken();

  const response = await fetch(`${API_BASE}/api/guest${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Table-Session": token } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Guest API request failed: ${init.method ?? "GET"} ${path} (${response.status})`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/**
 * GET /api/guest/session/:qr_token
 * Exchanges the QR code's token for a table session, creating one if
 * none exists yet, or reusing the active one for this table.
 */
export async function fetchSession(qrToken: string): Promise<TableSession> {
  const response = await fetch(`${API_BASE}/api/guest/session/${qrToken}`);

  if (!response.ok) {
    throw new Error(`Failed to resolve table session (${response.status})`);
  }

  const session = (await response.json()) as TableSession;
  storeSessionToken(session.session_token);
  localStorage.setItem(SESSION_RECORD_KEY, JSON.stringify(session));
  return session;
}