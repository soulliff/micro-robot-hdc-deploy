"use strict";
/* security.ts — helmet + CORS configuration for the swarm console server */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSecurity = setupSecurity;
exports.getSocketCorsConfig = getSocketCorsConfig;
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const isDev = process.env.NODE_ENV !== 'production';
/**
 * Configure security middleware (helmet + CORS).
 * Must be called BEFORE other middleware / route registration.
 */
function setupSecurity(app) {
    // ── Helmet — sensible HTTP security headers ──────────────
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: false, // SPA serves its own CSP via meta tag
        crossOriginEmbedderPolicy: false, // required for WASM fetch
    }));
    // ── CORS ─────────────────────────────────────────────────
    if (isDev) {
        // In development allow all origins (localhost, LAN IPs, etc.)
        app.use((0, cors_1.default)({
            origin: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            credentials: true,
        }));
    }
    // In production the client is served from the same origin — no CORS
    // header is needed. Omitting cors() means cross-origin requests are
    // rejected by default (browser same-origin policy).
}
/**
 * Build a Socket.io-compatible CORS config object that mirrors the
 * HTTP CORS policy above.
 */
function getSocketCorsConfig() {
    if (isDev) {
        return {
            origin: true,
            methods: ['GET', 'POST'],
        };
    }
    // Production: same-origin only — disable cross-origin WebSocket upgrades
    return { origin: false, methods: ['GET', 'POST'] };
}
