// ============================================================================
// app.ts - assembles the Hono app (separate from the server entry so tests
// and the OpenAPI export script can import it without opening a port).
// ============================================================================

import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import type { AuthEnv } from './middleware/auth.js';
import { requireAuth } from './middleware/auth.js';
import { operatorAccess } from './middleware/operator-access.js';
import { onError, onNotFound, requestId } from './middleware/error.js';
import { getConfig } from './config.js';
import { healthRouter } from './routes/health.js';
import { createDevLoginRouter } from './routes/dev-login.js';
import { clubsRouter } from './routes/clubs.js';
import { registrationRouter } from './routes/registration.js';
import { membersRouter } from './routes/members.js';
import { familyRouter } from './routes/family.js';
import { consentsRouter } from './routes/consents.js';
import { waitlistsRouter } from './routes/waitlists.js';
import { budgetsRouter } from './routes/budgets.js';
import { meRouter } from './routes/me.js';
import { rolesRouter } from './routes/roles.js';
import { modulesRouter } from './routes/modules.js';
import { teamsRouter } from './routes/teams.js';
import { platformRouter } from './routes/platform.js';
import { platformSettingsRouter } from './routes/platform-settings.js';
import { platformLicensesRouter } from './routes/platform-licenses.js';
import { platformBillingRouter } from './routes/platform-billing.js';
import { platformSystemRouter } from './routes/platform-system.js';
import { eventsRouter } from './routes/events.js';
import { routinesRouter } from './routes/routines.js';
import { competitionsRouter } from './routes/competitions.js';
import { publicRoutinesRouter } from './routes/public-routines.js';
import { tasksRouter } from './routes/tasks.js';
import { newsRouter } from './routes/news.js';
import { notesRouter } from './routes/notes.js';
import { exercisesRouter } from './routes/exercises.js';
import { facilitiesRouter } from './routes/facilities.js';
import { facilityBookingsRouter } from './routes/facility-bookings.js';
import { equipmentRouter } from './routes/equipment.js';
import { equipmentReservationsRouter } from './routes/equipment-reservations.js';
import { achievementsRouter } from './routes/achievements.js';
import { trainingSlotsRouter } from './routes/training-slots.js';
import { dutyRequirementsRouter } from './routes/duty-requirements.js';
import { dutyEntriesRouter } from './routes/duty-entries.js';
import { chatRouter } from './routes/chat.js';
import { checkinsRouter } from './routes/checkins.js';
import { regionalEventsRouter } from './routes/regional-events.js';
import { galleryRouter } from './routes/gallery.js';
import { documentsRouter } from './routes/documents.js';
import { reportsRouter } from './routes/reports.js';
import { departmentsRouter } from './routes/departments.js';
import { lockersRouter } from './routes/lockers.js';
import { invoicesRouter } from './routes/invoices.js';
import { ledgerRouter } from './routes/ledger.js';
import { bankTransactionsRouter } from './routes/bank-transactions.js';
import { donationsRouter } from './routes/donations.js';
import { membershipCategoriesRouter } from './routes/membership-categories.js';
import { memberFeesRouter } from './routes/member-fees.js';
import { familyDiscountsRouter } from './routes/family-discounts.js';
import { sepaMandatesRouter } from './routes/sepa-mandates.js';
import { entitlementsRouter } from './routes/entitlements.js';
import { productsRouter } from './modules/billing/products.js';
import { createWebhooksRouter } from './modules/billing/webhooks.js';
import { createMediaRouter } from './modules/media/routes.js';
import { createExportRouter } from './modules/export/routes.js';
import { dunningRouter } from './modules/dunning/routes.js';

/**
 * Paths reachable without a bearer JWT. The webhook endpoints are
 * server-to-server and authenticate on their own: Stripe via mandatory
 * HMAC signature, RevenueCat via static Authorization header (ADR-E6).
 * /dev/login is the DEV-ONLY persona login: its handler answers 404 unless
 * AUTH_MODE=dev (routes/dev-login.ts), so being "public" leaks nothing in
 * prod. Like the webhooks it is a plain Hono router - never in the OpenAPI
 * spec, never in the generated clients.
 *
 * The /public/ PREFIX is the login-free surface (currently only the Kür token
 * view GET /public/routines/{token}). It is a TYPED route in the OpenAPI
 * contract but declares no bearerAuth and is allowlisted in
 * packages/contracts/codegen/check.mjs (PUBLIC_ROUTES). Its handler resolves
 * the opaque token in service mode and returns only minimal, non-personal data.
 */
const PUBLIC_PATHS = new Set([
  '/health',
  '/openapi.json',
  '/webhooks/stripe',
  '/webhooks/revenuecat',
  '/dev/login',
]);

