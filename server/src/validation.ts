/* validation.ts — Zod schemas + Express middleware for input validation */

import { z } from 'zod';
import type { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';

// ── Schemas ──────────────────────────────────────────────────

export const moveSchema = z.object({
  robotId: z.number().int().min(0).max(7),
  x: z.number().min(0).max(120),
  y: z.number().min(0).max(80),
});

export const powerSchema = z.object({
  robotId: z.number().int().min(0).max(7),
  mode: z.enum(['FULL', 'NORMAL', 'ECO', 'CRITICAL']),
});

export const robotIdSchema = z.object({
  robotId: z.number().int().min(0).max(7),
});

export const formationSchema = z.enum(['scatter', 'grid', 'ring', 'wedge', 'cluster']);

export const missionTypeSchema = z.enum(['intercept', 'survey', 'search_classify', 'perimeter']);

export const replayParamsSchema = z.object({
  from: z.string().regex(/^\d+$/, 'must be an integer').transform(Number),
  to: z.string().regex(/^\d+$/, 'must be an integer').transform(Number),
});

// ── Middleware factories ─────────────────────────────────────

/**
 * Validates req.body against a Zod schema.
 * On success: replaces req.body with parsed data and calls next().
 * On failure: responds 400 with validation error details.
 */
export function validateBody<T>(schema: z.ZodSchema<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (result.success) {
      req.body = result.data;
      next();
    } else {
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
export function validateParams(paramName: string, schema: z.ZodSchema): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params[paramName]);
    if (result.success) {
      next();
    } else {
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
export function validateRouteParams(schema: z.ZodSchema): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (result.success) {
      next();
    } else {
      res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: result.error.issues,
      });
    }
  };
}

// ── Error handler (must be LAST middleware) ───────────────────

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  console.error('[ERROR]', err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
};
