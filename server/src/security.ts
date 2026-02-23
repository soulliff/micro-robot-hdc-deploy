/* security.ts — helmet + CORS configuration for the swarm console server */

import helmet from 'helmet';
import cors from 'cors';
import type { Express } from 'express';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Configure security middleware (helmet + CORS).
 * Must be called BEFORE other middleware / route registration.
 */
export function setupSecurity(app: Express): void {
  // ── Helmet — sensible HTTP security headers ──────────────
  app.use(
    helmet({
      contentSecurityPolicy: false,       // SPA serves its own CSP via meta tag
      crossOriginEmbedderPolicy: false,   // required for WASM fetch
    }),
  );

  // ── CORS ─────────────────────────────────────────────────
  if (isDev) {
    // In development allow all origins (localhost, LAN IPs, etc.)
    app.use(
      cors({
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true,
      }),
    );
  }
  // In production the client is served from the same origin — no CORS
  // header is needed. Omitting cors() means cross-origin requests are
  // rejected by default (browser same-origin policy).
}

/**
 * Build a Socket.io-compatible CORS config object that mirrors the
 * HTTP CORS policy above.
 */
export function getSocketCorsConfig(): { origin: string | RegExp | boolean; methods: string[] } {
  if (isDev) {
    return {
      origin: true,
      methods: ['GET', 'POST'],
    };
  }
  // Production: same-origin only — disable cross-origin WebSocket upgrades
  return { origin: false, methods: ['GET', 'POST'] };
}
