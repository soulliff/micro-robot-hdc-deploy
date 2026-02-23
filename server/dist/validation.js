"use strict";
/* validation.ts — Zod schemas + Express middleware for input validation */
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.replayParamsSchema = exports.missionTypeSchema = exports.formationSchema = exports.robotIdSchema = exports.powerSchema = exports.moveSchema = void 0;
exports.validateBody = validateBody;
exports.validateParams = validateParams;
exports.validateRouteParams = validateRouteParams;
const zod_1 = require("zod");
// ── Schemas ──────────────────────────────────────────────────
exports.moveSchema = zod_1.z.object({
    robotId: zod_1.z.number().int().min(0).max(7),
    x: zod_1.z.number().min(0).max(120),
    y: zod_1.z.number().min(0).max(80),
});
exports.powerSchema = zod_1.z.object({
    robotId: zod_1.z.number().int().min(0).max(7),
    mode: zod_1.z.enum(['FULL', 'NORMAL', 'ECO', 'CRITICAL']),
});
exports.robotIdSchema = zod_1.z.object({
    robotId: zod_1.z.number().int().min(0).max(7),
});
exports.formationSchema = zod_1.z.enum(['scatter', 'grid', 'ring', 'wedge', 'cluster']);
exports.missionTypeSchema = zod_1.z.enum(['intercept', 'survey', 'search_classify', 'perimeter']);
exports.replayParamsSchema = zod_1.z.object({
    from: zod_1.z.string().regex(/^\d+$/, 'must be an integer').transform(Number),
    to: zod_1.z.string().regex(/^\d+$/, 'must be an integer').transform(Number),
});
// ── Middleware factories ─────────────────────────────────────
/**
 * Validates req.body against a Zod schema.
 * On success: replaces req.body with parsed data and calls next().
 * On failure: responds 400 with validation error details.
 */
function validateBody(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (result.success) {
            req.body = result.data;
            next();
        }
        else {
            res.status(400).json({
                ok: false,
                error: 'Validation failed',
                details: result.error.issues,
            });
        }
    };
}
/**
 * Validates a single route parameter against a Zod schema.
 * On success: calls next().
 * On failure: responds 400 with validation error details.
 */
function validateParams(paramName, schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.params[paramName]);
        if (result.success) {
            next();
        }
        else {
            res.status(400).json({
                ok: false,
                error: 'Validation failed',
                details: result.error.issues,
            });
        }
    };
}
/**
 * Validates multiple route parameters against an object schema.
 * On success: calls next().
 * On failure: responds 400 with validation error details.
 */
function validateRouteParams(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.params);
        if (result.success) {
            next();
        }
        else {
            res.status(400).json({
                ok: false,
                error: 'Validation failed',
                details: result.error.issues,
            });
        }
    };
}
// ── Error handler (must be LAST middleware) ───────────────────
const errorHandler = (err, _req, res, _next) => {
    console.error('[ERROR]', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
};
exports.errorHandler = errorHandler;
