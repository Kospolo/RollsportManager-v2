// ============================================================================
// app.ts - assembles the Hono app (separate from the server entry so tests
// and the OpenAPI export script can import it without opening a port).
// ============================================================================

import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import type { AuthEnv } from './middleware/auth.js';
import { requireAuth } from './middleware/auth.js';
import { onError, onNotFound, requestId } from './middleware/error.js';
import { getConfig } from './config.js';
import { healthRouter } from './routes/health.js';
import { createDevLoginRouter } from './routes/dev-login.js';
import { clubsRouter } from './routes/clubs.js';
import { membersRouter } from './routes/members.js';
import { teamsRouter } from './routes/teams.js';
import { platformRouter } from './routes/platform.js';
import { eventsRouter } from './routes/events.js';
import { routinesRouter } from './routes/routines.js';
import { competitionsRouter } from './routes/competitions.js';
import { tasksRouter } from './routes/tasks.js';
import { newsRouter } from './routes/news.js';
import { notesRouter } from './routes/notes.js';
import { exercisesRouter } from './routes/exercises.js';
import { invoicesRouter } from './routes/invoices.js';
import { entitlementsRouter } from './routes/entitlements.js';
import { productsRouter } from './modules/billing/products.js';
import { createWebhooksRouter } from './modules/billing/webhooks.js';
import { dunningRouter } from './modules/dunning/routes.js';

/**
 * Paths reachable without a bearer JWT. The webhook endpoints are
 * server-to-server and authenticate on their own: Stripe via mandatory
 * HMAC signature, RevenueCat via static Authorization header (ADR-E6).
 * /dev/login is the DEV-ONLY persona login: its handler answers 404 unless
 * AUTH_MODE=dev (routes/dev-login.ts), so being "public" leaks nothing in
 * prod. Like the webhooks it is a plain Hono router - never in the OpenAPI
 * spec, never in the generated clients.
 */
const PUBLIC_PATHS = new Set([
  '/health',
  '/openapi.json',
  '/webhooks/stripe',
  '/webhooks/revenuecat',
  '/dev/login',
]);

/**
 * DEV-ONLY CORS for the web portal on localhost:3021. Checked per request so
 * it is impossible to keep the header in a prod-mode process; prod traffic
 * goes through the reverse proxy on the same origin and needs no CORS.
 */
const devCors = cors({
  origin: 'http://localhost:3021',
  allowHeaders: ['authorization', 'content-type', 'x-request-id'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['x-request-id'],
  maxAge: 600,
});

export function createApp(): OpenAPIHono<AuthEnv> {
  const app = new OpenAPIHono<AuthEnv>();

  app.use('*', requestId);
  app.use('*', async (c, next) => {
    if (getConfig().auth.mode === 'dev') return devCors(c, next);
    return next();
  });
  app.use('*', async (c, next) => {
    if (PUBLIC_PATHS.has(c.req.path)) return next();
    return requireAuth(c, next);
  });
  app.onError(onError);
  app.notFound(onNotFound);

  app.route('/', healthRouter);
  app.route('/', clubsRouter);
  app.route('/', membersRouter);
  app.route('/', teamsRouter);
  app.route('/', platformRouter);
  app.route('/', eventsRouter);
  app.route('/', routinesRouter);
  app.route('/', competitionsRouter);
  app.route('/', tasksRouter);
  app.route('/', newsRouter);
  app.route('/', notesRouter);
  app.route('/', exercisesRouter);
  app.route('/', invoicesRouter);
  app.route('/', entitlementsRouter);
  app.route('/', productsRouter);
  app.route('/', dunningRouter);
  // plain Hono router - webhooks are deliberately NOT in the OpenAPI contract
  app.route('/', createWebhooksRouter());
  // plain Hono router - dev-only persona login, 404 unless AUTH_MODE=dev,
  // deliberately NOT in the OpenAPI contract (see routes/dev-login.ts)
  app.route('/', createDevLoginRouter());

  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      'GoTrue access token. Claims contract: sub (uuid), role=authenticated, club_roles={club_id: role} from the custom access token hook.',
  });

  app.doc('/openapi.json', openApiConfig);

  return app;
}

export const openApiConfig: Parameters<OpenAPIHono['getOpenAPIDocument']>[0] = {
  openapi: '3.0.3',
  info: {
    title: 'RollsportManager v2 API',
    version: '0.2.0',
    description:
      'Thin typed API layer (Blueprint ADR-E2). All writes and money operations go through this service; ' +
      'requests are executed against Postgres under the caller\'s own JWT claims (RLS impersonation), ' +
      'so row-level security remains the second line of defense. This spec is the codegen source ' +
      '(packages/contracts/openapi.json).',
  },
  tags: [
    { name: 'system', description: 'Health & meta' },
    { name: 'clubs', description: 'Clubs (tenant root)' },
    { name: 'members', description: 'Roster, roles & guardianships (family model)' },
    { name: 'teams', description: 'Teams incl. skater/coach member ids + management' },
    { name: 'platform', description: 'Cross-club super-admin console (platform admin claim only)' },
    { name: 'events', description: 'Events, RSVPs, attendance' },
    { name: 'routines', description: 'Küren: routines, markers, scores' },
    { name: 'competitions', description: 'Competitions incl. start list (read model)' },
    { name: 'tasks', description: 'Club to-dos (tick-off by staff or assignee)' },
    { name: 'invoices', description: 'Money ops (invoice numbers are service-mode only)' },
    { name: 'entitlements', description: 'License state - read-only for clients' },
    { name: 'products', description: 'Product catalog (single source of truth for pricing)' },
    { name: 'dunning', description: 'Server-side dunning runs (dry-run first, stage >= 2 needs approval)' },
  ],
};
