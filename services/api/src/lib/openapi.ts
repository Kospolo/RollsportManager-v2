// ============================================================================
// lib/openapi.ts - small helpers so every route declares typed request AND
// response schemas (Blueprint principle "kein Feature ohne Vertrag").
// ============================================================================

import { OpenAPIHono, z } from '@hono/zod-openapi';
import type { Hook } from '@hono/zod-openapi';
import type { AuthEnv } from '../middleware/auth.js';
import { problemSchema } from './validation.js';

/** JSON body/response helper for createRoute definitions. */
export function jsonContent<T extends z.ZodTypeAny>(schema: T, description: string) {
  return {
    content: { 'application/json': { schema } },
    description,
  } as const;
}

/** Standard error responses every authenticated route shares. */
export const errorResponses = {
  400: jsonContent(problemSchema, 'Validation error (RFC 7807)'),
  401: jsonContent(problemSchema, 'Missing or invalid token'),
  403: jsonContent(problemSchema, 'Not allowed for this role / RLS rejected'),
  404: jsonContent(problemSchema, 'Not found (or not visible to the caller)'),
} as const;

/** Zod validation failures become RFC 7807 problems, like every other error. */
const defaultHook: Hook<unknown, AuthEnv, string, unknown> = (result, c) => {
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`)
      .join('; ');
    return c.newResponse(
      JSON.stringify({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail,
        instance: c.req.path,
        request_id: c.get('requestId'),
      }),
      400,
      { 'content-type': 'application/problem+json; charset=utf-8' },
    );
  }
  return undefined;
};

/** Router factory - all feature routers share the same validation hook. */
export function createRouter(): OpenAPIHono<AuthEnv> {
  return new OpenAPIHono<AuthEnv>({ defaultHook });
}
