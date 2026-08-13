export function isWebSocketEnabled(): boolean {
  if (typeof window === 'undefined') return false;

  const host = window.location.hostname || '';
  const explicit = import.meta.env.VITE_ENABLE_WS;

  if (explicit === 'true') return true;
  if (explicit === 'false') return false;

  const isPreviewHost = host.includes('github.dev') || host.includes('app.github.dev') || host.includes('githubpreview') || host.includes('netlify.app') || host.includes('vercel.app');
  if (isPreviewHost) return false;

  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1';
}

export function createSocket(url: string): WebSocket | null {
  if (!isWebSocketEnabled() || !url) return null;

  try {
    return new WebSocket(url);
  } catch {
    return null;
  }
}