/** Path prefixes that are public (auth skipped). Kept explicit and narrow. */
const PUBLIC_PREFIXES = ['/public/'];

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
    if (PUBLIC_PREFIXES.some((p) => c.req.path.startsWith(p))) return next();
    return requireAuth(c, next);
  });
  // DER BETREIBER-ZUGRIFF UND SEIN PROTOKOLL (Migration 0051). Muss NACH
  // requireAuth stehen: die Middleware entscheidet anhand der VERIFIZIERTEN
  // Claims. Fuer jeden Nicht-Plattform-Admin ist sie ein reiner Durchreicher.
  // Sie steht bewusst hier und nicht in einzelnen Routen — sie ist zugleich der
  // Schalter, der den Betreiber-Zugriff ueberhaupt erst einschaltet, und die
  // Stelle, die ihn protokolliert. Beides ist untrennbar (siehe Dateikopf).
  app.use('*', operatorAccess);
  app.onError(onError);
  app.notFound(onNotFound);

  app.route('/', healthRouter);
  app.route('/', clubsRouter);
  app.route('/', registrationRouter);
  app.route('/', membersRouter);
  app.route('/', familyRouter);
  app.route('/', consentsRouter);
  app.route('/', waitlistsRouter);
  app.route('/', budgetsRouter);
  app.route('/', meRouter);
  app.route('/', rolesRouter);
  app.route('/', modulesRouter);
  app.route('/', teamsRouter);
  app.route('/', platformRouter);
  app.route('/', platformSettingsRouter);
  app.route('/', platformLicensesRouter);
  app.route('/', platformBillingRouter);
  app.route('/', platformSystemRouter);
  app.route('/', eventsRouter);
  app.route('/', routinesRouter);
  app.route('/', competitionsRouter);
  app.route('/', publicRoutinesRouter);
  app.route('/', tasksRouter);
  app.route('/', newsRouter);
  app.route('/', notesRouter);
  app.route('/', exercisesRouter);
  app.route('/', facilitiesRouter);
  app.route('/', facilityBookingsRouter);
  app.route('/', equipmentRouter);
  app.route('/', equipmentReservationsRouter);
  app.route('/', achievementsRouter);
  app.route('/', trainingSlotsRouter);
  app.route('/', dutyRequirementsRouter);
  app.route('/', dutyEntriesRouter);
  app.route('/', chatRouter);
  app.route('/', checkinsRouter);
  app.route('/', regionalEventsRouter);
  app.route('/', galleryRouter);
  app.route('/', documentsRouter);
  app.route('/', reportsRouter);
  app.route('/', departmentsRouter);
  app.route('/', lockersRouter);
  app.route('/', invoicesRouter);
  app.route('/', ledgerRouter);
  app.route('/', bankTransactionsRouter);
  app.route('/', donationsRouter);
  app.route('/', membershipCategoriesRouter);
  app.route('/', memberFeesRouter);
  app.route('/', familyDiscountsRouter);
  app.route('/', sepaMandatesRouter);
  app.route('/', entitlementsRouter);
  app.route('/', productsRouter);
  app.route('/', dunningRouter);
  // plain Hono router - webhooks are deliberately NOT in the OpenAPI contract
  app.route('/', createWebhooksRouter());
  // plain Hono router - binary upload/serve for the PRO media modules; moves
  // raw bytes, so deliberately NOT in the OpenAPI contract (like the webhooks).
  // Requires auth (not in PUBLIC_PATHS): POST /media/upload, GET /media/{key}.
  app.route('/', createMediaRouter());
  // plain Hono router - GoBD/DATEV CSV export; streams text/csv, so deliberately
  // NOT in the OpenAPI contract (like media/webhooks). Requires auth (not in
  // PUBLIC_PATHS): GET /export/ledger.csv, GET /export/datev.
  app.route('/', createExportRouter());
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
    { name: 'members', description: 'Roster, roles & guardianships (family model incl. child self-service)' },
    { name: 'waitlists', description: 'Wartelisten: self-join/leave a scarce resource; trainer manages all' },
    { name: 'budgets', description: 'Budget(-planung): plan per category/year + plan-vs-actual report (finance only)' },
    { name: 'teams', description: 'Teams incl. skater/coach member ids + management' },
    { name: 'departments', description: 'Abteilungen: read = member, manage = club admin, assign members = trainer' },
    { name: 'lockers', description: 'Schließfächer: read = member, master data = club admin, assign/release = trainer' },
    { name: 'platform', description: 'Cross-club super-admin console (platform admin claim only)' },
    { name: 'events', description: 'Events, RSVPs, attendance' },
    { name: 'routines', description: 'Küren: routines, markers, scores' },
    { name: 'competitions', description: 'Competitions incl. start list, standings + federation export' },
    { name: 'public', description: 'Login-free token views (shared Kür) — minimal, non-personal data' },
    { name: 'tasks', description: 'Club to-dos (tick-off by staff or assignee)' },
    { name: 'facilities', description: 'Halls & rooms incl. bookings (self-service or staff)' },
    { name: 'equipment', description: 'Gear inventory incl. reservations (self-service or staff)' },
    { name: 'achievements', description: 'Medals & competition results (read = member, award = staff)' },
    { name: 'chat', description: 'Team channels & direct messages (members/team-scoped, server-enforced)' },
    { name: 'checkins', description: 'Attendance check-in (QR/manual): self-checkin or staff for anyone' },
    { name: 'regional-events', description: 'Supra-regional events (read = member, curate = staff)' },
    { name: 'gallery', description: 'Galerie (PRO): photos & video clips — read = member+PRO, curate = staff+PRO' },
    { name: 'documents', description: 'Dokumente (PRO): club files — read = member+PRO, curate = staff+PRO' },
    { name: 'invoices', description: 'Money ops (invoice numbers are service-mode only)' },
    { name: 'bank-transactions', description: 'Bankabgleich: reconcile bank movements against invoices (finance only)' },
    { name: 'donations', description: 'Spenden + Spendenbescheinigung (finance writes; donor reads own)' },
    { name: 'entitlements', description: 'License state - read-only for clients' },
    { name: 'products', description: 'Product catalog (single source of truth for pricing)' },
    { name: 'dunning', description: 'Server-side dunning runs (dry-run first, stage >= 2 needs approval)' },
  ],
};
