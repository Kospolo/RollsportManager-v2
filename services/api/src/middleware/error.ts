// ============================================================================
// middleware/error.ts - RFC 7807 application/problem+json everywhere.
//
// Every response carries the request id (x-request-id, incoming or generated)
// so a client-reported error maps to exactly one log line. Postgres errors
// from the impersonated transactions are translated:
//   42501 (insufficient_privilege / RLS violation) -> 403
//   P0001 (raise exception in protective triggers) -> 403 with the DB message
//   23505 (unique_violation)                       -> 409
//   23503 / 23514 (fk / check violation)           -> 422
// ============================================================================

import { randomUUID } from 'node:crypto';
import { HTTPException } from 'hono/http-exception';
import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';

export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  request_id?: string;
}

export class ProblemError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    public readonly detail?: string,
  ) {
    super(detail ?? title);
  }
}

/** Convenience factory: `throw problem(403, 'Forbidden', 'coach role required')` */
export function problem(status: number, title: string, detail?: string): ProblemError {
  return new ProblemError(status, title, detail);
}

interface PgLikeError {
  code?: string;
  message?: string;
}

function isPgError(err: unknown): err is PgLikeError {
  return typeof err === 'object' && err !== null && 'code' in err;
}

/** Map errors thrown by postgres.js (RLS, triggers, constraints) to problems. */
export function pgErrorToProblem(err: unknown): ProblemError | undefined {
  if (!isPgError(err) || typeof err.code !== 'string') return undefined;
  const message = typeof err.message === 'string' ? err.message : undefined;
  switch (err.code) {
    case '42501':
      return problem(403, 'Forbidden', 'Row-level security rejected this operation');
    case 'P0001':
      return problem(403, 'Forbidden', message);
    case '23505':
      return problem(409, 'Conflict', 'A row with these unique values already exists');
    case '23503':
      return problem(422, 'Unprocessable Entity', 'Referenced row does not exist');
    case '23514':
      return problem(422, 'Unprocessable Entity', message);
    default:
      return undefined;
  }
}

export const requestId = createMiddleware(async (c, next) => {
  const id = c.req.header('x-request-id') ?? randomUUID();
  c.set('requestId', id);
  c.header('x-request-id', id);
  await next();
});

function problemResponse(c: Context, body: ProblemBody): Response {
  return c.newResponse(JSON.stringify(body), body.status as 400, {
    'content-type': 'application/problem+json; charset=utf-8',
    'x-request-id': body.request_id ?? '',
  });
}

export function onError(err: unknown, c: Context): Response {
  const reqId = (c.get('requestId') as string | undefined) ?? randomUUID();
  const instance = c.req.path;

  const asProblem =
    err instanceof ProblemError
      ? err
      : err instanceof HTTPException
        ? problem(err.status, err.message || 'Error')
        : pgErrorToProblem(err);

  if (asProblem) {
    if (asProblem.status >= 500) console.error(`[api] ${reqId} ${instance}:`, err);
    return problemResponse(c, {
      type: 'about:blank',
      title: asProblem.title,
      status: asProblem.status,
      ...(asProblem.detail !== undefined ? { detail: asProblem.detail } : {}),
      instance,
      request_id: reqId,
    });
  }

  console.error(`[api] ${reqId} unhandled error at ${instance}:`, err);
  return problemResponse(c, {
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
    detail: 'Unexpected error - see server log for this request id',
    instance,
    request_id: reqId,
  });
}

export function onNotFound(c: Context): Response {
  const reqId = (c.get('requestId') as string | undefined) ?? randomUUID();
  return problemResponse(c, {
    type: 'about:blank',
    title: 'Not Found',
    status: 404,
    detail: `No route for ${c.req.method} ${c.req.path}`,
    instance: c.req.path,
    request_id: reqId,
  });
}
