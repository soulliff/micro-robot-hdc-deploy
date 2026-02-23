import type { Express } from 'express';
/**
 * Configure security middleware (helmet + CORS).
 * Must be called BEFORE other middleware / route registration.
 */
export declare function setupSecurity(app: Express): void;
/**
 * Build a Socket.io-compatible CORS config object that mirrors the
 * HTTP CORS policy above.
 */
export declare function getSocketCorsConfig(): {
    origin: string | RegExp | boolean;
    methods: string[];
};
