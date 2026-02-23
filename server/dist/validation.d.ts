import { z } from 'zod';
import type { RequestHandler, ErrorRequestHandler } from 'express';
export declare const moveSchema: z.ZodObject<{
    robotId: z.ZodNumber;
    x: z.ZodNumber;
    y: z.ZodNumber;
}, z.core.$strip>;
export declare const powerSchema: z.ZodObject<{
    robotId: z.ZodNumber;
    mode: z.ZodEnum<{
        FULL: "FULL";
        NORMAL: "NORMAL";
        ECO: "ECO";
        CRITICAL: "CRITICAL";
    }>;
}, z.core.$strip>;
export declare const robotIdSchema: z.ZodObject<{
    robotId: z.ZodNumber;
}, z.core.$strip>;
export declare const formationSchema: z.ZodEnum<{
    scatter: "scatter";
    grid: "grid";
    ring: "ring";
    wedge: "wedge";
    cluster: "cluster";
}>;
export declare const missionTypeSchema: z.ZodEnum<{
    survey: "survey";
    intercept: "intercept";
    search_classify: "search_classify";
    perimeter: "perimeter";
}>;
export declare const replayParamsSchema: z.ZodObject<{
    from: z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>;
    to: z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>;
}, z.core.$strip>;
/**
 * Validates req.body against a Zod schema.
 * On success: replaces req.body with parsed data and calls next().
 * On failure: responds 400 with validation error details.
 */
export declare function validateBody<T>(schema: z.ZodSchema<T>): RequestHandler;
/**
 * Validates a single route parameter against a Zod schema.
 * On success: calls next().
 * On failure: responds 400 with validation error details.
 */
export declare function validateParams(paramName: string, schema: z.ZodSchema): RequestHandler;
/**
 * Validates multiple route parameters against an object schema.
 * On success: calls next().
 * On failure: responds 400 with validation error details.
 */
export declare function validateRouteParams(schema: z.ZodSchema): RequestHandler;
export declare const errorHandler: ErrorRequestHandler;
