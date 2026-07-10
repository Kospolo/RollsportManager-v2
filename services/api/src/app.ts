// ============================================================================
// app.ts - assembles the Hono app (separate from the server entry so tests
// and the OpenAPI export script can import it without opening a port).
// ============================================================================

import { OpenAPIHono } from '@hono/zod-openapi';
import type { AuthEnv } from './middleware/auth.js';
import { requireAuth } from './middleware/auth.js';
import { onError, onNotFound, requestId } from './middleware/error.js';
import { healthRouter } from './routes/health.js';
import { clubsRouter } from './routes/clubs.js';
import { membersRouter } from './routes/members.js';
import { eventsRouter } from './routes/events.js';
import { routinesRouter } from './routes/routines.js';
import { invoicesRouter } from './routes/invoices.js';
import { entitlementsRouter } from './routes/entitlements.js';
import { productsRouter } from './modules/billing/products.js';
import { createWebhooksRouter } from './modules/billing/webhooks.js';
import { dunningRouter } from './modules/dunning/routes.js';

/**
 * Paths reachable without a bearer JWT. The webhook endpoints are
 * server-to-server and authenticate on their own: Stripe via mandatory
 * HMAC signature, RevenueCat via static Authorization header (ADR-E6).
 */
const PUBLIC_PATHS = new Set(['/health', '/openapi.json', '/webhooks/stripe', '/webhooks/revenuecat']);

export function createApp(): OpenAPIHono<AuthEnv> {
  const app = new OpenAPIHono<AuthEnv>();

  app.use('*', requestId);
  app.use('*', async (c, next) => {
    if (PUBLIC_PATHS.has(c.req.path)) return next();
    return requireAuth(c, next);
  });
  app.onError(onError);
  app.notFound(onNotFound);

  app.route('/', healthRouter);
  app.route('/', clubsRouter);
  app.route('/', membersRouter);
  app.route('/', eventsRouter);
  app.route('/', routinesRouter);
  app.route('/', invoicesRouter);
  app.route('/', entitlementsRouter);
  app.route('/', productsRouter);
  app.route('/', dunningRouter);
  // plain Hono router - webhooks are deliberately NOT in the OpenAPI contract
  app.route('/', createWebhooksRouter());

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
    version: '0.1.0',
    description:
      'Thin typed API layer (Blueprint ADR-E2). All writes and money operations go through this service; ' +
      'requests are executed against Postgres under the caller\'s own JWT claims (RLS impersonation), ' +
      'so row-level security remains the second line of defense. This spec is the codegen source ' +
      '(packages/contracts/openapi.json).',
  },
  tags: [
    { name: 'system', description: 'Health & meta' },
    { name: 'clubs', description: 'Clubs (tenant root)' },
    { name: 'members', description: 'Roster & roles' },
    { name: 'events', description: 'Events, RSVPs, attendance' },
    { name: 'routines', description: 'Küren: routines, markers, scores' },
    { name: 'invoices', description: 'Money ops (invoice numbers are service-mode only)' },
    { name: 'entitlements', description: 'License state - read-only for clients' },
    { name: 'products', description: 'Product catalog (single source of truth for pricing)' },
    { name: 'dunning', description: 'Server-side dunning runs (dry-run first, stage >= 2 needs approval)' },
  ],
};
